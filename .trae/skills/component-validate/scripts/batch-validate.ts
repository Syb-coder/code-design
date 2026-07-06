/**
 * batch-validate.ts - 批量校验任务生成脚本
 *
 * 职责：
 *   1. 扫描 library/ 下所有组件目录（忽略 _inbox/ _archive/ _source/）
 *   2. 为每个组件生成"校验任务卡"（结构化指令，含组件路径、校验项清单）
 *   3. 输出 validate-tasks.json，供 AI 按校验 Skill 流程逐个处理
 *
 * 设计说明：
 *   "调校验 Skill" 不是代码级调用（Skill 是 markdown 流程指令）。
 *   本脚本生成结构化任务清单，AI 拿到后读取 .trae/skills/component-validate/SKILL.md
 *   按其流程逐个执行 G1/G2/G3 三层校验，汇总报告。
 *   G2 需要预览应用 dev server 运行中（沙箱路由 /__sandbox__/:id）。
 *
 * 归属：批量预处理脚本，由用户/AI 手动触发
 *
 * 用法：
 *   npx tsx .trae/skills/component-validate/scripts/batch-validate.ts
 *   npx tsx .trae/skills/component-validate/scripts/batch-validate.ts --scan library/react/
 *   npx tsx .trae/skills/component-validate/scripts/batch-validate.ts --only button-glow,spotlight-card
 *   npx tsx .trae/skills/component-validate/scripts/batch-validate.ts --resume
 *   npx tsx .trae/skills/component-validate/scripts/batch-validate.ts --preview-url http://localhost:5173
 *
 * 依赖：tsx（无运行时依赖，仅文件扫描）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 类型定义
// ============================================================

/** 单个校验任务卡 */
interface ValidateTask {
  taskId: string;
  componentId: string;
  componentDir: string;
  hasOriginalPng: boolean;
  hasPreviewTsx: boolean;
  status: "pending" | "processing" | "done" | "failed";
  skillPath: string;
  previewUrl: string;
  instructions: string[];
  report?: {
    overall: "pass" | "fail" | "warn";
    g1?: unknown;
    g2?: unknown;
    g3?: unknown;
  };
  error?: string;
  processedAt?: string;
}

/** 批量校验任务清单 */
interface ValidateTaskList {
  total: number;
  pending: number;
  processing: number;
  done: number;
  failed: number;
  tasks: ValidateTask[];
  generatedAt: string;
  skillPath: string;
  previewBaseUrl: string;
  previewServerHint: string;
}

interface CliArgs {
  scan: string;
  only?: string[];
  resume: boolean;
  previewUrl: string;
}

// ============================================================
// 常量
// ============================================================

// 脚本位于 .trae/skills/component-validate/scripts/，向上 4 级回到项目根
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
// 批量工作目录放在所属 skill 下，保持 skill 自包含
const BATCH_DIR = path.resolve(__dirname, "..", ".batch");
const TASKS_FILE = path.join(BATCH_DIR, "validate-tasks.json");
const VALIDATE_SKILL = ".trae/skills/component-validate/SKILL.md";
const DEFAULT_PREVIEW_URL = "http://localhost:5173";

// 扫描时忽略的目录名（下划线开头表示非组件目录）
const IGNORED_DIRS = new Set(["_inbox", "_archive", "_source", "node_modules", ".git"]);

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    scan: path.join(PROJECT_ROOT, "library"),
    resume: false,
    previewUrl: DEFAULT_PREVIEW_URL,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--scan":
        args.scan = path.resolve(next);
        i++;
        break;
      case "--only": {
        args.only = next.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        i++;
        break;
      }
      case "--resume":
        args.resume = true;
        break;
      case "--preview-url":
        args.previewUrl = next.replace(/\/+$/, "");
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[batch-validate] 未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
batch-validate.ts - 批量校验任务生成

用法:
  npx tsx .trae/skills/component-validate/scripts/batch-validate.ts [options]

可选参数:
  --scan <DIR>            扫描目录（默认 library/）
  --only <a,b,c>          只校验指定组件名（逗号分隔，匹配目录名）
  --resume                续跑模式：仅保留 pending 状态任务
  --preview-url <URL>     预览应用地址（默认 http://localhost:5173，G2 需要）

产出:
  .trae/skills/component-validate/.batch/validate-tasks.json   校验任务清单（AI 按校验 Skill 逐个处理）

前置条件:
  G2 渲染校验需要预览应用 dev server 运行中（npm run dev），
  且预览应用需实现沙箱路由 /__sandbox__/:componentId

AI 使用方式:
  1. 读取 .trae/skills/component-validate/.batch/validate-tasks.json
  2. 读取 .trae/skills/component-validate/SKILL.md（校验 Skill 流程）
  3. 对每个 pending 任务，按 Skill 流程执行 G1/G2/G3
  4. 每完成一个任务，更新 status + report 字段并写回 validate-tasks.json
`);
}

// ============================================================
// 扫描组件目录
// ============================================================

interface ScannedComponent {
  componentId: string;
  componentDir: string;
  dirName: string;
  hasOriginalPng: boolean;
  hasPreviewTsx: boolean;
}

/**
 * 递归扫描 library/ 目录，识别组件目录。
 * 组件目录的判定：包含 meta.json 或 index.tsx/index.html/index.vue 之一。
 * 忽略 _inbox/ _archive/ _source/ 等下划线开头目录。
 */
function scanComponents(rootDir: string): ScannedComponent[] {
  const results: ScannedComponent[] = [];
  if (!fs.existsSync(rootDir)) return results;

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // 当前目录是否为组件目录
    const hasMeta = entries.some((e) => e.isFile() && e.name === "meta.json");
    const hasIndex = entries.some(
      (e) => e.isFile() && /^index\.(tsx|html|vue)$/.test(e.name)
    );
    if (hasMeta && hasIndex) {
      const dirName = path.basename(dir);
      const relDir = path.relative(PROJECT_ROOT, dir).replace(/\\/g, "/");
      // componentId 优先用 meta.json 的 id 字段，回退用目录相对路径
      const componentId = readComponentId(dir) ?? relDir;
      const hasOriginalPng = fs.existsSync(path.join(dir, "_source", "original.png"));
      const hasPreviewTsx = fs.existsSync(path.join(dir, "preview.tsx"));
      results.push({ componentId, componentDir: relDir, dirName, hasOriginalPng, hasPreviewTsx });
      return; // 组件目录不再向下递归
    }

    // 非组件目录，递归子目录
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith("_")) continue;
      walk(path.join(dir, entry.name));
    }
  };

  walk(rootDir);
  return results;
}

/**
 * 读取组件 meta.json 的 id 字段（失败返回 undefined）。
 */
function readComponentId(componentDir: string): string | undefined {
  try {
    const metaPath = path.join(componentDir, "meta.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { id?: string };
    return meta.id;
  } catch {
    return undefined;
  }
}

// ============================================================
// 生成任务卡
// ============================================================

function buildTask(comp: ScannedComponent, previewBaseUrl: string): ValidateTask {
  const taskId = `validate-${comp.dirName}`;
  const previewUrl = `${previewBaseUrl}/__sandbox__/${encodeURIComponent(comp.componentId)}`;

  const instructions: string[] = [
    `读取校验 Skill: ${VALIDATE_SKILL}`,
    `G1 静态校验: 调 .trae/skills/component-validate/scripts/validate-component.ts --component "${comp.componentDir}"`,
  ];

  if (comp.hasPreviewTsx) {
    instructions.push(
      `G2 渲染校验: 调 scripts/screenshot-diff.ts --component "${comp.componentDir}" --preview-url "${previewUrl}"`
    );
    if (comp.hasOriginalPng) {
      instructions.push(`G2 模式: 双图对比（original.png vs rendered.png，相似度阈值 0.7）`);
    } else {
      instructions.push(`G2 模式: 仅渲染不报错即通过（无 original.png）`);
    }
  } else {
    instructions.push(`G2 渲染校验: 跳过（无 preview.tsx，无法沙箱渲染）`);
  }

  instructions.push(
    `G3 AI 自评: 对照 original.html + original.png + rendered.png + card.md + meta.json 二次自检`,
    `汇总三层结果为校验报告（JSON），更新本任务 report 字段`,
    `更新本任务 status 为 done（或 failed），写回 validate-tasks.json`
  );

  return {
    taskId,
    componentId: comp.componentId,
    componentDir: comp.componentDir,
    hasOriginalPng: comp.hasOriginalPng,
    hasPreviewTsx: comp.hasPreviewTsx,
    status: "pending",
    skillPath: VALIDATE_SKILL,
    previewUrl,
    instructions,
  };
}

// ============================================================
// 主流程
// ============================================================

function main(): void {
  const args = parseArgs(process.argv);
  fs.mkdirSync(BATCH_DIR, { recursive: true });

  if (!fs.existsSync(args.scan)) {
    console.error(`[batch-validate] 扫描目录不存在: ${args.scan}`);
    process.exit(1);
  }

  // 扫描组件
  let components = scanComponents(args.scan);
  console.log(`[batch-validate] 扫描到 ${components.length} 个组件目录`);

  // --only 过滤（按目录名匹配）
  if (args.only && args.only.length > 0) {
    components = components.filter((c) => args.only!.includes(c.dirName));
    console.log(`[batch-validate] --only 过滤后剩余 ${components.length} 个`);
  }

  // --resume 模式：加载已有任务，只保留 pending
  let existingTasks: ValidateTask[] = [];
  if (args.resume && fs.existsSync(TASKS_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8")) as ValidateTaskList;
      existingTasks = prev.tasks.filter((t) => t.status === "pending");
      console.log(`[batch-validate] 续跑模式：保留 ${existingTasks.length} 个 pending 任务`);
    } catch {
      console.warn("[batch-validate] 读取旧任务失败，重新生成");
    }
  }

  // 生成新任务（仅对未在 existingTasks 中的组件）
  const existingIds = new Set(existingTasks.map((t) => t.componentId));
  const newTasks = components
    .filter((c) => !existingIds.has(c.componentId))
    .map((c) => buildTask(c, args.previewUrl));

  const tasks = [...existingTasks, ...newTasks];

  // 统计
  const stats = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    { pending: 0, processing: 0, done: 0, failed: 0 } as Record<string, number>
  );

  const taskList: ValidateTaskList = {
    total: tasks.length,
    pending: stats.pending ?? 0,
    processing: stats.processing ?? 0,
    done: stats.done ?? 0,
    failed: stats.failed ?? 0,
    tasks,
    generatedAt: new Date().toISOString(),
    skillPath: VALIDATE_SKILL,
    previewBaseUrl: args.previewUrl,
    previewServerHint: `G2 渲染校验需要预览应用运行中。请先启动: npm run dev（默认 ${args.previewUrl}）`,
  };

  fs.writeFileSync(TASKS_FILE, JSON.stringify(taskList, null, 2), "utf-8");

  console.log("[batch-validate] ========== 任务清单生成完成 ==========");
  console.log(`总计: ${taskList.total} | pending: ${taskList.pending} | processing: ${taskList.processing} | done: ${taskList.done} | failed: ${taskList.failed}`);
  console.log(`任务清单: ${TASKS_FILE}`);
  console.log("");
  console.log("前置条件:");
  console.log(`  G2 渲染校验需预览应用运行中: npm run dev（${args.previewUrl}）`);
  console.log("");
  console.log("AI 处理步骤:");
  console.log(`  1. 读取 ${TASKS_FILE}`);
  console.log(`  2. 读取校验 Skill: ${VALIDATE_SKILL}`);
  console.log(`  3. 对每个 pending 任务，按 Skill 流程执行 G1/G2/G3`);
  console.log(`  4. 每完成一个任务，更新 status + report 字段并写回 ${TASKS_FILE}`);
}

main();
