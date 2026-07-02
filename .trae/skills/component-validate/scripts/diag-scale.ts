/**
 * diag-scale.ts - 诊断 PricingGlass 预览缩放问题
 *
 * 提取沙箱、主页卡片、详情页预览的尺寸链 + scale 值，并截图对比。
 */
import { chromium } from "playwright";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const OUT_DIR = path.join(PROJECT_ROOT, "library", "react", "business", "pricing-glass", "_source");
const BASE = "http://localhost:5178";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const result: Record<string, unknown> = {};

  // 1. 沙箱：preview 容器 = 100vw×100vh
  await page.goto(`${BASE}/__sandbox__/library/react/business/pricing-glass`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  result.sandbox = await page.evaluate(() => {
    const root = document.querySelector('#root > div > div') as HTMLElement;
    const inner = root?.querySelector('div') as HTMLElement; // preview 容器
    const virtualLayer = inner?.querySelector('div[style*="transform"]') as HTMLElement;
    return {
      root: root ? { w: root.clientWidth, h: root.clientHeight } : null,
      preview: inner ? { w: inner.clientWidth, h: inner.clientHeight, bg: inner.style.backgroundColor } : null,
      virtual: virtualLayer ? {
        w: virtualLayer.clientWidth,
        h: virtualLayer.clientHeight,
        scale: virtualLayer.style.transform,
        // 虚拟层内 PricingGlass 实际渲染高度
        scrollH: virtualLayer.scrollHeight,
      } : null,
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, "diag-scale-sandbox.png") });

  // 2. 主页卡片
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  result.home = await page.evaluate(() => {
    const allCards = Array.from(document.querySelectorAll('.comp-card'));
    const pgCard = allCards.find(c => c.textContent?.includes('Pricing Glass'));
    if (!pgCard) return { found: false };
    const previewBox = pgCard.querySelector('.comp-card__preview') as HTMLElement;
    const container = pgCard.querySelector('.comp-preview-container') as HTMLElement;
    const stage = pgCard.querySelector('.comp-preview-stage') as HTMLElement;
    const virtualLayer = stage?.querySelector('div[style*="transform"]') as HTMLElement;
    return {
      found: true,
      previewBox: previewBox ? { w: previewBox.clientWidth, h: previewBox.clientHeight } : null,
      container: container ? { w: container.clientWidth, h: container.clientHeight } : null,
      stage: stage ? { w: stage.clientWidth, h: stage.clientHeight, transform: stage.style.transform } : null,
      virtual: virtualLayer ? {
        w: virtualLayer.clientWidth,
        h: virtualLayer.clientHeight,
        scale: virtualLayer.style.transform,
        scrollH: virtualLayer.scrollHeight,
      } : null,
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, "diag-scale-home.png"), fullPage: true });

  // 3. 详情页预览
  await page.goto(`${BASE}/component/react-business-pricing-glass`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  result.detail = await page.evaluate(() => {
    const frame = document.querySelector('.detail-page__preview-frame') as HTMLElement;
    const container = frame?.querySelector('.comp-preview-container') as HTMLElement;
    const stage = frame?.querySelector('.comp-preview-stage') as HTMLElement;
    const virtualLayer = stage?.querySelector('div[style*="transform"]') as HTMLElement;
    return {
      frame: frame ? { w: frame.clientWidth, h: frame.clientHeight } : null,
      container: container ? { w: container.clientWidth, h: container.clientHeight } : null,
      stage: stage ? { w: stage.clientWidth, h: stage.clientHeight, transform: stage.style.transform } : null,
      virtual: virtualLayer ? {
        w: virtualLayer.clientWidth,
        h: virtualLayer.clientHeight,
        scale: virtualLayer.style.transform,
        scrollH: virtualLayer.scrollHeight,
      } : null,
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, "diag-scale-detail.png"), fullPage: true });

  await browser.close();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
