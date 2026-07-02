/**
 * batch-fetch.ts - 批量抓取脚本
 *
 * 职责：
 *   1. 读取 docs/组件URL收集清单.md，解析表格提取待抓取 URL 列表
 *   2. 为每个 URL 规划临时输出目录（.trae/skills/component-ingest/.batch/fetched/{slug}/_source/）
 *   3. 逐个调用 fetch-source.ts 抓取（子进程方式，避免内存堆积）
 *   4. 汇总结果到 .trae/skills/component-ingest/.batch/fetch-result.json，供 batch-ingest.ts 消费
 *   5. 支持断点续跑（已成功的 URL 跳过）
 *
 * 归属：批量预处理脚本，由用户/AI 手动触发，不属于任何 Skill
 *
 * 用法：
 *   npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts
 *   npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts --input docs/组件URL收集清单.md
 *   npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts --only 1,3,5        # 只抓序号 1/3/5
 *   npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts --retry-failed       # 重试上次失败的
 *
 * 依赖：tsx（fetch-source.ts 自身依赖 playwright）
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ESM 环境下模拟 __dirname（package.json type: module）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 类型定义
// ============================================================

interface ComponentEntry {
  index: number;
  name: string;
  url: string;
  techStack: string;
  category: string;
  status: string;
  remark: string;
}

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

interface CliArgs {
  input: string;
  only?: number[];
  retryFailed: boolean;
  concurrency: number;
}

// ============================================================
// 常量
// ============================================================

// 脚本位于 .trae/skills/component-ingest/scripts/，向上 4 级回到项目根
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
// 批量工作目录放在所属 skill 下，保持 skill 自包含
const BATCH_DIR = path.resolve(__dirname, "..", ".batch");
const FETCHED_DIR = path.join(BATCH_DIR, "fetched");
const DEFAULT_INPUT = path.join(PROJECT_ROOT, "docs", "组件URL收集清单.md");
const RESULT_FILE = path.join(BATCH_DIR, "fetch-result.json");
// fetch-source.ts 与本脚本同目录
const FETCH_SOURCE_SCRIPT = path.resolve(__dirname, "fetch-source.ts");

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: DEFAULT_INPUT,
    retryFailed: false,
    concurrency: 1, // 串行，避免浏览器实例并发问题
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
      case "--retry-failed":
        args.retryFailed = true;
        break;
      case "--concurrency":
        args.concurrency = Math.max(1, parseInt(next, 10) || 1);
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[batch-fetch] 未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
batch-fetch.ts - 批量抓取组件 URL 清单

用法:
  npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts [options]

可选参数:
  --input <FILE>          输入清单文件（默认 docs/组件URL收集清单.md）
  --only <1,3,5>          只抓指定序号（逗号分隔）
  --retry-failed          仅重试上次失败的 URL
  --concurrency <N>       并发数（默认 1，串行避免浏览器实例冲突）

产出:
  .trae/skills/component-ingest/.batch/fetched/{slug}/_source/*   每个组件的抓取素材
  .trae/skills/component-ingest/.batch/fetch-result.json          汇总结果（供 batch-ingest.ts 消费）
`);
}

// ============================================================
// 解析清单 Markdown
// ============================================================

/**
 * 解析 docs/组件URL收集清单.md 表格，提取待抓取条目。
 * 仅抓取 status 含"待处理"或"待收集"的行（跳过已入库/需人工）。
 */
function parseChecklist(filePath: string): ComponentEntry[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`清单文件不存在: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const entries: ComponentEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    // 跳过表头与分隔行
    if (trimmed.includes("---") || /序号|组件名称|URL/.test(trimmed)) continue;

    const cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 6) continue;

    const index = parseInt(cells[0], 10);
    if (isNaN(index)) continue;

    entries.push({
      index,
      name: cells[1],
      url: cells[2],
      techStack: cells[3],
      category: cells[4],
      status: cells[5],
      remark: cells[6] ?? "",
    });
  }
  return entries;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 将组件名转为 URL 友好的 slug。
 * "Modern Login Signup" → "modern-login-signup"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/[\u4e00-\u9fa5]+/g, (m) => m) || `component-${Date.now()}`;
}

/**
 * 读取上次结果，返回已成功抓取的 URL 集合（用于断点续跑）。
 */
function loadPrevSuccess(): Set<string> {
  if (!fs.existsSync(RESULT_FILE)) return new Set();
  try {
    const prev = JSON.parse(fs.readFileSync(RESULT_FILE, "utf-8")) as BatchFetchResult;
    return new Set(prev.items.filter((i) => i.ok).map((i) => i.url));
  } catch {
    return new Set();
  }
}

/**
 * 读取上次结果，返回失败的 URL 列表（用于 --retry-failed）。
 */
function loadPrevFailed(): ComponentEntry[] {
  if (!fs.existsSync(RESULT_FILE)) return [];
  try {
    const prev = JSON.parse(fs.readFileSync(RESULT_FILE, "utf-8")) as BatchFetchResult;
    return prev.items
      .filter((i) => !i.ok)
      .map((i) => ({
        index: i.index,
        name: i.name,
        url: i.url,
        techStack: "",
        category: "",
        status: "📥 待处理",
        remark: "",
      }));
  } catch {
    return [];
  }
}

// ============================================================
// 调用 fetch-source.ts
// ============================================================

interface FetchSourceOutput {
  ok: boolean;
  outDir: string;
  files: string[];
  error?: string;
}

/**
 * 以子进程方式调用 fetch-source.ts，解析其 stdout JSON 输出。
 */
function callFetchSource(url: string, outDir: string): FetchSourceOutput {
  const args = [
    FETCH_SOURCE_SCRIPT,
    "--url", url,
    "--out", outDir,
  ];
  try {
    const stdout = execFileSync("npx", ["tsx", ...args], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
      shell: true,
    });
    // fetch-source.ts 在 stdout 末尾输出 JSON，取最后一个 JSON 对象
    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    if (!jsonMatch) {
      return { ok: false, outDir, files: [], error: "fetch-source 未输出 JSON" };
    }
    const parsed = JSON.parse(jsonMatch[0]) as FetchSourceOutput;
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, outDir, files: [], error: message };
  }
}

// ============================================================
// 主流程
// ============================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  fs.mkdirSync(FETCHED_DIR, { recursive: true });

  // 确定要处理的条目
  let entries: ComponentEntry[];
  if (args.retryFailed) {
    entries = loadPrevFailed();
    console.log(`[batch-fetch] 重试模式：从上次结果加载 ${entries.length} 个失败项`);
  } else {
    const all = parseChecklist(args.input);
    // 过滤：只处理"待处理"或"待收集"
    let pending = all.filter((e) => /待处理|待收集/.test(e.status));
    if (args.only && args.only.length > 0) {
      pending = pending.filter((e) => args.only!.includes(e.index));
    }
    entries = pending;
    console.log(`[batch-fetch] 清单共 ${all.length} 条，待抓取 ${entries.length} 条`);
  }

  if (entries.length === 0) {
    console.log("[batch-fetch] 无待抓取条目，退出");
    return;
  }

  // 断点续跑：跳过已成功的（非 retry 模式）
  const prevSuccess = args.retryFailed ? new Set<string>() : loadPrevSuccess();

  const items: FetchItemResult[] = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of entries) {
    const slug = slugify(entry.name);
    const outDir = path.join(FETCHED_DIR, slug, "_source");

    if (prevSuccess.has(entry.url)) {
      console.log(`[batch-fetch] [${entry.index}] 跳过（已成功）: ${entry.name}`);
      items.push({
        index: entry.index,
        name: entry.name,
        url: entry.url,
        slug,
        outDir,
        ok: true,
        files: [],
        fetchedAt: new Date().toISOString(),
      });
      skipped++;
      continue;
    }

    console.log(`[batch-fetch] [${entry.index}] 抓取: ${entry.name} <${entry.url}>`);
    const result = callFetchSource(entry.url, outDir);

    items.push({
      index: entry.index,
      name: entry.name,
      url: entry.url,
      slug,
      outDir,
      ok: result.ok,
      error: result.error,
      files: result.files,
      fetchedAt: new Date().toISOString(),
    });

    if (result.ok) {
      success++;
      console.log(`[batch-fetch] [${entry.index}] ✓ 成功`);
    } else {
      failed++;
      console.error(`[batch-fetch] [${entry.index}] ✗ 失败: ${result.error}`);
    }
  }

  const summary: BatchFetchResult = {
    total: entries.length,
    success,
    failed,
    skipped,
    items,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2), "utf-8");

  console.log("");
  console.log("[batch-fetch] ========== 汇总 ==========");
  console.log(`总计: ${summary.total} | 成功: ${success} | 失败: ${failed} | 跳过: ${skipped}`);
  console.log(`结果已写入: ${RESULT_FILE}`);

  if (failed > 0) {
    console.log(`提示: 重试失败项请运行: npx tsx .trae/skills/component-ingest/scripts/batch-fetch.ts --retry-failed`);
  }
}

main().catch((err) => {
  console.error("[batch-fetch] 未捕获异常:", err);
  process.exit(1);
});
