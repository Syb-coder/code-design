/**
 * fetch-interactive.ts - 21st.dev 组件交互抓取脚本
 *
 * 职责：打开 21st.dev 页面，触发交互（点击下拉/hover 模型/切换配置），
 *      抓取每个交互状态的 DOM + 截图，供 AI 基于完整交互信息还原组件。
 *
 * 产出文件（写入 --out 目录）：
 *   - step-1-initial.html / .png       初始状态
 *   - step-2-dropdown.html / .png      点击模型按钮展开下拉
 *   - step-3-preview.html / .png       hover 模型项展开预览卡片
 *   - step-4-config.html / .png       切换 Reasoning/Speed 配置
 *   - step-5-search.html / .png       搜索框输入过滤
 *   - interactive-metadata.json       抓取元信息
 *
 * 用法：
 *   npx tsx .trae/skills/component-ingest/scripts/fetch-interactive.ts \
 *     --url "https://21st.dev/@dqnamo/components/model-selector" \
 *     --out "library/react/business/model-selector/_source/interactive/"
 */

import { chromium, type Browser, type Page, type Frame } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================
// 类型定义
// ============================================================

interface CliArgs {
  url: string;
  out: string;
  wait: number;
}

interface StepResult {
  step: string;
  html: string;
  png: string;
  note: string;
}

interface InteractiveMetadata {
  url: string;
  fetchedAt: string;
  steps: StepResult[];
  iframeUrl?: string;
  error?: string;
}

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { url: "", out: "", wait: 2500 };
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
      case "--wait":
        args.wait = parseInt(next, 10) || 2500;
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[fetch-interactive] 未知参数: ${arg}`);
        process.exit(1);
    }
  }
  if (!args.url || !args.out) {
    console.error("[fetch-interactive] 缺少必填参数 --url / --out");
    printHelp();
    process.exit(1);
  }
  return args;
}

function printHelp(): void {
  console.log(`
fetch-interactive.ts - 21st.dev 组件交互抓取（多状态 DOM + 截图）

用法:
  npx tsx .trae/skills/component-ingest/scripts/fetch-interactive.ts \\
    --url <URL> --out <DIR> [--wait <ms>]

必填:
  --url <URL>   21st.dev 组件页 URL
  --out <DIR>   输出目录

可选:
  --wait <ms>  页面加载等待（默认 2500ms）
`);
}

// ============================================================
// 核心抓取逻辑
// ============================================================

async function fetchInteractive(args: CliArgs): Promise<InteractiveMetadata> {
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const steps: StepResult[] = [];
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    console.log("[fetch-interactive] 访问:", args.url);
    const response = await page.goto(args.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || !response.ok()) {
      throw new Error(`页面响应异常: status=${response?.status() ?? "unknown"}`);
    }

    // 等待 iframe 注入 src（21st.dev 异步注入，fetch-source.ts 已修复）
    console.log("[fetch-interactive] 等待 cdn.21st.dev iframe 出现...");
    const iframeLoc = page.locator("iframe[src*='cdn.21st.dev']").first();
    await iframeLoc.waitFor({ state: "attached", timeout: 8000 });
    await page.waitForTimeout(args.wait);

    // 获取 iframe frame 对象
    const iframeElement = await iframeLoc.elementHandle();
    if (!iframeElement) throw new Error("iframe elementHandle 为空");
    const frame: Frame | null = await iframeElement.contentFrame();
    if (!frame) throw new Error("iframe contentFrame 为空，可能跨域被阻止");

    // 记录 iframe src
    const iframeSrc = await iframeLoc.getAttribute("src") || undefined;
    console.log("[fetch-interactive] iframe src:", iframeSrc);

    // 等待 iframe 内 #root 渲染
    await frame.waitForSelector("#root", { timeout: 8000 });
    await page.waitForTimeout(500);

    // === 步骤 1：初始状态 ===
    console.log("[fetch-interactive] 步骤 1：抓取初始状态");
    await saveStep(frame, page, iframeLoc, outDir, "step-1-initial", "初始状态（未交互）", steps);

    // === 步骤 2：点击模型选择按钮展开下拉 ===
    console.log("[fetch-interactive] 步骤 2：点击 combobox 按钮展开下拉");
    const comboboxBtn = frame.locator('button[role="combobox"]').first();
    if ((await comboboxBtn.count()) > 0) {
      await comboboxBtn.click();
      await page.waitForTimeout(800); // 等待下拉动画

      // 下拉弹层可能在 iframe 内或 body 末尾，都试抓
      await saveStep(frame, page, iframeLoc, outDir, "step-2-dropdown", "点击模型按钮展开下拉", steps);

      // === 步骤 3：hover 第二个模型项触发预览卡片 ===
      console.log("[fetch-interactive] 步骤 3：hover 模型项触发预览卡片");
      // 下拉列表项通常是 [role="option"] 或 div 含模型名
      const optionLocators = frame.locator('[role="option"], [data-option], li[role="option"]').or(
        frame.locator('div[class*="cursor-pointer"], div[class*="hover:bg"]')
      );
      const optionCount = await optionLocators.count();
      console.log(`[fetch-interactive] 探测到 ${optionCount} 个候选列表项`);
      if (optionCount >= 2) {
        await optionLocators.nth(1).hover();
        await page.waitForTimeout(800); // 等待预览卡片动画
        await saveStep(frame, page, iframeLoc, outDir, "step-3-preview", "hover 模型项展开预览卡片", steps);

        // === 步骤 4：切换 Reasoning/Speed 配置 ===
        console.log("[fetch-interactive] 步骤 4：切换 Reasoning 配置");
        // 预览卡片内应有 Reasoning 配置控件（segmented control 或 select）
        // 尝试点击 "High" 选项
        const highOption = frame.locator('button:has-text("High"), [role="radio"]:has-text("High"), div:has-text("High")').first();
        if ((await highOption.count()) > 0) {
          await highOption.click().catch(() => {});
          await page.waitForTimeout(600);
          await saveStep(frame, page, iframeLoc, outDir, "step-4-config", "切换 Reasoning=High 后 metric bars 变化", steps);
        } else {
          console.log("[fetch-interactive] 未找到 High 选项，跳过配置切换");
        }

        // === 步骤 5：搜索框输入过滤 ===
        console.log("[fetch-interactive] 步骤 5：搜索框输入过滤");
        const searchInput = frame.locator('input[placeholder*="Search" i], input[type="text"]').first();
        if ((await searchInput.count()) > 0) {
          await searchInput.fill("gpt");
          await page.waitForTimeout(500);
          await saveStep(frame, page, iframeLoc, outDir, "step-5-search", "搜索 'gpt' 过滤模型列表", steps);
        } else {
          console.log("[fetch-interactive] 未找到搜索框，跳过搜索步骤");
        }
      } else {
        console.log("[fetch-interactive] 未找到模型列表项，跳过 hover/搜索步骤");
      }
    } else {
      console.log("[fetch-interactive] 未找到 combobox 按钮，跳过交互步骤");
    }

    await context.close();

    const meta: InteractiveMetadata = {
      url: args.url,
      fetchedAt: new Date().toISOString(),
      steps,
      iframeUrl: iframeSrc,
    };

    const metaPath = path.join(outDir, "interactive-metadata.json");
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    console.log("[fetch-interactive] 完成，元信息:", metaPath);

    return meta;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fetch-interactive] 失败:", message);
    return {
      url: args.url,
      fetchedAt: new Date().toISOString(),
      steps,
      error: message,
    };
  } finally {
    if (browser) await browser.close();
  }
}

// ============================================================
// 单步抓取：iframe 内 #root DOM + iframe 元素截图
// ============================================================

async function saveStep(
  frame: Frame,
  page: Page,
  iframeLoc: ReturnType<Page["locator"]>,
  outDir: string,
  stepName: string,
  note: string,
  steps: StepResult[]
): Promise<void> {
  // 抓取 iframe 内完整 body（含 portal 渲染到 body 末尾的弹层：下拉/预览卡片）
  const html = await frame.locator("body").first().evaluate((el) => el.outerHTML);
  const htmlPath = path.join(outDir, `${stepName}.html`);
  fs.writeFileSync(htmlPath, html, "utf-8");

  // iframe 元素截图
  const pngPath = path.join(outDir, `${stepName}.png`);
  await iframeLoc.screenshot({ path: pngPath });

  steps.push({ step: stepName, html: htmlPath, png: pngPath, note });
  console.log(`[fetch-interactive]   → ${stepName}.html (${html.length} chars) / ${stepName}.png`);
}

// ============================================================
// 入口
// ============================================================

const args = parseArgs(process.argv);
fetchInteractive(args).catch((err) => {
  console.error("[fetch-interactive] 未捕获错误:", err);
  process.exit(1);
});
