/**
 * validate-component.ts - G1 静态校验脚本
 *
 * 职责：
 *   1. 对单个组件目录执行 G1 静态校验（5 项）
 *   2. 输出 JSON 报告到 stdout（供 AI/脚本管道解析）
 *
 * 校验项：
 *   1. TypeScript 编译（tsc --noEmit --skipLibCheck）
 *   2. meta.json Schema 校验（必填字段 + 枚举值 + tags 长度）
 *   3. card.md frontmatter 校验（必填字段）
 *   4. grep 黑名单扫描（console.log/debugger/api_key/token/http api）
 *   5. 依赖声明一致性（card.md ↔ meta.json ↔ package.json）
 *   6. 还原模式警示标注（rendered-dom/screenshot-restore 时 card.md 必须含"还原实现"）
 *   7. 真实源码留存校验（registry-source/pasted-code 时 _source/original-source.* 必须存在）
 *
 * 设计说明：
 *   - stdout 末尾必须是纯 JSON，进度日志走 stderr（console.error）
 *   - 不引额外 npm 依赖，仅用 node 内置 + execFileSync 调 npx tsc
 *   - 单文件读取异常不影响其它校验项继续执行（容错）
 *
 * 归属：校验 Skill 调用（G1 是 G2/G3 的前置门）
 *
 * 用法：
 *   npx tsx .trae/skills/component-validate/scripts/validate-component.ts --component "<组件目录>"
 *
 * 依赖：tsx、typescript（tsc）
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ESM 下用 createRequire 模拟 require.resolve，用于定位 typescript 包入口
const require = createRequire(import.meta.url);

// ============================================================
// 类型定义
// ============================================================

/** G1 错误类型枚举 */
type G1ErrorType =
  | "ts-compile"
  | "meta-schema"
  | "card-frontmatter"
  | "blacklist"
  | "deps-mismatch"
  | "deps-not-installed"
  | "restore-warning"
  | "source-missing";

/** 单条 G1 错误（不同 type 用不同字段） */
interface G1Error {
  type: G1ErrorType;
  file?: string;
  line?: number;
  message?: string;
  match?: string;
}

/** G1 校验结果 */
interface G1Result {
  pass: boolean;
  errors: G1Error[];
}

/** 脚本最终输出 */
interface ValidateOutput {
  componentId: string;
  componentDir: string;
  sourceType: string;
  g1: G1Result;
}

/** CLI 参数 */
interface CliArgs {
  component: string;
}

/** meta.json 期望结构 */
interface MetaJson {
  id?: string;
  name?: string;
  techStack?: string;
  category?: string;
  tags?: unknown;
  dependencies?: unknown;
  source?: string;
  sourceUrl?: string;
  sourceType?: string;
  createdAt?: string;
}

// ============================================================
// 常量（无魔法值）
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 脚本位于 .trae/skills/component-validate/scripts/，向上 4 级回到项目根
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
// 项目根 tsconfig.json 路径（用于加载 jsx/paths/lib 等编译配置）
const TSCONFIG_PATH = path.join(PROJECT_ROOT, "tsconfig.json");
const HAS_TSCONFIG = fs.existsSync(TSCONFIG_PATH);

// meta.json 必填字段
const META_REQUIRED_FIELDS = [
  "id", "name", "techStack", "category", "tags",
  "dependencies", "source", "sourceUrl", "sourceType", "createdAt",
] as const;

// card.md frontmatter 必填字段（卡片不含 sourceUrl/createdAt/sourceType）
const CARD_REQUIRED_FIELDS = [
  "id", "name", "techStack", "category", "tags",
  "dependencies", "source",
] as const;

// techStack 合法枚举
const TECH_STACK_VALUES = new Set(["react", "html", "vue", "visualization"]);

// category 合法枚举
const CATEGORY_VALUES = new Set(["ui-basic", "business", "effects", "three", "canvas", "svg"]);

// sourceType 合法枚举（决定校验分级：有真实源码 vs 无真实源码）
const SOURCE_TYPE_VALUES = new Set([
  "registry-source", "pasted-code", "rendered-dom", "screenshot-restore",
]);

// 有真实源码的 sourceType 集合（G3 可做实现保真度对比）
const SOURCE_TYPES_WITH_ORIGINAL = new Set(["registry-source", "pasted-code"]);

// 还原模式 sourceType（无真实源码，需强制警示标注）
const RESTORE_SOURCE_TYPES = new Set(["rendered-dom", "screenshot-restore"]);

// 还原模式 card.md 必须包含的警示关键词
const RESTORE_WARNING_KEYWORD = "还原实现";

// 真实源码可能的文件名（按 techStack 区分扩展名）
const ORIGINAL_SOURCE_FILES = ["original-source.tsx", "original-source.html", "original-source.vue"];

// tags 最小长度
const MIN_TAGS_LENGTH = 2;

// 黑名单正则（大小写不敏感）
// 说明：token 命中 CSS 变量也按风险处理（SKILL 规范要求记录）
const BLACKLIST_REGEX = /console\.log|debugger|api[_-]?key|token|https?:\/\/.*api/i;

// 黑名单扫描目标文件（组件入口 + 预览入口）
const BLACKLIST_TARGET_FILES = ["index.tsx", "preview.tsx"];

// tsc 错误行号解析正则：file(line,col): error TSxxxx: message
const TSC_ERROR_REGEX = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/;

// frontmatter 边界正则（文件开头 --- 包裹的 YAML 块）
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

// 单行 YAML key 解析（仅支持扁平 `key: value` 形式）
const YAML_KEY_REGEX = /^(\w+)\s*:\s*(.*)$/;

// ============================================================
// CLI 参数解析
// ============================================================

/**
 * 解析 CLI 参数。
 * @param argv - process.argv
 * @returns - 解析结果
 * @throws - 缺少 --component 时打印 help 并退出
 */
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { component: "" };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--component":
        args.component = next ?? "";
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[validate-component] 未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!args.component) {
    console.error("[validate-component] 缺少必填参数 --component");
    printHelp();
    process.exit(1);
  }
  return args;
}

/** 打印帮助信息到 stderr（不污染 stdout JSON 输出） */
function printHelp(): void {
  console.error(`
validate-component.ts - G1 静态校验

用法:
  npx tsx .trae/skills/component-validate/scripts/validate-component.ts --component "<组件目录>"

参数:
  --component <DIR>   必填，组件目录（如 library/react/ui-basic/button-glow/）
  -h, --help          显示帮助

校验项:
  1. TypeScript 编译（tsc --noEmit --skipLibCheck）
  2. meta.json Schema 校验（必填字段 + 枚举值 + tags 长度）
  3. card.md frontmatter 校验（必填字段）
  4. grep 黑名单扫描（console.log/debugger/api_key/token/http api）
  5. 依赖声明一致性（card.md ↔ meta.json ↔ package.json）
  6. 还原模式警示标注（rendered-dom/screenshot-restore 时 card.md 必须含"还原实现"）
  7. 真实源码留存校验（registry-source/pasted-code 时 _source/original-source.* 必须存在）

输出:
  stdout 末尾为纯 JSON 报告
`);
}

// ============================================================
// 工具：文件读取容错
// ============================================================

/**
 * 安全读取文件内容。
 * @param filePath - 文件绝对路径
 * @returns - 文件内容；读取失败返回 null
 */
function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * 安全读取并解析 JSON 文件。
 * @param filePath - 文件绝对路径
 * @returns - 解析后的对象；读取或解析失败返回 null
 */
function safeReadJson<T = unknown>(filePath: string): T | null {
  const content = safeReadFile(filePath);
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ============================================================
// 校验 1：TypeScript 编译
// ============================================================

/**
 * 收集组件目录下所有 .tsx 文件。
 * @param componentDir - 组件绝对路径
 * @returns - .tsx 文件绝对路径数组（可能为空）
 */
function collectTsxFiles(componentDir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(componentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
    .map((e) => path.join(componentDir, e.name));
}

/** tsc 执行结果：output 为原始输出，errorMessage 为调用本身失败时的错误 */
interface TscRunResult {
  output: string;
  errorMessage?: string;
}

/**
 * 执行 tsc 编译，返回原始输出。
 *   - 优先用 `-p tsconfig.json` 加载项目完整编译配置（jsx/paths/lib）
 *   - tsconfig 不存在时回退到传文件名 + --noEmit --skipLibCheck
 *   - 用 process.execPath 直接调 tsc.js，绕开 npx 在 Windows 下的 .cmd 兼容问题
 * @param tsxFiles - 待校验的 .tsx 文件绝对路径数组（仅回退模式使用）
 * @returns - tsc 原始输出与可能的调用错误
 */
function runTsc(tsxFiles: string[]): TscRunResult {
  let tscPath: string;
  try {
    tscPath = require.resolve("typescript/lib/tsc.js");
  } catch {
    return { output: "", errorMessage: "未找到 typescript 包，无法执行 tsc 校验" };
  }

  // -p 模式：让 tsconfig 的 include 决定编译范围，继承 jsx/paths/lib 配置
  // 回退模式：直接传文件名，不加载 tsconfig（jsx/paths 不生效，可能误报）
  const tscArgs = HAS_TSCONFIG
    ? [tscPath, "--noEmit", "--skipLibCheck", "-p", TSCONFIG_PATH]
    : [tscPath, "--noEmit", "--skipLibCheck", ...tsxFiles];

  try {
    const output = execFileSync(process.execPath, tscArgs, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    // tsc 报错时退出码非 0 会抛异常，但 stdout 仍含错误信息；仅当无输出时才算调用失败
    if (output.trim() === "") {
      return { output: "", errorMessage: `tsc 调用失败: ${e.message ?? "unknown error"}` };
    }
    return { output };
  }
}

/**
 * 从 tsc 输出解析组件目录相关的错误。
 *   - -p 模式下 tsc 会编译整个 include 范围，需过滤出组件目录内的错误
 *   - 回退模式下所有错误都来自传入的组件文件，无需过滤
 * @param output - tsc 原始输出
 * @param componentDir - 组件绝对路径
 * @returns - G1Error 数组
 */
function parseTscErrors(output: string, componentDir: string): G1Error[] {
  const errors: G1Error[] = [];
  const componentDirRel = path.relative(PROJECT_ROOT, componentDir).replace(/\\/g, "/");

  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(TSC_ERROR_REGEX);
    if (!match) continue;
    const [, file, lineStr, , message] = match;

    // -p 模式下过滤出组件目录内的错误，避免报告项目其它文件的错误
    if (HAS_TSCONFIG) {
      const relToRoot = path.relative(PROJECT_ROOT, file).replace(/\\/g, "/");
      if (!relToRoot.startsWith(componentDirRel + "/") && relToRoot !== componentDirRel) {
        continue;
      }
    }
    errors.push({
      type: "ts-compile",
      file: path.relative(componentDir, file).replace(/\\/g, "/"),
      line: parseInt(lineStr, 10),
      message: message.trim(),
    });
  }
  return errors;
}

/**
 * 校验 1：执行 tsc 编译并解析组件相关错误。
 * @param tsxFiles - 待校验的 .tsx 文件绝对路径数组
 * @param componentDir - 组件绝对路径（用于推算 file 字段相对路径）
 * @returns - G1Error 数组（每条 ts-compile 错误一条）
 */
function checkTsCompile(tsxFiles: string[], componentDir: string): G1Error[] {
  if (tsxFiles.length === 0) return [];

  const result = runTsc(tsxFiles);
  if (result.errorMessage) {
    return [{ type: "ts-compile", message: result.errorMessage }];
  }
  return parseTscErrors(result.output, componentDir);
}

// ============================================================
// 校验 2：meta.json Schema
// ============================================================

/**
 * 校验 meta.json Schema：必填字段 + 枚举值 + tags 长度。
 * @param componentDir - 组件绝对路径
 * @returns - G1Error 数组
 */
function checkMetaSchema(componentDir: string): G1Error[] {
  const metaPath = path.join(componentDir, "meta.json");
  const meta = safeReadJson<MetaJson>(metaPath);
  if (meta === null) {
    return [{ type: "meta-schema", message: "meta.json 读取或解析失败" }];
  }

  const errors: G1Error[] = [];

  // 必填字段检查
  const missing = META_REQUIRED_FIELDS.filter((f) => meta[f] === undefined || meta[f] === null);
  if (missing.length > 0) {
    errors.push({ type: "meta-schema", message: `缺少必填字段: ${missing.join(", ")}` });
  }

  // 枚举值检查（仅在字段存在时校验，避免与"缺失"重复报错）
  if (meta.techStack !== undefined && !TECH_STACK_VALUES.has(meta.techStack)) {
    errors.push({
      type: "meta-schema",
      message: `techStack 非法值: ${meta.techStack}（合法: ${[...TECH_STACK_VALUES].join("/")})`,
    });
  }
  if (meta.category !== undefined && !CATEGORY_VALUES.has(meta.category)) {
    errors.push({
      type: "meta-schema",
      message: `category 非法值: ${meta.category}（合法: ${[...CATEGORY_VALUES].join("/")})`,
    });
  }

  // sourceType 枚举校验（决定 G3 校验分级，必填且必须合法）
  if (meta.sourceType !== undefined && !SOURCE_TYPE_VALUES.has(meta.sourceType)) {
    errors.push({
      type: "meta-schema",
      message: `sourceType 非法值: ${meta.sourceType}（合法: ${[...SOURCE_TYPE_VALUES].join("/")})`,
    });
  }

  // tags 必须是数组且长度 >= 2
  if (meta.tags !== undefined) {
    if (!Array.isArray(meta.tags)) {
      errors.push({ type: "meta-schema", message: "tags 必须是数组" });
    } else if (meta.tags.length < MIN_TAGS_LENGTH) {
      errors.push({
        type: "meta-schema",
        message: `tags 长度不足: ${meta.tags.length}（最小 ${MIN_TAGS_LENGTH}）`,
      });
    }
  }

  return errors;
}

// ============================================================
// 校验 3：card.md frontmatter
// ============================================================

/**
 * 解析 card.md frontmatter（简单正则提取，不引额外依赖）。
 * @param content - card.md 文件内容
 * @returns - 字段键值对象；无 frontmatter 返回 null
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;
  const [, body] = match;
  const result: Record<string, string> = {};
  // 逐行解析 `key: value`，不支持嵌套（扁平结构足够覆盖入库产物）
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(YAML_KEY_REGEX);
    if (m) {
      const [, key, value] = m;
      result[key] = value.trim();
    }
  }
  return result;
}

/**
 * 校验 card.md frontmatter 必填字段。
 * @param componentDir - 组件绝对路径
 * @returns - G1Error 数组
 */
function checkCardFrontmatter(componentDir: string): G1Error[] {
  const cardPath = path.join(componentDir, "card.md");
  const content = safeReadFile(cardPath);
  if (content === null) {
    return [{ type: "card-frontmatter", message: "card.md 读取失败" }];
  }

  const frontmatter = parseFrontmatter(content);
  if (frontmatter === null) {
    return [{ type: "card-frontmatter", message: "card.md 缺少 frontmatter（--- 边界）" }];
  }

  // 仅检查字段是否存在（值的多行 YAML 格式不在简单正则范围内）
  const missing = CARD_REQUIRED_FIELDS.filter((f) => frontmatter[f] === undefined);
  if (missing.length > 0) {
    return [{ type: "card-frontmatter", message: `frontmatter 缺少字段: ${missing.join(", ")}` }];
  }
  return [];
}

// ============================================================
// 校验 4：grep 黑名单扫描
// ============================================================

/**
 * 扫描 index.tsx 和 preview.tsx 内容，命中黑名单正则即记录。
 * @param componentDir - 组件绝对路径
 * @returns - G1Error 数组（每条命中一条）
 */
function checkBlacklist(componentDir: string): G1Error[] {
  const errors: G1Error[] = [];
  for (const fileName of BLACKLIST_TARGET_FILES) {
    const filePath = path.join(componentDir, fileName);
    const content = safeReadFile(filePath);
    if (content === null) continue; // 文件不存在不算错误（preview.tsx 可能缺失）

    // 逐行扫描以推算行号
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(BLACKLIST_REGEX);
      if (match) {
        errors.push({
          type: "blacklist",
          file: fileName,
          line: i + 1,
          match: match[0],
        });
      }
    }
  }
  return errors;
}

// ============================================================
// 校验 5：依赖声明一致性
// ============================================================

/**
 * 比较两个 Set 内容是否一致（顺序无关）。
 * @param a - 集合 A
 * @param b - 集合 B
 * @returns - 一致返回 true
 */
function setEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

/**
 * 从 meta.json 提取 dependencies 字符串数组。
 * @param componentDir - 组件绝对路径
 * @returns - 依赖数组；读取失败或非数组返回 null
 */
function readMetaDeps(componentDir: string): string[] | null {
  const meta = safeReadJson<MetaJson>(path.join(componentDir, "meta.json"));
  if (meta === null) return null;
  if (!Array.isArray(meta.dependencies)) return null;
  return meta.dependencies.filter((d): d is string => typeof d === "string");
}

/**
 * 从 card.md frontmatter 提取 dependencies 字符串数组。
 * 兼容两种格式：`[a, b]` 数组字面量 或 `a, b` 逗号分隔。
 * @param componentDir - 组件绝对路径
 * @returns - 依赖数组；读取失败返回 null
 */
function readCardDeps(componentDir: string): string[] | null {
  const content = safeReadFile(path.join(componentDir, "card.md"));
  if (content === null) return null;
  const frontmatter = parseFrontmatter(content);
  if (frontmatter === null) return null;
  const raw = frontmatter.dependencies;
  if (raw === undefined) return null;

  // 兼容 `[a, b]` 与 `a, b` 两种形式
  const cleaned = raw.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (cleaned === "") return [];
  return cleaned.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * 读取项目已装依赖集合（dependencies + devDependencies）。
 * @returns - 已装依赖名集合；package.json 读取失败返回 null
 */
function readInstalledDeps(): Set<string> | null {
  const pkg = safeReadJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(path.join(PROJECT_ROOT, "package.json"));
  if (pkg === null) return null;
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
}

/**
 * 校验依赖声明一致性。
 *   - card.md 与 meta.json 不一致 → fail（deps-mismatch）
 *   - 声明了未安装依赖 → warn（deps-not-installed，仍记入 errors）
 * @param componentDir - 组件绝对路径
 * @returns - G1Error 数组
 */
function checkDepsConsistency(componentDir: string): G1Error[] {
  const errors: G1Error[] = [];
  const metaDeps = readMetaDeps(componentDir);
  const cardDeps = readCardDeps(componentDir);

  // 任一读取失败：交由前序校验项报错，此处跳过避免重复报错
  if (metaDeps === null || cardDeps === null) return errors;

  // 集合比较（顺序无关）
  const metaSet = new Set(metaDeps);
  const cardSet = new Set(cardDeps);
  if (!setEqual(metaSet, cardSet)) {
    errors.push({ type: "deps-mismatch", message: "card.md 与 meta.json 依赖声明不一致" });
  }

  // 已装依赖检查（package.json 读取失败时跳过此项）
  const installed = readInstalledDeps();
  if (installed !== null) {
    const declared = new Set([...metaDeps, ...cardDeps]);
    const notInstalled = [...declared].filter((d) => !installed.has(d));
    if (notInstalled.length > 0) {
      errors.push({
        type: "deps-not-installed",
        message: `依赖未安装: ${notInstalled.join(", ")}`,
      });
    }
  }
  return errors;
}

// ============================================================
// 校验 6：还原模式警示标注（仅 rendered-dom/screenshot-restore）
// ============================================================

/**
 * 还原模式（无真实源码）校验 card.md 是否包含"还原实现"警示标注。
 * 防止还原产物隐瞒风险等级，导致 G3/G4 误判为可信实现。
 * @param componentDir - 组件绝对路径
 * @param sourceType - meta.json 的 sourceType 字段值
 * @returns - G1Error 数组（非还原模式返回空数组）
 */
function checkRestoreWarning(componentDir: string, sourceType: string | undefined): G1Error[] {
  // 仅还原模式 sourceType 需要校验警示标注
  if (sourceType === undefined || !RESTORE_SOURCE_TYPES.has(sourceType)) {
    return [];
  }

  const cardPath = path.join(componentDir, "card.md");
  const content = safeReadFile(cardPath);
  if (content === null) {
    // card.md 读取失败已由 checkCardFrontmatter 报错，此处不重复报
    return [];
  }

  if (!content.includes(RESTORE_WARNING_KEYWORD)) {
    return [{
      type: "restore-warning",
      file: "card.md",
      message: `sourceType=${sourceType} 但 card.md 未含"${RESTORE_WARNING_KEYWORD}"警示标注`,
    }];
  }
  return [];
}

// ============================================================
// 校验 7：真实源码留存校验（仅 registry-source/pasted-code）
// ============================================================

/**
 * 有真实源码的 sourceType 校验 _source/original-source.* 是否存在。
 * 无真实源码则 G3 无法做实现保真度对比，校验失去意义。
 * @param componentDir - 组件绝对路径
 * @param sourceType - meta.json 的 sourceType 字段值
 * @returns - G1Error 数组（无源码模式返回空数组）
 */
function checkOriginalSource(componentDir: string, sourceType: string | undefined): G1Error[] {
  // 仅需要真实源码的 sourceType 才校验留存
  if (sourceType === undefined || !SOURCE_TYPES_WITH_ORIGINAL.has(sourceType)) {
    return [];
  }

  const sourceDir = path.join(componentDir, "_source");
  const exists = ORIGINAL_SOURCE_FILES.some((fileName) =>
    fs.existsSync(path.join(sourceDir, fileName))
  );

  if (!exists) {
    return [{
      type: "source-missing",
      message: `sourceType=${sourceType} 但 _source/ 下无 original-source.* 真实源码（G3 无法做实现保真度对比）`,
    }];
  }
  return [];
}

// ============================================================
// 主流程
// ============================================================

/**
 * 读取组件 ID（meta.json 失败时回退用目录名）。
 * @param componentDir - 组件绝对路径
 * @returns - 组件 ID
 */
function readComponentId(componentDir: string): string {
  const meta = safeReadJson<MetaJson>(path.join(componentDir, "meta.json"));
  if (meta !== null && typeof meta.id === "string" && meta.id.length > 0) {
    return meta.id;
  }
  return path.basename(componentDir);
}

/**
 * 读取组件 sourceType（meta.json 失败时回退为空串）。
 * sourceType 决定 G3 校验分级与 overall 判定，需透传到输出报告。
 * @param componentDir - 组件绝对路径
 * @returns - sourceType 字符串（未知时为 "unknown"）
 */
function readSourceType(componentDir: string): string {
  const meta = safeReadJson<MetaJson>(path.join(componentDir, "meta.json"));
  if (meta !== null && typeof meta.sourceType === "string" && meta.sourceType.length > 0) {
    return meta.sourceType;
  }
  return "unknown";
}

/**
 * 执行 G1 全部 7 项校验，组装结果。
 * @param componentDir - 组件绝对路径
 * @param componentDirArg - 传入的组件目录参数（用于输出 componentDir 字段）
 * @returns - 校验结果对象
 */
function runG1Validation(componentDir: string, componentDirArg: string): ValidateOutput {
  const tsxFiles = collectTsxFiles(componentDir);
  const sourceType = readSourceType(componentDir);
  console.error(`[validate-component] 发现 ${tsxFiles.length} 个 .tsx 文件，sourceType=${sourceType}`);

  // 顺序按 SKILL 规范：TS 编译 → meta Schema → card frontmatter → 黑名单 → 依赖一致性 → 还原警示 → 真实源码留存
  const errors: G1Error[] = [
    ...checkTsCompile(tsxFiles, componentDir),
    ...checkMetaSchema(componentDir),
    ...checkCardFrontmatter(componentDir),
    ...checkBlacklist(componentDir),
    ...checkDepsConsistency(componentDir),
    ...checkRestoreWarning(componentDir, sourceType),
    ...checkOriginalSource(componentDir, sourceType),
  ];

  return {
    componentId: readComponentId(componentDir),
    componentDir: componentDirArg,
    sourceType,
    g1: {
      pass: errors.length === 0,
      errors,
    },
  };
}

/**
 * 组件目录不存在时的兜底输出。
 * @param componentDirArg - 传入的组件目录参数
 * @param fallbackId - 回退用的组件 ID（目录名）
 */
function outputMissingDir(componentDirArg: string, fallbackId: string): void {
  const output: ValidateOutput = {
    componentId: fallbackId,
    componentDir: componentDirArg,
    sourceType: "unknown",
    g1: {
      pass: false,
      errors: [{ type: "meta-schema", message: `组件目录不存在: ${componentDirArg}` }],
    },
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

/**
 * 入口：解析参数 → 执行校验 → 输出 JSON 到 stdout。
 */
function main(): void {
  const args = parseArgs(process.argv);
  const componentDir = path.resolve(args.component);

  // 目录不存在直接输出 fail 报告，便于 AI 管道处理
  if (!fs.existsSync(componentDir)) {
    outputMissingDir(args.component, path.basename(componentDir));
    process.exit(0);
  }

  console.error(`[validate-component] 校验组件: ${args.component}`);
  const output = runG1Validation(componentDir, args.component);

  // stdout 末尾必须是纯 JSON（供 AI/脚本管道解析）
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  console.error(`[validate-component] G1.pass = ${output.g1.pass}（errors: ${output.g1.errors.length}）`);
}

main();
