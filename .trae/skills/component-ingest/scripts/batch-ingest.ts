/**
 * batch-ingest.ts - 批量入库任务生成脚本
 *
 * 职责：
 *   1. 读取 batch-fetch.ts 产出的 fetch-result.json，筛选成功抓取的条目
 *   2. 为每个组件生成"入库任务卡"（结构化指令，含组件信息、抓取产物路径、推荐分类）
 *   3. 输出 ingest-tasks.json，供 AI 按入库 Skill 流程逐个处理
 *
 * 设计说明：
 *   "调入库 Skill" 不是代码级调用（Skill 是 markdown 流程指令，AI 按需读取）。
 *   本脚本生成结构化任务清单，AI 拿到后读取 .trae/skills/component-ingest/SKILL.md
 *   按其流程逐个处理（净化 → 生成产物 → 转校验 Skill → G4 人工确认 → 入库）。
 *   每处理完一个任务，AI 应更新任务状态（pending → processing → done/failed）。
 *
 * 归属：批量预处理脚本，由用户/AI 手动触发
 *
 * 用法：
 *   npx tsx .trae/skills/component-ingest/scripts/batch-ingest.ts
 *   npx tsx .trae/skills/component-ingest/scripts/batch-ingest.ts --input .trae/skills/component-ingest/.batch/fetch-result.json
 *   npx tsx .trae/skills/component-ingest/scripts/batch-ingest.ts --only 1,3,5
 *   npx tsx .trae/skills/component-ingest/scripts/batch-ingest.ts --resume          # 仅处理 pending 状态的任务
 *
 * 依赖：tsx（无运行时依赖，仅文件读写）
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 类型定义
// ============================================================

/** 从 fetch-result.json 读取的单条抓取结果 */
interface FetchItemResult {
  index: number;
  name: string;
  url: string;
  slug: string;
  outDir: string;
  ok: boolean;
  error?: string;
  files: string[];
  fetchedAt: string;
}

interface BatchFetchResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  items: FetchItemResult[];
  generatedAt: string;
}

/** 清单中的预估分类，用于推荐（可被 AI 覆盖） */
interface CategoryHint {
  techStack: string;
  category: string;
}

/** 单个入库任务卡 */
interface IngestTask {
  taskId: string;
  index: number;
  name: string;
  slug: string;
  url: string;
  sourceDir: string;
  categoryHint: CategoryHint;
  status: "pending" | "processing" | "done" | "failed";
  skillPath: string;
  instructions: string[];
  error?: string;
  processedAt?: string;
  targetDir?: string;
}

/** 清单条目（用于关联预估分类） */
interface ChecklistEntry {
  index: number;
  techStack: string;
  category: string;
}

/** 批量入库任务清单 */
interface IngestTaskList {
  total: number;
  pending: number;
  processing: number;
  done: number;
  failed: number;
  tasks: IngestTask[];
  generatedAt: string;
  skillPath: string;
}

interface CliArgs {
  input: string;
  only?: number[];
  resume: boolean;
}

// ============================================================
// 常量
// ============================================================

// 脚本位于 .trae/skills/component-ingest/scripts/，向上 4 级回到项目根
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
// 批量工作目录放在所属 skill 下，保持 skill 自包含
const BATCH_DIR = path.resolve(__dirname, "..", ".batch");
const DEFAULT_INPUT = path.join(BATCH_DIR, "fetch-result.json");
const TASKS_FILE = path.join(BATCH_DIR, "ingest-tasks.json");
const INGEST_SKILL = ".trae/skills/component-ingest/SKILL.md";

// techStack → 标准化映射（清单中的 "React + TypeScript" → "react"）
const TECH_STACK_MAP: Record<string, string> = {
  "react": "react",
  "react + typescript": "react",
  "react+typescript": "react",
  "vue": "vue",
  "vue 3": "vue",
  "vue3 + typescript": "vue",
  "html": "html",
  "html/css/js": "html",
  "原生 html": "html",
  "three.js": "visualization",
  "canvas": "visualization",
  "svg": "visualization",
};

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: DEFAULT_INPUT,
    resume: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--input":
        args.input = path.resolve(next);
        i++;
        break;
      case "--only": {
        const parts = next.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
        args.only = parts;
        i++;
        break;
      }
      case "--resume":
        args.resume = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[batch-ingest] 未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
batch-ingest.ts - 批量入库任务生成

用法:
  npx tsx .trae/skills/component-ingest/scripts/batch-ingest.ts [options]

可选参数:
  --input <FILE>      输入文件（默认 .trae/skills/component-ingest/.batch/fetch-result.json）
  --only <1,3,5>      只生成指定序号的任务
  --resume            续跑模式：仅保留 pending 状态任务，跳过 done/failed

产出:
  .trae/skills/component-ingest/.batch/ingest-tasks.json   入库任务清单（AI 按入库 Skill 逐个处理）

AI 使用方式:
  1. 读取 .trae/skills/component-ingest/.batch/ingest-tasks.json
  2. 读取 .trae/skills/component-ingest/SKILL.md（入库 Skill 流程）
  3. 对每个 pending 任务，按 Skill 流程处理（净化→生成产物→校验→G4确认→入库）
  4. 每完成一个任务，更新其 status 字段并写回 ingest-tasks.json
`);
}

// ============================================================
// 解析清单与分类提示
// ============================================================

/**
 * 解析 docs/组件URL收集清单.md 表格，提取 index → (techStack, category) 映射。
 * 用于给入库任务提供分类提示（AI 处理时可覆盖）。
 */
function parseChecklistHints(filePath: string): Map<number, ChecklistEntry> {
  const map = new Map<number, ChecklistEntry>();
  if (!fs.existsSync(filePath)) return map;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (trimmed.includes("---") || /序号|组件名称|URL/.test(trimmed)) continue;

    const cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 6) continue;

    const index = parseInt(cells[0], 10);
    if (isNaN(index)) continue;

    map.set(index, {
      index,
      techStack: cells[3],
      category: cells[4],
    });
  }
  return map;
}

/**
 * 从清单的"预估分类"字段解析 techStack + category。
 * 输入形如 "business / auth" 或 "effects / background" 或 "ui-basic"。
 */
function parseCategoryHint(rawTechStack: string, rawCategory: string): CategoryHint {
  const techStack = TECH_STACK_MAP[rawTechStack.toLowerCase().trim()] ?? "react";

  const parts = rawCategory
    .split(/[\/,，、]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  const validCategories = ["ui-basic", "business", "effects", "three", "canvas", "svg"];
  const category = parts.find((p) => validCategories.includes(p)) ?? "business";

  return { techStack, category };
}

// ============================================================
// 生成任务卡
// ============================================================

function buildTask(item: FetchItemResult, hint: CategoryHint): IngestTask {
  const taskId = `ingest-${String(item.index).padStart(3, "0")}-${item.slug}`;
  const sourceDir = path.relative(PROJECT_ROOT, item.outDir).replace(/\\/g, "/");
  const targetDir = `library/${hint.techStack}/${hint.category}/${item.slug}`;

  return {
    taskId,
    index: item.index,
    name: item.name,
    slug: item.slug,
    url: item.url,
    sourceDir,
    categoryHint: hint,
    status: "pending",
    skillPath: INGEST_SKILL,
    instructions: [
      `读取入库 Skill: ${INGEST_SKILL}`,
      `读取抓取素材: ${sourceDir}/original.html, ${sourceDir}/original.png, ${sourceDir}/network.json, ${sourceDir}/console.json, ${sourceDir}/metadata.json`,
      `识别技术栈与依赖（结合 network.json 反推 CDN 依赖）`,
      `按 L1/L2/L3 规则净化代码`,
      `生成产物到 ${targetDir}/: index.tsx, preview.tsx, card.md, meta.json`,
      `把 _source/ 从 ${sourceDir} 移动到 ${targetDir}/_source/`,
      `转交校验 Skill (.trae/skills/component-validate/SKILL.md) 执行 G1/G2/G3`,
      `根据校验报告决定重试（最多3次）或降级到 library/_inbox/`,
      `校验通过后进入 G4 人工确认，向用户展示渲染预览 + diff + AI 卡片 + 自评报告`,
      `用户确认后正式入库 + 更新 CLAUDE.md 索引`,
      `更新本任务 status 为 done（或 failed），写回 ingest-tasks.json`,
    ],
  };
}

// ============================================================
// 主流程
// ============================================================

function main(): void {
  const args = parseArgs(process.argv);
  fs.mkdirSync(BATCH_DIR, { recursive: true });

  if (!fs.existsSync(args.input)) {
    console.error(`[batch-ingest] 输入文件不存在: ${args.input}`);
    console.error(`请先运行: npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts`);
    process.exit(1);
  }

  const fetchResult = JSON.parse(fs.readFileSync(args.input, "utf-8")) as BatchFetchResult;

  // 读取清单获取预估分类提示（index → techStack/category）
  const checklistPath = path.join(PROJECT_ROOT, "docs", "组件URL收集清单.md");
  const hints = parseChecklistHints(checklistPath);
  if (hints.size === 0) {
    console.warn(`[batch-ingest] 未从清单读取到分类提示: ${checklistPath}（将使用默认 react/business）`);
  } else {
    console.log(`[batch-ingest] 从清单读取 ${hints.size} 条分类提示`);
  }

  // 筛选成功抓取的条目
  let candidates = fetchResult.items.filter((i) => i.ok);

  // --only 过滤
  if (args.only && args.only.length > 0) {
    candidates = candidates.filter((i) => args.only!.includes(i.index));
  }

  // --resume 模式：加载已有任务，只保留 pending
  let existingTasks: IngestTask[] = [];
  if (args.resume && fs.existsSync(TASKS_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8")) as IngestTaskList;
      existingTasks = prev.tasks.filter((t) => t.status === "pending");
      console.log(`[batch-ingest] 续跑模式：保留 ${existingTasks.length} 个 pending 任务`);
    } catch {
      console.warn("[batch-ingest] 读取旧任务失败，重新生成");
    }
  }

  // 生成新任务（仅对未在 existingTasks 中的条目）
  const existingIndexes = new Set(existingTasks.map((t) => t.index));
  const newTasks = candidates
    .filter((c) => !existingIndexes.has(c.index))
    .map((c) => {
      const entry = hints.get(c.index);
      const hint = entry
        ? parseCategoryHint(entry.techStack, entry.category)
        : { techStack: "react", category: "business" };
      return buildTask(c, hint);
    });

  const tasks = [...existingTasks, ...newTasks];

  // 统计
  const stats = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    { pending: 0, processing: 0, done: 0, failed: 0 } as Record<string, number>
  );

  const taskList: IngestTaskList = {
    total: tasks.length,
    pending: stats.pending ?? 0,
    processing: stats.processing ?? 0,
    done: stats.done ?? 0,
    failed: stats.failed ?? 0,
    tasks,
    generatedAt: new Date().toISOString(),
    skillPath: INGEST_SKILL,
  };

  fs.writeFileSync(TASKS_FILE, JSON.stringify(taskList, null, 2), "utf-8");

  console.log("[batch-ingest] ========== 任务清单生成完成 ==========");
  console.log(`总计: ${taskList.total} | pending: ${taskList.pending} | processing: ${taskList.processing} | done: ${taskList.done} | failed: ${taskList.failed}`);
  console.log(`任务清单: ${TASKS_FILE}`);
  console.log("");
  console.log("AI 处理步骤:");
  console.log(`  1. 读取 ${TASKS_FILE}`);
  console.log(`  2. 读取入库 Skill: ${INGEST_SKILL}`);
  console.log(`  3. 对每个 pending 任务按 Skill 流程处理`);
  console.log(`  4. 每完成一个任务，更新 status 字段并写回 ${TASKS_FILE}`);
}

main();
