/**
 * fetch-config-html.ts - 21st.dev model-selector Configuration 区域 HTML 抓取脚本
 *
 * 职责：打开 21st.dev model-selector 页面，依次 hover 每个模型列表项，
 *      从预览卡片（portal 渲染到 iframe body 末尾）抓取 Configuration 区域完整 outerHTML，
 *      用于对比 4 个模型的配置控件差异（用户反馈 GPT-5.5 多出一行配置）。
 *      同时抓取 GPT-5.5 完整预览卡片 outerHTML 保存到 _source/gpt-5-5-full-card.html。
 *
 * 用法：
 *   npx tsx .trae/skills/component-ingest/scripts/fetch-config-html.ts
 *
 * 输出：
 *   - 文件：library/react/business/model-selector/_source/gpt-5-5-full-card.html
 *   - stdout：JSON（用 ===CONFIG_JSON_BEGIN/END=== 标记包裹，含 4 个模型 Configuration HTML）
 *   - 进度日志走 stderr
 */

import { chromium, type Browser, type Frame } from "playwright";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// 常量
// ============================================================

const TARGET_URL = "https://21st.dev/@dqnamo/components/model-selector";
const EXPECTED_MODELS = 4;

// GPT-5.5 完整卡片保存路径
const __dirname = dirname(fileURLToPath(import.meta.url));
const GPT_CARD_OUTPUT_PATH = resolve(
  __dirname,
  "../../../../library/react/business/model-selector/_source/gpt-5-5-full-card.html"
);

// ============================================================
// 类型定义
// ============================================================

interface ModelConfigInfo {
  label: string;                  // 模型显示名
  configLabel: string;            // Configuration 区域标题文本（应为 "Configuration"）
  configSectionHtml: string;      // Configuration 整段 outerHTML（含标题 + 所有控件）
  controlsHtml: string;           // 仅控件部分 outerHTML（标题下方所有控件容器）
  controlCount: number;           // 控件分组数量（如 Reasoning / Speed 各算 1）
  controlLabels: string[];        // 各控件的 label 文本（如 ["Reasoning"] 或 ["Reasoning", "Speed"]）
  fullCardHtml: string;           // 完整预览卡片 outerHTML
}

// ============================================================
// 核心：从 iframe 预览卡片提取 Configuration 区域 HTML
// ============================================================

/**
 * 在 iframe 内查找预览卡片根容器并提取 Configuration 区域
 *
 * 定位策略：
 *   1. 找到 metric bars 元素（aria-label*="out of 10"）
 *   2. 向上找到 data-base-ui-portal 祖先（预览卡片 portal）
 *   3. 在 portal 内查找 Configuration 标签 p.font-mono.font-semibold.text-neutral-500.uppercase
 *   4. Configuration 标签的父容器（div.flex.flex-col.gap-3.p-3）即 Configuration 整段
 *   5. 标题下方的兄弟元素（div.flex.flex-col.gap-2）即控件容器
 */
async function extractConfigInfo(frame: Frame): Promise<ModelConfigInfo> {
  return frame.evaluate(() => {
    const metricEls = Array.from(document.querySelectorAll('[aria-label*="out of 10"]'));
    if (metricEls.length !== 4) {
      throw new Error(`metric bars 数量异常: ${metricEls.length}（期望 4）`);
    }

    // 向上找到预览卡片 portal 根容器
    let portalRoot: HTMLElement | null = metricEls[0] as HTMLElement;
    while (portalRoot && !portalRoot.hasAttribute("data-base-ui-portal")) {
      portalRoot = portalRoot.parentElement;
    }
    if (!portalRoot) {
      portalRoot = metricEls[0].closest("div[data-open]") as HTMLElement | null;
    }
    if (!portalRoot) throw new Error("未找到预览卡片根容器");

    // 模型名
    const labelEl = portalRoot.querySelector("p.font-medium.text-neutral-900");
    const label = (labelEl?.textContent || "").trim();

    // 查找 Configuration 标签
    // 选择器匹配 p.font-mono.font-semibold.text-neutral-500.uppercase
    // 注意：实际 DOM 含 text-[10px] 等 arbitrary value 类，但上述 4 个 class 必然存在
    const configLabelEl = portalRoot.querySelector(
      "p.font-mono.font-semibold.text-neutral-500.uppercase"
    ) as HTMLElement | null;

    if (!configLabelEl) {
      throw new Error("未找到 Configuration 标签（p.font-mono.font-semibold.text-neutral-500.uppercase）");
    }

    const configLabel = (configLabelEl.textContent || "").trim();

    // Configuration 整段：向上找到最近的 div.flex.flex-col.gap-3.p-3（Configuration section 容器）
    // 该容器是 portal 内第二个 div.flex.flex-col.gap-3.p-3（第一个是 metrics 区域）
    let configSection: HTMLElement | null = configLabelEl.parentElement;
    while (configSection && !configSection.classList.contains("p-3")) {
      configSection = configSection.parentElement;
    }
    if (!configSection) {
      // 兜底：直接用 label 的父级
      configSection = configLabelEl.parentElement;
    }

    const configSectionHtml = (configSection as HTMLElement).outerHTML;

    // 控件容器：Configuration 标题下方的兄弟元素
    // 结构：<p>Configuration</p> + <div class="flex flex-col gap-2">控件们</div>
    // 控件容器是 configSection 内除标题 p 外的 div
    const configContainer = configSection!.querySelector("div.flex.flex-col.gap-2") as HTMLElement | null;
    const controlsHtml = configContainer ? configContainer.outerHTML : "";

    // 统计控件分组：每个控件分组结构为 <p>label</p> + <div role="radiogroup"|role="group">
    // 控件 label 是 configContainer 内的直接子 p 元素
    const controlLabels: string[] = [];
    const controlCount = configContainer
      ? Array.from(configContainer.children).filter((child) => {
          if (child.tagName === "P" && child.textContent) {
            controlLabels.push((child.textContent || "").trim());
            return false;
          }
          // 控件容器（radiogroup / 含 button 的 div）
          return child.querySelector("button") !== null || child.getAttribute("role") === "radiogroup";
        }).length
      : 0;

    return {
      label,
      configLabel,
      configSectionHtml,
      controlsHtml,
      controlCount,
      controlLabels,
      fullCardHtml: portalRoot.outerHTML,
    } as ModelConfigInfo;
  });
}

// ============================================================
// 主流程
// ============================================================

async function fetchConfigHtml(): Promise<ModelConfigInfo[]> {
  const results: ModelConfigInfo[] = [];
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    console.error(`[fetch-config-html] 访问: ${TARGET_URL}`);
    const response = await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || !response.ok()) {
      throw new Error(`页面响应异常: status=${response?.status() ?? "unknown"}`);
    }

    // 等待 iframe 注入 src（21st.dev 异步注入）
    console.error("[fetch-config-html] 等待 cdn.21st.dev iframe 出现...");
    const iframeLoc = page.locator("iframe[src*='cdn.21st.dev']").first();
    await iframeLoc.waitFor({ state: "attached", timeout: 8000 });
    await page.waitForTimeout(2500);

    const iframeElement = await iframeLoc.elementHandle();
    if (!iframeElement) throw new Error("iframe elementHandle 为空");
    const frame: Frame | null = await iframeElement.contentFrame();
    if (!frame) throw new Error("iframe contentFrame 为空，可能跨域被阻止");

    const iframeSrc = (await iframeLoc.getAttribute("src")) || undefined;
    console.error(`[fetch-config-html] iframe src: ${iframeSrc}`);

    await frame.waitForSelector("#root", { timeout: 8000 });
    await page.waitForTimeout(500);

    // 点击 combobox 按钮展开下拉
    console.error("[fetch-config-html] 点击 combobox 展开下拉...");
    const comboboxBtn = frame.locator('button[role="combobox"]').first();
    if ((await comboboxBtn.count()) === 0) {
      throw new Error("未找到 combobox 按钮");
    }
    await comboboxBtn.click();
    await page.waitForTimeout(800);

    // 获取所有模型列表项
    const optionLocators = frame.locator('[role="option"]');
    const optionCount = await optionLocators.count();
    console.error(`[fetch-config-html] 探测到 ${optionCount} 个模型项`);
    if (optionCount < EXPECTED_MODELS) {
      throw new Error(`模型项数量不足: ${optionCount}（期望 ${EXPECTED_MODELS}）`);
    }

    // 依次 hover 每个模型项，抓取 Configuration 区域
    for (let i = 0; i < EXPECTED_MODELS; i++) {
      const option = optionLocators.nth(i);
      const listLabel =
        (await option.locator("span.truncate").first().textContent())?.trim() || `模型#${i}`;
      console.error(`[fetch-config-html] [${i + 1}/${EXPECTED_MODELS}] hover: ${listLabel}`);

      // 重试机制：hover 偶发不触发预览卡片切换时重试（最多 3 次）
      let info: ModelConfigInfo | null = null;
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
          info = await extractConfigInfo(frame);
          break;
        } catch {
          console.error(`[fetch-config-html]   尝试 ${attempt} 未触发 ${listLabel} 预览卡片，重试...`);
        }
      }

      if (!info) {
        throw new Error(`hover ${listLabel} 后未能抓取到预览卡片（重试 ${maxRetries} 次仍失败）`);
      }

      results.push(info);
      console.error(
        `[fetch-config-html]   → ${info.label}: ` +
          `控件数=${info.controlCount}, 控件标签=[${info.controlLabels.join(", ")}]`
      );
    }

    // 保存 GPT-5.5 完整预览卡片到文件
    const gptInfo = results.find((r) => /gpt-5\.5/i.test(r.label));
    if (gptInfo) {
      console.error(`[fetch-config-html] 保存 GPT-5.5 完整卡片到: ${GPT_CARD_OUTPUT_PATH}`);
      writeFileSync(GPT_CARD_OUTPUT_PATH, gptInfo.fullCardHtml, "utf-8");
    } else {
      console.error("[fetch-config-html] 警告：未找到 GPT-5.5 模型，未保存卡片文件");
    }

    await context.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fetch-config-html] 失败: ${message}`);
    throw err;
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

// ============================================================
// 入口
// ============================================================

fetchConfigHtml()
  .then((results) => {
    console.log("===CONFIG_JSON_BEGIN===");
    console.log(JSON.stringify(results, null, 2));
    console.log("===CONFIG_JSON_END===");
  })
  .catch((err) => {
    console.error("[fetch-config-html] 未捕获错误:", err);
    process.exit(1);
  });
