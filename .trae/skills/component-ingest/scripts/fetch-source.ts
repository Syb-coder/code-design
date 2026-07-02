/**
 * fetch-source.ts - 单 URL 抓取脚本（Playwright 一次会话产出全套素材）
 *
 * 职责：
 *   1. 启动 Playwright 浏览器访问目标 URL
 *   2. 等待页面加载 + 动画起播（默认 1500ms）
 *   3. 产出素材到 --out 目录（详见下方"产出文件"）
 *   4. 21st.dev 专用分支：进入预览 iframe 抓取渲染后 DOM + 提取 demoCode + 依赖
 *
 * 21st.dev 架构说明（探测确认）：
 *   - 组件页是 Next.js App Router + RSC，实现源码不公开（/r/ registry API 需登录）
 *   - 页面含 <iframe src="https://cdn.21st.dev/.../bundle.xxx.html">，iframe 内是组件渲染结果
 *   - 页面 div.code-wrapper-vesper 内含 demoCode（调用示例，非组件实现）
 *   - 页面 <script type="application/ld+json"> 含组件元信息（name/description/author）
 *   - 抓取策略：抓渲染后 DOM + 截图 + demoCode + 元信息，AI 基于这些还原组件代码
 *
 * 产出文件：
 *   - original.html    组件 HTML（21st：iframe #root DOM；其它：组件容器或整页）
 *   - original.png     组件截图（21st：iframe 截图；其它：组件元素或整页）
 *   - demo-code.txt    调用示例代码（仅 21st.dev 模式产出）
 *   - network.json     网络请求日志
 *   - console.json     控制台日志
 *   - metadata.json    抓取元信息（URL/时间/captureMode/sourceType/dependencies/demoCode/jsonLd/registryHint）
 *
 * 归属：入库 Skill 调用（抓取是入库起点，校验 Skill 不抓取只校验）
 *
 * 用法：
 *   npx tsx .trae/skills/component-ingest/scripts/fetch-source.ts --url "<URL>" --out "<组件目录>/_source/"
 *   npx tsx .trae/skills/component-ingest/scripts/fetch-source.ts --url "<URL>" --out "<out>" --selector "<CSS>" --wait 2000
 *
 * 依赖：playwright、tsx（需先安装：npm i -D playwright tsx && npx playwright install chromium）
 */

import { chromium, type Browser, type Page, type Request, type ConsoleMessage, type Frame } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// 类型定义
// ============================================================

interface CliArgs {
  url: string;
  out: string;
  selector?: string;
  wait: number;
  viewport: { width: number; height: number };
}

interface NetworkLog {
  url: string;
  method: string;
  resourceType: string;
  status: number;
  headers: Record<string, string>;
  failed?: boolean;
  failureText?: string;
}

interface ConsoleLog {
  type: string;
  text: string;
  location: string;
}

/**
 * 抓取元信息
 * - captureMode: 抓取方式（21st-iframe / component / fullpage）
 * - sourceType: 素材类型（rendered-dom 渲染后DOM / source-code 源码）
 *   AI 根据 sourceType 决定后续处理：rendered-dom 需还原代码，source-code 可直接净化
 * - dependencies: 从 iframe script src 提取的组件依赖（仅 21st-iframe 模式）
 * - demoCode: 调用示例代码（仅 21st-iframe 模式）
 * - jsonLd: 从页面 JSON-LD 提取的组件元信息（仅 21st-iframe 模式）
 */
interface Metadata {
  url: string;
  finalUrl: string;
  title: string;
  fetchedAt: string;
  viewport: { width: number; height: number };
  waitMs: number;
  selector?: string;
  captureMode: "21st-iframe" | "component" | "fullpage";
  sourceType: "rendered-dom" | "source-code";
  dependencies?: string[];
  demoCode?: string;
  jsonLd?: object;
  /**
   * Registry 源码获取提示（仅 21st-iframe 模式产出）。
   * 21st.dev 渲染后 DOM 不含 JS 逻辑，AI 应优先按此提示跑 shadcn add 拿真实源码。
   * 值为完整的 npx 命令字符串，AI 可直接向用户展示并请求确认后执行。
   */
  registryHint?: string;
}

interface FetchResult {
  ok: boolean;
  outDir: string;
  files: string[];
  metadata: Metadata;
  error?: string;
}

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    url: "",
    out: "",
    wait: 1500,
    viewport: { width: 1280, height: 800 },
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--url":
        args.url = next;
        i++;
        break;
      case "--out":
        args.out = next;
        i++;
        break;
      case "--selector":
        args.selector = next;
        i++;
        break;
      case "--wait":
        args.wait = parseInt(next, 10) || 1500;
        i++;
        break;
      case "--width":
        args.viewport.width = parseInt(next, 10) || 1280;
        i++;
        break;
      case "--height":
        args.viewport.height = parseInt(next, 10) || 800;
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[fetch-source] 未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!args.url) {
    console.error("[fetch-source] 缺少必填参数 --url");
    printHelp();
    process.exit(1);
  }
  if (!args.out) {
    console.error("[fetch-source] 缺少必填参数 --out");
    printHelp();
    process.exit(1);
  }

  return args;
}

function printHelp(): void {
  console.log(`
fetch-source.ts - 抓取 URL 原始素材（Playwright 一次会话）

用法:
  npx tsx .trae/skills/component-ingest/scripts/fetch-source.ts --url <URL> --out <DIR> [options]

必填参数:
  --url <URL>         目标页面 URL
  --out <DIR>         输出目录（通常为 组件目录/_source/）

可选参数:
  --selector <CSS>    组件容器选择器（默认自动探测，仅对非 21st.dev 站点生效）
  --wait <ms>         页面加载后额外等待时长（默认 1500ms）
  --width <px>        视口宽度（默认 1280）
  --height <px>       视口高度（默认 800）

产出文件:
  original.html       组件 HTML（21st：渲染后 DOM；其它：组件容器或整页）
  original.png        组件截图
  demo-code.txt       调用示例代码（仅 21st.dev）
  network.json        网络请求日志
  console.json        控制台日志
  metadata.json       抓取元信息（含 captureMode/sourceType/dependencies）
`);
}

// ============================================================
// 核心抓取逻辑
// ============================================================

async function fetchSource(args: CliArgs): Promise<FetchResult> {
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const files: string[] = [];
  const networkLogs: NetworkLog[] = [];
  const consoleLogs: ConsoleLog[] = [];

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: args.viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // 注册网络/控制台日志监听（必须在 goto 前注册）
    page.on("request", (req: Request) => {
      networkLogs.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        status: 0,
        headers: req.headers(),
      });
    });
    page.on("response", async (res) => {
      const idx = networkLogs.findIndex((l) => l.url === res.url());
      if (idx >= 0) {
        networkLogs[idx].status = res.status();
      }
    });
    page.on("requestfailed", (req) => {
      const idx = networkLogs.findIndex((l) => l.url === req.url());
      if (idx >= 0) {
        networkLogs[idx].failed = true;
        networkLogs[idx].failureText = req.failure()?.errorText;
      }
    });
    page.on("console", (msg: ConsoleMessage) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location().url,
      });
    });
    page.on("pageerror", (err: Error) => {
      consoleLogs.push({
        type: "error",
        text: err.message,
        location: "",
      });
    });

    // 访问目标 URL（domcontentloaded 比 load 更稳健，SPA 常不触发 load）
    const response = await page.goto(args.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`页面响应异常: status=${response?.status() ?? "unknown"}`);
    }

    // 等待动画起播
    await page.waitForTimeout(args.wait);

    const finalUrl = page.url();
    const title = await page.title();

    // 探测/选择组件容器
    let selector = args.selector;
    // captureMode 优先级：21st.dev iframe > 用户/自动 selector > 整页
    let captureMode: Metadata["captureMode"] = "fullpage";
    // sourceType：21st 和整页兜底都是渲染后 DOM，只有用户明确提供 selector 且该容器是 <script>/<pre> 才算源码
    let sourceType: Metadata["sourceType"] = "rendered-dom";
    let dependencies: string[] | undefined;
    let demoCode: string | undefined;
    let jsonLd: object | undefined;

    // 优先尝试 21st.dev 专用分支：进入预览 iframe 抓取 #root DOM
    const is21st = /21st\.dev/.test(args.url);
    let st21Result: Awaited<ReturnType<typeof tryFetch21stIframe>>;
    if (is21st && !selector) {
      st21Result = await tryFetch21stIframe(page);
    } else {
      st21Result = undefined;
    }

    if (st21Result) {
      captureMode = "21st-iframe";
      sourceType = "rendered-dom";
      dependencies = st21Result.deps;
      demoCode = st21Result.demoCode;
      jsonLd = st21Result.jsonLd;
    } else {
      // 非 21st.dev 或 iframe 探测失败，回退到通用选择器逻辑
      if (!selector) {
        selector = await autoDetectSelector(page);
      }
      if (selector) {
        const exists = await page.locator(selector).count();
        if (exists > 0) {
          captureMode = "component";
          sourceType = "rendered-dom";
        } else {
          console.warn(`[fetch-source] 选择器 "${selector}" 未命中元素，回退到整页抓取`);
          selector = undefined;
        }
      }
    }

    // 1. 抓取 HTML
    let html: string;
    if (captureMode === "21st-iframe" && st21Result) {
      html = st21Result.html;
    } else if (selector) {
      html = await page.locator(selector).first().evaluate((el) => el.outerHTML);
    } else {
      html = await page.content();
    }
    const htmlPath = path.join(outDir, "original.html");
    fs.writeFileSync(htmlPath, html, "utf-8");
    files.push("original.html");

    // 2. 截图（21st.dev：iframe 元素截图；组件元素截图；或整页视口截图）
    const pngPath = path.join(outDir, "original.png");
    if (captureMode === "21st-iframe") {
      // 21st.dev：对 iframe 元素本身截图（含组件渲染结果）
      const iframeLoc = page.locator("iframe[src*='cdn.21st.dev']").first();
      const iframeCount = await iframeLoc.count();
      if (iframeCount > 0) {
        await iframeLoc.screenshot({ path: pngPath });
      } else {
        await page.screenshot({ path: pngPath, fullPage: false });
      }
    } else if (selector) {
      await page.locator(selector).first().screenshot({ path: pngPath });
    } else {
      await page.screenshot({ path: pngPath, fullPage: false });
    }
    files.push("original.png");

    // 3. demo-code.txt（仅 21st.dev 模式产出）
    if (demoCode) {
      const demoCodePath = path.join(outDir, "demo-code.txt");
      fs.writeFileSync(demoCodePath, demoCode, "utf-8");
      files.push("demo-code.txt");
    }

    // 4. 网络日志
    const networkPath = path.join(outDir, "network.json");
    fs.writeFileSync(networkPath, JSON.stringify(networkLogs, null, 2), "utf-8");
    files.push("network.json");

    // 5. 控制台日志
    const consolePath = path.join(outDir, "console.json");
    fs.writeFileSync(consolePath, JSON.stringify(consoleLogs, null, 2), "utf-8");
    files.push("console.json");

    // 6. 元信息
    // 21st-iframe 模式下填 registryHint，提示 AI 跑 shadcn add 拿真实源码
    let registryHint: string | undefined;
    if (captureMode === "21st-iframe") {
      // 从 https://21st.dev/@{author}/components/{slug} 提取 author/slug，拼 registry URL
      const match = args.url.match(/21st\.dev\/@([^/]+)\/components\/([^/?#]+)/);
      if (match) {
        const [, author, slug] = match;
        const registryUrl = `https://21st.dev/r/${author}/${slug}`;
        registryHint = `npx shadcn@latest add "${registryUrl}"`;
      }
    }

    const metadata: Metadata = {
      url: args.url,
      finalUrl,
      title,
      fetchedAt: new Date().toISOString(),
      viewport: args.viewport,
      waitMs: args.wait,
      selector: selector ?? undefined,
      captureMode,
      sourceType,
      dependencies,
      demoCode,
      jsonLd,
      registryHint,
    };
    const metaPath = path.join(outDir, "metadata.json");
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
    files.push("metadata.json");

    await context.close();

    return {
      ok: true,
      outDir,
      files,
      metadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      outDir,
      files,
      metadata: {
        url: args.url,
        finalUrl: "",
        title: "",
        fetchedAt: new Date().toISOString(),
        viewport: args.viewport,
        waitMs: args.wait,
        selector: args.selector,
        captureMode: "fullpage",
        sourceType: "rendered-dom",
      },
      error: message,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================
// 21st.dev 专用：进入预览 iframe 抓取组件渲染 DOM + demoCode + 元信息
// ============================================================

interface St21FetchResult {
  html: string;
  deps: string[];
  demoCode: string;
  jsonLd: object;
}

/**
 * 21st.dev 组件页结构（探测确认）：
 *   - 主页面含 <iframe src="https://cdn.21st.dev/.../bundle.xxx.html">，iframe 内是组件渲染结果
 *   - iframe 内 <div id="root"> 是组件渲染后的真实 DOM
 *   - iframe 内 <script src> 含组件依赖（如 three.js）
 *   - 主页面 div.code-wrapper-vesper 内含 demoCode（调用示例）
 *   - 主页面 <script type="application/ld+json"> 含组件元信息
 *
 * 注意：21st.dev 的组件实现源码不公开（/r/ registry API 需登录），
 *       本函数抓取的是渲染后 DOM，AI 需基于此还原组件代码。
 *
 * 返回 undefined 表示探测失败，调用方回退到通用选择器逻辑。
 */
async function tryFetch21stIframe(page: Page): Promise<St21FetchResult | undefined> {
  try {
    // === 1. 抓取 iframe 内 #root DOM（组件渲染结果）===
    // 21st.dev 的预览 iframe 是异步注入 src 的（初始 HTML 是空 <iframe>），
    // 不能用 .count() 立即判断，必须 waitFor 等待 src 出现（最多 8 秒）。
    const iframeLoc = page.locator("iframe[src*='cdn.21st.dev']").first();
    try {
      await iframeLoc.waitFor({ state: "attached", timeout: 8000 });
    } catch {
      console.warn("[fetch-source] 21st.dev 模式：8 秒内未出现 cdn.21st.dev iframe，回退通用逻辑");
      return undefined;
    }

    const iframeElement = await iframeLoc.elementHandle();
    if (!iframeElement) return undefined;
    const frame: Frame | null = await iframeElement.contentFrame();
    if (!frame) {
      console.warn("[fetch-source] 21st.dev 模式：无法进入 iframe，回退通用逻辑");
      return undefined;
    }

    // 等待 iframe 内 #root 渲染完成（组件挂载点）
    await frame.waitForSelector("#root", { timeout: 10000 });
    // 额外等待动画起播
    await page.waitForTimeout(500);

    // 抓取 #root 的 outerHTML（组件渲染后的真实 DOM，含内联样式）
    const html = await frame.evaluate(() => {
      const root = document.querySelector("#root");
      return root ? root.outerHTML : document.body.innerHTML;
    });

    // === 2. 从 iframe 内 script[src] 提取组件依赖（过滤掉平台分析脚本）===
    const deps = await frame.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script[src]"));
      return scripts
        .map((s) => s.getAttribute("src") || "")
        .filter((src) => {
          if (!src) return false;
          // 过滤掉平台分析/埋点脚本，只保留组件依赖
          if (/cloudflareinsights|beacon|analytics|gtm|googletagmanager/i.test(src)) return false;
          return true;
        });
    });

    // === 3. 从主页面 div.code-wrapper-vesper 提取 demoCode（调用示例）===
    const demoCode = await page
      .locator("div.code-wrapper-vesper")
      .first()
      .innerText()
      .catch(() => "");

    // === 4. 从主页面 JSON-LD 提取组件元信息 ===
    const jsonLdRaw = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .innerText()
      .catch(() => "{}");
    let jsonLd: object = {};
    try {
      jsonLd = JSON.parse(jsonLdRaw);
    } catch {
      // JSON-LD 解析失败不致命，继续流程
    }

    console.log(
      `[fetch-source] 21st.dev 模式成功：DOM ${html.length} 字符，依赖 ${deps.length} 个，demoCode ${demoCode.length} 字符`
    );
    return { html, deps, demoCode, jsonLd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[fetch-source] 21st.dev 模式探测失败：${message}，回退通用逻辑`);
    return undefined;
  }
}

// ============================================================
// 自动探测组件容器选择器（非 21st.dev 站点兜底）
// ============================================================

/**
 * 自动探测目标组件容器的 CSS 选择器。
 * 返回 undefined 表示探测失败，调用方回退到整页抓取。
 */
async function autoDetectSelector(page: Page): Promise<string | undefined> {
  // 平台专用选择器（按已知平台扩展）
  const platformSelectors = [
    '[data-component-root]',
    '[class*="PreviewFrame"]',
    '[class*="preview-frame"]',
    'div[class*="component-preview"]',
  ];
  for (const sel of platformSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      return sel;
    }
  }

  // 通用兜底：查找页面中最大的可见块（启发式，可能不准）
  const genericSelectors = ["main", "article", '[role="main"]'];
  for (const sel of genericSelectors) {
    const count = await page.locator(sel).count();
    if (count === 1) {
      return sel;
    }
  }

  return undefined;
}

// ============================================================
// 入口
// ============================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  console.log(`[fetch-source] 开始抓取: ${args.url}`);
  console.log(`[fetch-source] 输出目录: ${args.out}`);

  const result = await fetchSource(args);

  // 输出 JSON 结果到 stdout（供批量脚本解析）
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error(`[fetch-source] 抓取失败: ${result.error}`);
    process.exit(1);
  }

  console.error(`[fetch-source] 抓取成功，产出 ${result.files.length} 个文件`);
}

main().catch((err) => {
  console.error("[fetch-source] 未捕获异常:", err);
  process.exit(1);
});
