/**
 * fetch-model-metrics.ts - 21st.dev model-selector 模型 metrics 真实抓取脚本
 *
 * 职责：打开 21st.dev model-selector 页面，依次 hover 每个模型列表项，
 *      从预览卡片（portal 渲染到 iframe body 末尾）的 aria-label 读取
 *      metric bars 真实数据：Intelligence/Speed/Context/Cost 的 0-10 值。
 *      同时抓取 Context 的 ⓘ title（context window）和 Cost 的 ⓘ title（价格）。
 *
 * 用法：
 *   npx tsx .trae/skills/component-ingest/scripts/fetch-model-metrics.ts
 *
 * 输出：stdout 打印 JSON（用 ===METRICS_JSON_BEGIN/END=== 标记包裹）。
 *      进度日志走 stderr，不污染 JSON 输出。
 */

import { chromium, type Browser, type Frame } from "playwright";

// ============================================================
// 类型定义
// ============================================================

interface ModelMetrics {
  intelligence: number; // 0-10
  speed: number;        // 0-10
  context: number;      // 0-10
  cost: number;         // 0-10
}

interface ModelInfo {
  label: string;
  metrics: ModelMetrics;
  contextWindow: string;      // 简短格式，如 "1M ctx"
  contextWindowRaw: string;   // 原始 title，如 "1M tokens context window"
  costInfo: string;           // 如 "$12.50 / 1M input · $50.00 / 1M output"
  description: string;
}

// ============================================================
// 常量
// ============================================================

const TARGET_URL = "https://21st.dev/@dqnamo/components/model-selector";
const METRIC_KEYS: (keyof ModelMetrics)[] = ["intelligence", "speed", "context", "cost"];
const EXPECTED_MODELS = 4;

// ============================================================
// 工具函数
// ============================================================

/**
 * 将 context window 原始 title 转换为简短格式
 * "1M tokens context window"  → "1M ctx"
 * "200K tokens context window" → "200K ctx"
 * 未匹配则原样返回。
 */
function formatContextWindow(raw: string): string {
  const m = raw.match(/^([\d.]+\s*[KMB]?)\s*tokens?\s*context\s*window$/i);
  return m ? `${m[1].trim()} ctx` : raw;
}

// ============================================================
// 核心：从 iframe 预览卡片提取模型信息
// ============================================================

/**
 * 在 iframe 内查找预览卡片根容器（含 4 个 metric bars 的 portal）
 * 约定：metric bars 元素带 aria-label="X: N out of 10"。
 */
async function extractPreviewInfo(frame: Frame): Promise<ModelInfo> {
  return frame.evaluate((metricKeys: string[]) => {
    const metricEls = Array.from(document.querySelectorAll('[aria-label*="out of 10"]'));
    if (metricEls.length !== 4) {
      throw new Error(`metric bars 数量异常: ${metricEls.length}（期望 4）`);
    }

    // 向上找到最近的 data-base-ui-portal 祖先（预览卡片 portal）
    let portalRoot: HTMLElement | null = metricEls[0] as HTMLElement;
    while (portalRoot && !portalRoot.hasAttribute("data-base-ui-portal")) {
      portalRoot = portalRoot.parentElement;
    }
    if (!portalRoot) {
      portalRoot = metricEls[0].closest("div[data-open]") as HTMLElement | null;
    }
    if (!portalRoot) throw new Error("未找到预览卡片根容器");

    // 解析 4 个 metric 值
    const metrics: Record<string, number> = {};
    for (const el of metricEls) {
      const label = el.getAttribute("aria-label") || "";
      const m = label.match(/^([A-Za-z]+):\s*(\d+)\s*out of\s*(\d+)$/);
      if (!m) throw new Error(`aria-label 格式异常: ${label}`);
      metrics[m[1].toLowerCase()] = parseInt(m[2], 10);
    }

    // 模型名（预览卡片内 p.font-medium.text-neutral-900）
    const labelEl = portalRoot.querySelector("p.font-medium.text-neutral-900");
    const label = (labelEl?.textContent || "").trim();

    // 描述（p.text-pretty.text-neutral-500）
    const descEl = portalRoot.querySelector("p.text-pretty.text-neutral-500");
    const description = (descEl?.textContent || "").trim();

    // Context / Cost 的 ⓘ title
    let contextWindowRaw = "";
    let costInfo = "";
    const infoIcons = portalRoot.querySelectorAll("span[title]");
    for (const icon of infoIcons) {
      const title = icon.getAttribute("title") || "";
      if (/context window/i.test(title)) {
        contextWindowRaw = title;
      } else if (/input|output/i.test(title)) {
        costInfo = title;
      } else if (!costInfo) {
        costInfo = title; // 兜底
      }
    }

    // 按指定 key 顺序组装 metrics
    const orderedMetrics: Record<string, number> = {};
    for (const k of metricKeys) {
      orderedMetrics[k] = metrics[k] ?? -1;
    }

    return {
      label,
      metrics: orderedMetrics as unknown as ModelMetrics,
      contextWindow: "",
      contextWindowRaw,
      costInfo,
      description,
    } as ModelInfo;
  }, METRIC_KEYS);
}

// ============================================================
// 主流程
// ============================================================

async function fetchModelMetrics(): Promise<ModelInfo[]> {
  const results: ModelInfo[] = [];
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    console.error(`[fetch-model-metrics] 访问: ${TARGET_URL}`);
    const response = await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || !response.ok()) {
      throw new Error(`页面响应异常: status=${response?.status() ?? "unknown"}`);
    }

    // 等待 iframe 注入 src（21st.dev 异步注入）
    console.error("[fetch-model-metrics] 等待 cdn.21st.dev iframe 出现...");
    const iframeLoc = page.locator("iframe[src*='cdn.21st.dev']").first();
    await iframeLoc.waitFor({ state: "attached", timeout: 8000 });
    await page.waitForTimeout(2500);

    const iframeElement = await iframeLoc.elementHandle();
    if (!iframeElement) throw new Error("iframe elementHandle 为空");
    const frame: Frame | null = await iframeElement.contentFrame();
    if (!frame) throw new Error("iframe contentFrame 为空，可能跨域被阻止");

    const iframeSrc = (await iframeLoc.getAttribute("src")) || undefined;
    console.error(`[fetch-model-metrics] iframe src: ${iframeSrc}`);

    await frame.waitForSelector("#root", { timeout: 8000 });
    await page.waitForTimeout(500);

    // 点击 combobox 按钮展开下拉
    console.error("[fetch-model-metrics] 点击 combobox 展开下拉...");
    const comboboxBtn = frame.locator('button[role="combobox"]').first();
    if ((await comboboxBtn.count()) === 0) {
      throw new Error("未找到 combobox 按钮");
    }
    await comboboxBtn.click();
    await page.waitForTimeout(800);

    // 获取所有模型列表项
    const optionLocators = frame.locator('[role="option"]');
    const optionCount = await optionLocators.count();
    console.error(`[fetch-model-metrics] 探测到 ${optionCount} 个模型项`);
    if (optionCount < EXPECTED_MODELS) {
      throw new Error(`模型项数量不足: ${optionCount}（期望 ${EXPECTED_MODELS}）`);
    }

    // 依次 hover 每个模型项，抓取预览卡片
    for (let i = 0; i < EXPECTED_MODELS; i++) {
      const option = optionLocators.nth(i);
      const listLabel =
        (await option.locator("span.truncate").first().textContent())?.trim() || `模型#${i}`;
      console.error(`[fetch-model-metrics] [${i + 1}/${EXPECTED_MODELS}] hover: ${listLabel}`);

      // 重试机制：hover 偶发不触发预览卡片切换时重试
      let info: ModelInfo | null = null;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // 重试前先移开鼠标清空 hover 状态
        if (attempt > 1) {
          await page.mouse.move(0, 0);
          await page.waitForTimeout(300);
        }
        await option.hover();

        try {
          // 等待预览卡片模型名 === 目标列表项名（确保切换到位）
          await frame.waitForFunction(
            (targetLabel: string) => {
              const metricEls = document.querySelectorAll('[aria-label*="out of 10"]');
              if (metricEls.length !== 4) return false;
              const portalRoot = metricEls[0].closest("[data-base-ui-portal]") ||
                metricEls[0].closest("div[data-open]");
              if (!portalRoot) return false;
              const labelEl = portalRoot.querySelector("p.font-medium.text-neutral-900");
              return !!labelEl && (labelEl.textContent || "").trim() === targetLabel;
            },
            listLabel,
            { timeout: 4000 }
          );
          await page.waitForTimeout(400); // 等动画/数据稳定
          info = await extractPreviewInfo(frame);
          break;
        } catch {
          console.error(`[fetch-model-metrics]   尝试 ${attempt} 未触发 ${listLabel} 预览卡片，重试...`);
        }
      }

      if (!info) {
        throw new Error(`hover ${listLabel} 后未能抓取到预览卡片（重试 ${maxRetries} 次仍失败）`);
      }

      info.contextWindow = formatContextWindow(info.contextWindowRaw);
      results.push(info);
      console.error(
        `[fetch-model-metrics]   → ${info.label}: ` +
          `intelligence=${info.metrics.intelligence}, speed=${info.metrics.speed}, ` +
          `context=${info.metrics.context}, cost=${info.metrics.cost}, ` +
          `ctx=${info.contextWindow}, costInfo=${info.costInfo}`
      );
    }

    await context.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fetch-model-metrics] 失败: ${message}`);
    throw err;
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

// ============================================================
// 入口
// ============================================================

fetchModelMetrics()
  .then((results) => {
    console.log("===METRICS_JSON_BEGIN===");
    console.log(JSON.stringify(results, null, 2));
    console.log("===METRICS_JSON_END===");
  })
  .catch((err) => {
    console.error("[fetch-model-metrics] 未捕获错误:", err);
    process.exit(1);
  });
