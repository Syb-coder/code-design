/**
 * screenshot-diff.ts - G2 渲染校验脚本
 *
 * 职责：
 *   1. Playwright 启动 chromium，访问沙箱路由渲染组件
 *   2. 检测 React error boundary 注入的 data-render-error 属性
 *   3. 截第一帧保存为 _source/rendered.png（起播帧，t=1.5s）
 *   4. 探测可交互元素（button/a/role=button 等），输出 interactiveElements 供 G3 检查交互完整性
 *   5. 再等待截第二帧保存为 _source/rendered-stable.png（稳定帧，t=3s），捕捉动画轨迹/状态切换
 *   6. 若存在 _source/original.png，与 rendered.png 做 pixelmatch 像素对比
 *   7. 无 original.png 时退化为"仅渲染不报错即通过"模式
 *   8. 输出 JSON 报告到 stdout（进度日志走 stderr）
 *
 * 设计说明：
 *   沙箱路由 /__sandbox__/:id 由预览应用提供，纯白背景无 chrome。
 *   React error boundary 在捕获渲染异常时向根元素注入 data-render-error 属性，
 *   脚本据此判定渲染失败，无需解析控制台日志或异常堆栈。
 *   多帧截图 + 交互探测为 G3 实现保真度检查提供证据（V1 教训：单帧截图无法发现
 *   还原版漏掉登录/注册切换按钮、动画类型偏离真实实现等问题）。
 *
 * 归属：G2 渲染校验脚本，由校验 Skill 调用
 *
 * 用法：
 *   npx tsx .trae/skills/component-validate/scripts/screenshot-diff.ts \
 *     --component "library/react/ui-basic/button-glow" \
 *     --preview-url "http://localhost:5173/__sandbox__/<id>"
 *
 * 依赖：playwright、pixelmatch、pngjs
 */

import { chromium, type Browser, type Page } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 常量（提取魔法值，统一管理）
// ============================================================

// 脚本位于 .trae/skills/component-validate/scripts/，向上 4 级回到项目根
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
// 视口尺寸：1280×800 覆盖主流桌面分辨率，保证组件渲染完整性
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
// 动画起播等待：1.5s 覆盖多数 CSS 过渡/进出场动画，避免截到空白帧
const ANIMATION_WAIT_MS = 1500;
// 稳定帧额外等待：起播帧后再等 1.5s 截第二帧，捕捉动画轨迹/状态切换
const STABLE_FRAME_WAIT_MS = 1500;
// 相似度阈值：经验值，过低漏检、过高误报，可通过 --threshold 覆盖
const DEFAULT_THRESHOLD = 0.7;
// 默认预览应用基址
const DEFAULT_PREVIEW_BASE_URL = "http://localhost:5173";
// 沙箱路由前缀
const SANDBOX_ROUTE_PREFIX = "/__sandbox__/";
// _source 目录下约定的文件名
const ORIGINAL_PNG = "original.png";
const RENDERED_PNG = "rendered.png";
const RENDERED_STABLE_PNG = "rendered-stable.png";
const DIFF_PNG = "diff.png";
// 沙箱路由 error boundary 注入的渲染错误属性名
const RENDER_ERROR_ATTR = "data-render-error";
// 可交互元素选择器：用于 G3 检查还原版是否实现了真实源码的所有交互入口
const INTERACTIVE_SELECTOR = "button, a, input[type=submit], input[type=button], [role=button], [role=switch], [role=tab]";

// ============================================================
// 类型定义
// ============================================================

/** 可交互元素探测结果（供 G3 检查还原版是否实现真实源码的所有交互入口） */
interface InteractiveElement {
  tag: string;
  text: string;
  role: string;
}

interface CliArgs {
  component: string;
  previewUrl?: string;
  threshold: number;
}

interface ValidationContext {
  componentId: string;
  componentAbsDir: string;
  componentRelDir: string;
  sourceDir: string;
  originalPath: string;
  renderedPath: string;
  renderedStablePath: string;
  diffPath: string;
  mode: "compare" | "render-only";
  previewUrl: string;
  threshold: number;
}

interface G2Report {
  pass: boolean;
  renderError: boolean;
  renderedPath?: string;
  renderedStablePath?: string;
  interactiveElements?: InteractiveElement[];
  mode: "compare" | "render-only";
  similarity?: number;
  diffPath?: string;
  sizeMismatch?: boolean;
  errorMessage?: string;
}

interface ScriptResult {
  componentId: string;
  componentDir: string;
  g2: G2Report;
}

// ============================================================
// CLI 参数解析
// ============================================================

/**
 * 解析命令行参数。
 * @param argv - process.argv 完整参数数组
 * @returns 解析后的参数对象
 * @throws 缺少必填 --component 时退出进程
 */
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    component: "",
    threshold: DEFAULT_THRESHOLD,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--component":
        args.component = nextArg(arg, next);
        i++;
        break;
      case "--preview-url":
        args.previewUrl = nextArg(arg, next);
        i++;
        break;
      case "--threshold":
        args.threshold = parseThreshold(nextArg(arg, next));
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[screenshot-diff] 未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!args.component) {
    console.error("[screenshot-diff] 缺少必填参数 --component <组件目录>");
    printHelp();
    process.exit(1);
  }

  return args;
}

/**
 * 取下一个参数值，缺失则退出。
 * @param flag - 当前参数名（用于报错提示）
 * @param next - 下一个 argv 值（可能 undefined）
 * @returns 参数值
 */
function nextArg(flag: string, next: string | undefined): string {
  if (!next) {
    console.error(`[screenshot-diff] ${flag} 需要一个参数值`);
    process.exit(1);
  }
  return next;
}

/**
 * 解析相似度阈值，必须为 0~1 之间的数值。
 * @param raw - 原始字符串
 * @returns 阈值
 * @throws 非法数值时退出进程
 */
function parseThreshold(raw: string): number {
  const val = Number(raw);
  if (Number.isNaN(val) || val < 0 || val > 1) {
    console.error(`[screenshot-diff] --threshold 必须为 0~1 之间的数值，得到: ${raw}`);
    process.exit(1);
  }
  return val;
}

function printHelp(): void {
  console.log(`
screenshot-diff.ts - G2 渲染校验（Playwright 截图 + pixelmatch 双图对比）

用法:
  npx tsx .trae/skills/component-validate/scripts/screenshot-diff.ts --component <组件目录> [options]

必填参数:
  --component <路径>       组件目录（如 library/react/ui-basic/button-glow）

可选参数:
  --preview-url <URL>      沙箱路由完整 URL（不传则根据 meta.json id 拼接）
  --threshold <number>     相似度阈值，默认 0.7
  --help, -h               显示帮助

前置条件:
  预览应用 dev server 运行中（npm run dev），沙箱路由 /__sandbox__/:id 可访问

产出:
  <组件目录>/_source/rendered.png         本地渲染截图（起播帧）
  <组件目录>/_source/rendered-stable.png  本地渲染截图（稳定帧，供 G3 分析动画/状态切换）
  <组件目录>/_source/diff.png             像素差异图（仅 compare 模式）

输出:
  stdout 末尾为纯 JSON 报告，进度日志走 stderr
`);
}

// ============================================================
// 组件元信息与上下文
// ============================================================

/**
 * 解析组件目录为绝对路径并校验存在性。
 * @param componentArg - --component 原始参数（相对或绝对路径）
 * @returns 组件目录绝对路径
 * @throws 目录不存在时退出进程
 */
function resolveComponentDir(componentArg: string): string {
  const absDir = path.isAbsolute(componentArg)
    ? componentArg
    : path.resolve(PROJECT_ROOT, componentArg);
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    console.error(`[screenshot-diff] 组件目录不存在: ${absDir}`);
    process.exit(1);
  }
  return absDir;
}

/**
 * 读取组件 meta.json 的 id 字段，失败回退到目录名。
 * @param componentAbsDir - 组件绝对路径
 * @returns componentId
 */
function resolveComponentId(componentAbsDir: string): string {
  try {
    const metaPath = path.join(componentAbsDir, "meta.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { id?: string };
    if (meta.id && meta.id.length > 0) return meta.id;
  } catch {
    // meta.json 不存在或解析失败，回退到目录名
  }
  return path.basename(componentAbsDir);
}

/**
 * 解析沙箱路由 URL：优先用 --preview-url，否则用 componentRelDir 拼接默认基址。
 *
 * 用 componentRelDir（相对路径，如 library/react/ui-basic/button-glow）而非 componentId，
 * 因为 SandboxPage 用 react-router splat 匹配 import.meta.glob 扫描 library 下所有 preview.tsx 的 key，
 * key 格式为 /library/react/ui-basic/button-glow/preview.tsx，需要原始斜杠分隔符。
 * 不 encodeURIComponent，否则斜杠被编码为 %2F，splat 无法正确匹配。
 *
 * @param args - CLI 参数
 * @param componentRelDir - 组件相对项目根的路径（正斜杠分隔）
 * @returns 沙箱路由完整 URL
 */
function resolvePreviewUrl(args: CliArgs, componentRelDir: string): string {
  if (args.previewUrl) return args.previewUrl;
  // 不编码 componentRelDir，保留 / 供 react-router splat 匹配
  return `${DEFAULT_PREVIEW_BASE_URL}${SANDBOX_ROUTE_PREFIX}${componentRelDir}`;
}

/**
 * 确保 _source 目录存在并返回其绝对路径。
 * @param componentAbsDir - 组件绝对路径
 * @returns _source 目录绝对路径
 */
function ensureSourceDir(componentAbsDir: string): string {
  const sourceDir = path.join(componentAbsDir, "_source");
  fs.mkdirSync(sourceDir, { recursive: true });
  return sourceDir;
}

/**
 * 将绝对路径转为相对项目根的路径（正斜杠，跨平台一致）。
 * @param absPath - 绝对路径
 * @returns 相对项目根的路径
 */
function toRelPath(absPath: string): string {
  return path.relative(PROJECT_ROOT, absPath).replace(/\\/g, "/");
}

/**
 * 组装校验上下文：解析路径、判定模式、拼接预览 URL。
 * @param args - CLI 参数
 * @returns 校验上下文
 */
function prepareContext(args: CliArgs): ValidationContext {
  const componentAbsDir = resolveComponentDir(args.component);
  const componentId = resolveComponentId(componentAbsDir);
  const componentRelDir = toRelPath(componentAbsDir);
  const sourceDir = ensureSourceDir(componentAbsDir);
  const originalPath = path.join(sourceDir, ORIGINAL_PNG);
  const renderedPath = path.join(sourceDir, RENDERED_PNG);
  const renderedStablePath = path.join(sourceDir, RENDERED_STABLE_PNG);
  const diffPath = path.join(sourceDir, DIFF_PNG);
  // 模式由 original.png 是否存在决定：有则双图对比，无则仅渲染校验
  const mode: "compare" | "render-only" = fs.existsSync(originalPath) ? "compare" : "render-only";
  // 用 componentRelDir 拼 URL（匹配 SandboxPage 的 import.meta.glob key），componentId 仅用于报告
  const previewUrl = resolvePreviewUrl(args, componentRelDir);
  return {
    componentId,
    componentAbsDir,
    componentRelDir,
    sourceDir,
    originalPath,
    renderedPath,
    renderedStablePath,
    diffPath,
    mode,
    previewUrl,
    threshold: args.threshold,
  };
}

// ============================================================
// 渲染校验主流程
// ============================================================

/**
 * G2 渲染校验主入口：启动浏览器 → 渲染 → 截图 → 对比 → 输出结果。
 * 所有异常均被捕获，绝不向上抛出，保证始终输出合法 JSON。
 * @param args - CLI 参数
 * @returns 校验结果（始终返回，不抛出）
 */
async function runValidation(args: CliArgs): Promise<ScriptResult> {
  const ctx = prepareContext(args);
  console.error(`[screenshot-diff] 组件: ${ctx.componentId} (${ctx.componentRelDir})`);
  console.error(`[screenshot-diff] 模式: ${ctx.mode}`);
  console.error(`[screenshot-diff] 沙箱路由: ${ctx.previewUrl}`);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    });
    return await validatePage(page, ctx);
  } catch (e) {
    // 导航/截图/对比失败统一归为 infra fail，附带 errorMessage
    return buildInfraFailResult(ctx, formatError(e));
  } finally {
    // 必须释放浏览器，避免进程残留（finally 确保异常路径也释放）
    await safeCloseBrowser(browser);
  }
}

/**
 * 在已打开的页面上执行渲染校验子流程。
 * @param page - Playwright Page 实例
 * @param ctx - 校验上下文
 * @returns 校验结果
 * @throws 导航/截图/对比失败时抛出（由上层 catch 转为 infra fail）
 */
async function validatePage(page: Page, ctx: ValidationContext): Promise<ScriptResult> {
  // 访问沙箱路由；用 domcontentloaded 而非 networkidle，避免 Vite HMR websocket 导致永不空闲
  try {
    await page.goto(ctx.previewUrl, { waitUntil: "domcontentloaded" });
  } catch (e) {
    throw new Error(`页面导航失败: ${formatError(e)}`);
  }

  // 等待动画起播，覆盖 React 挂载 + CSS 过渡，避免截到空白/过渡帧
  await page.waitForTimeout(ANIMATION_WAIT_MS);

  // 检测 error boundary 注入的 data-render-error，命中即渲染失败
  const renderError = await detectRenderError(page);
  if (renderError) {
    console.error(`[screenshot-diff] 检测到渲染错误: ${renderError}`);
    return buildRenderErrorResult(ctx, renderError);
  }

  // 截第一帧保存为 rendered.png（起播帧）
  try {
    await page.screenshot({ path: ctx.renderedPath });
  } catch (e) {
    throw new Error(`截图失败: ${formatError(e)}`);
  }
  console.error(`[screenshot-diff] 起播帧已保存: ${toRelPath(ctx.renderedPath)}`);

  // 探测可交互元素（供 G3 检查还原版是否实现真实源码的所有交互入口）
  const interactiveElements = await detectInteractiveElements(page);
  console.error(`[screenshot-diff] 探测到 ${interactiveElements.length} 个可交互元素`);

  // 再等待截稳定帧（捕捉动画轨迹/状态切换），失败不阻断主流程（属辅助证据）
  try {
    await page.waitForTimeout(STABLE_FRAME_WAIT_MS);
    await page.screenshot({ path: ctx.renderedStablePath });
    console.error(`[screenshot-diff] 稳定帧已保存: ${toRelPath(ctx.renderedStablePath)}`);
  } catch {
    console.error(`[screenshot-diff] 稳定帧截图失败，跳过（不影响主校验）`);
  }

  // compare 模式做双图对比；render-only 模式仅渲染不报错即通过
  if (ctx.mode === "compare") {
    return runCompare(ctx, interactiveElements);
  }
  return buildRenderOnlyResult(ctx, interactiveElements);
}

/**
 * 检测页面渲染错误：沙箱 error boundary 在捕获异常时注入 data-render-error。
 * @param page - Playwright Page 实例
 * @returns 错误信息字符串（无错误时返回 null）
 */
async function detectRenderError(page: Page): Promise<string | null> {
  // data-render-error 注入到 body 或根元素，querySelector 全局查找即可覆盖
  return await page.evaluate((attr) => {
    const el = document.querySelector(`[${attr}]`);
    // 属性值为空时回退为占位文案，保证 errorMessage 非空
    return el ? (el.getAttribute(attr) || "unknown render error") : null;
  }, RENDER_ERROR_ATTR);
}

/**
 * 探测页面可交互元素（button/a/submit/role=button 等）。
 * 供 G3 检查"真实源码有的交互入口，还原版是否也实现"——
 * V1 教训：还原版漏掉登录/注册切换按钮，但 G2 单帧截图无法发现。
 * @param page - Playwright Page 实例
 * @returns - 可交互元素清单（tag/text/role）
 */
async function detectInteractiveElements(page: Page): Promise<InteractiveElement[]> {
  return await page.evaluate((selector) => {
    const els = Array.from(document.querySelectorAll(selector));
    return els.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim().slice(0, 50),
      role: el.getAttribute("role") || el.getAttribute("type") || "",
    }));
  }, INTERACTIVE_SELECTOR);
}

/**
 * 执行双图像素对比。
 * @param ctx - 校验上下文
 * @param interactiveElements - G2 探测的可交互元素清单（透传给报告）
 * @returns compare 模式结果
 * @throws 图片读取/对比失败时抛出
 */
function runCompare(ctx: ValidationContext, interactiveElements: InteractiveElement[]): ScriptResult {
  try {
    const { similarity, sizeMismatch } = compareImages(
      ctx.originalPath,
      ctx.renderedPath,
      ctx.diffPath
    );
    console.error(
      `[screenshot-diff] 相似度: ${similarity.toFixed(4)} (阈值 ${ctx.threshold})` +
        (sizeMismatch ? " [尺寸不一致已裁剪]" : "")
    );
    return buildCompareResult(ctx, similarity, sizeMismatch, interactiveElements);
  } catch (e) {
    throw new Error(`双图对比失败: ${formatError(e)}`);
  }
}

// ============================================================
// 像素对比（pngjs + pixelmatch）
// ============================================================

/**
 * 读取 PNG 文件为 pngjs PNG 对象。
 * @param filePath - 文件绝对路径
 * @returns PNG 实例
 * @throws 文件不存在或解析失败时抛出
 */
function readPng(filePath: string): PNG {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

/**
 * 将 PNG 裁剪到指定宽高（返回新 PNG，不修改原图）。
 * @param src - 源 PNG
 * @param width - 目标宽（必须 <= src.width）
 * @param height - 目标高（必须 <= src.height）
 * @returns 裁剪后的新 PNG
 */
function cropPng(src: PNG, width: number, height: number): PNG {
  const dst = new PNG({ width, height });
  // 逐行拷贝像素数据，按行 copy 避免跨缓冲区操作
  for (let y = 0; y < height; y++) {
    const srcStart = y * src.width * 4;
    const dstStart = y * width * 4;
    src.data.copy(dst.data, dstStart, srcStart, srcStart + width * 4);
  }
  return dst;
}

/**
 * 对比两张 PNG 的像素差异，输出 diff.png 并计算相似度。
 * 尺寸不一致时以较小宽高裁剪后再对比。
 * @param originalPath - 原始图绝对路径
 * @param renderedPath - 渲染图绝对路径
 * @param diffPath - 差异图输出绝对路径
 * @returns 相似度（0~1）与是否发生尺寸裁剪
 * @throws 图片尺寸为 0 或读取失败时抛出
 */
function compareImages(
  originalPath: string,
  renderedPath: string,
  diffPath: string
): { similarity: number; sizeMismatch: boolean } {
  let imgA = readPng(originalPath);
  let imgB = readPng(renderedPath);

  // 防御零尺寸图片导致后续 totalPixels 除零
  if (imgA.width === 0 || imgA.height === 0 || imgB.width === 0 || imgB.height === 0) {
    throw new Error("图片尺寸为 0，无法对比");
  }

  // pixelmatch 要求两张图等尺寸，不等则以较小宽高裁剪
  let sizeMismatch = false;
  const minWidth = Math.min(imgA.width, imgB.width);
  const minHeight = Math.min(imgA.height, imgB.height);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    sizeMismatch = true;
    imgA = cropPng(imgA, minWidth, minHeight);
    imgB = cropPng(imgB, minWidth, minHeight);
  }

  const diffPng = new PNG({ width: minWidth, height: minHeight });
  // pixelmatch 返回差异像素数，第 4~5 参数为宽高
  const diffPixels = pixelmatch(imgA.data, imgB.data, diffPng.data, minWidth, minHeight);
  const totalPixels = minWidth * minHeight;
  // 相似度 = 1 - 差异像素占比
  const similarity = 1 - diffPixels / totalPixels;

  // 写出差异图，供 G4 人工确认查看
  fs.writeFileSync(diffPath, PNG.sync.write(diffPng));
  return { similarity, sizeMismatch };
}

// ============================================================
// 报告构建
// ============================================================

/**
 * 构建渲染错误（data-render-error）的失败报告。
 * @param ctx - 校验上下文
 * @param errorMessage - error boundary 注入的错误信息
 * @returns 失败结果
 */
function buildRenderErrorResult(ctx: ValidationContext, errorMessage: string): ScriptResult {
  return {
    componentId: ctx.componentId,
    componentDir: ctx.componentRelDir,
    g2: {
      pass: false,
      renderError: true,
      mode: ctx.mode,
      errorMessage,
    },
  };
}

/**
 * 构建基础设施失败（导航/截图/对比异常）的报告。
 * @param ctx - 校验上下文
 * @param errorMessage - 异常信息
 * @returns 失败结果
 */
function buildInfraFailResult(ctx: ValidationContext, errorMessage: string): ScriptResult {
  return {
    componentId: ctx.componentId,
    componentDir: ctx.componentRelDir,
    g2: {
      pass: false,
      renderError: false,
      mode: ctx.mode,
      errorMessage,
    },
  };
}

/**
 * 构建 compare 模式报告（pass = similarity >= threshold）。
 * @param ctx - 校验上下文
 * @param similarity - 相似度
 * @param sizeMismatch - 是否发生尺寸裁剪
 * @param interactiveElements - G2 探测的可交互元素清单
 * @returns 校验结果
 */
function buildCompareResult(
  ctx: ValidationContext,
  similarity: number,
  sizeMismatch: boolean,
  interactiveElements: InteractiveElement[]
): ScriptResult {
  const g2: G2Report = {
    pass: similarity >= ctx.threshold,
    renderError: false,
    similarity: roundSimilarity(similarity),
    diffPath: toRelPath(ctx.diffPath),
    renderedPath: toRelPath(ctx.renderedPath),
    interactiveElements,
    mode: "compare",
  };
  // 稳定帧仅在文件存在时输出路径（截图失败时不输出，避免误导 G3）
  if (fs.existsSync(ctx.renderedStablePath)) {
    g2.renderedStablePath = toRelPath(ctx.renderedStablePath);
  }
  // 仅在尺寸裁剪时记录 sizeMismatch 字段
  if (sizeMismatch) {
    g2.sizeMismatch = true;
  }
  return { componentId: ctx.componentId, componentDir: ctx.componentRelDir, g2 };
}

/**
 * 构建 render-only 模式报告（pass = !renderError，无相似度字段）。
 * @param ctx - 校验上下文
 * @param interactiveElements - G2 探测的可交互元素清单
 * @returns 通过结果
 */
function buildRenderOnlyResult(ctx: ValidationContext, interactiveElements: InteractiveElement[]): ScriptResult {
  const g2: G2Report = {
    pass: true,
    renderError: false,
    renderedPath: toRelPath(ctx.renderedPath),
    interactiveElements,
    mode: "render-only",
  };
  // 稳定帧仅在文件存在时输出路径（截图失败时不输出，避免误导 G3）
  if (fs.existsSync(ctx.renderedStablePath)) {
    g2.renderedStablePath = toRelPath(ctx.renderedStablePath);
  }
  return { componentId: ctx.componentId, componentDir: ctx.componentRelDir, g2 };
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 安全关闭浏览器，忽略关闭异常以免掩盖原始错误。
 * @param browser - 浏览器实例（可能为 null）
 */
async function safeCloseBrowser(browser: Browser | null): Promise<void> {
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    // 关闭失败忽略，避免掩盖原始错误
  }
}

/**
 * 格式化异常为字符串。
 * @param e - 异常对象（类型未知）
 * @returns 错误信息字符串
 */
function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * 相似度四舍五入到 4 位小数。
 * @param val - 原始相似度
 * @returns 四舍五入后的相似度
 */
function roundSimilarity(val: number): number {
  return Math.round(val * 10000) / 10000;
}

// ============================================================
// 入口
// ============================================================

/**
 * 主入口：解析参数 → 执行校验 → 输出 JSON。
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const result = await runValidation(args);
  // stdout 末尾必须是纯 JSON，进度日志全部走 stderr
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((e) => {
  // 兜底：未捕获异常也输出 fail JSON，绝不让脚本崩溃
  const fallback: ScriptResult = {
    componentId: "unknown",
    componentDir: "unknown",
    g2: {
      pass: false,
      renderError: false,
      mode: "render-only",
      errorMessage: `未捕获异常: ${formatError(e)}`,
    },
  };
  process.stdout.write(JSON.stringify(fallback, null, 2) + "\n");
});
