/**
 * 预览入口 - Pricing Glass
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局说明（使用公共 PreviewScaler 组件）：
 *   PricingGlass 是宽幅组件，设计宽度 1280px，内部 grid auto-fit minmax(280px)
 *   需 ≥900px 宽才显示 3 列。用 PreviewScaler 声明 designWidth=1280，由它负责
 *   虚拟宽屏 + contain 缩放 + 居中，保证各预览场景（沙箱/卡片/详情页）下
 *   3 列布局正确且完整显示不裁切。
 *
 * 背景色选择器（还原原 21st.dev demoCode 的 BG_COLORS）：
 *   右上角 5 色圆形按钮，点击切换背景色，1s 过渡。移除了原 demo 的
 *   handleGlobalClick（打开作者网站）和推广文案（业务污染，入库时移除）。
 *
 * demo 数据复用原 21st.dev demoCode 的 DEMO_TIERS（Basic $9/$7、Pro $29/$24、
 * Ultra $99/$79），确保预览与原组件视觉一致。
 */

import { useState } from 'react';
import { PreviewScaler } from '@/components/PreviewScaler';
import { PricingGlass, type PricingTier } from './index';

/** 背景色选项（对齐原 demoCode BG_COLORS，玻璃拟态需深色背景显出 backdrop-blur） */
const BG_COLORS = [
  { name: 'Obsidian', color: '#050505' },
  { name: 'Midnight Cosmos', color: '#0D0B14' },
  { name: 'Mariana Trench', color: '#06101E' },
  { name: 'Dark Moss', color: '#0A120D' },
  { name: 'Volcanic Ash', color: '#1A0B0B' },
] as const;

/** 定价档位 demo 数据（与原 21st.dev demoCode 一致） */
const DEMO_TIERS: PricingTier[] = [
  {
    name: 'Basic',
    priceMonthly: '9',
    priceAnnual: '7',
    description: 'Perfect for individuals and side projects.',
    features: ['1 Workspace', 'Basic Analytics', 'Community Support'],
  },
  {
    name: 'Pro',
    priceMonthly: '29',
    priceAnnual: '24',
    description: 'For professionals and growing teams.',
    isPopular: true,
    features: [
      'Unlimited Workspaces',
      'Advanced Analytics',
      'Priority Support',
      'Custom Domains',
    ],
  },
  {
    name: 'Ultra',
    priceMonthly: '99',
    priceAnnual: '79',
    description: 'Maximum power for massive scale.',
    features: [
      'Unlimited Everything',
      'Predictive AI Insights',
      '24/7 Dedicated Support',
      'Custom Domains',
      'Biometric Security',
    ],
  },
];

/**
 * 背景色选择器（还原原 demoCode 的 BG_COLORS 选择器）
 *
 * 放在 PreviewScaler 之外，不参与 contain 缩放，保持点击区域稳定。
 * absolute 定位右上角，z-index 高于 PricingGlass 内容确保可点击。
 */
function BackgroundColorPicker({
  colors,
  selectedIndex,
  onSelect,
}: {
  colors: readonly { name: string; color: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem',
        borderRadius: '9999px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}
    >
      <span
        style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          padding: '0 0.5rem',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Test Backgrounds
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {colors.map((color, i) => (
          <button
            key={color.name}
            onClick={() => onSelect(i)}
            title={color.name}
            style={{
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: '9999px',
              backgroundColor: color.color,
              border:
                selectedIndex === i
                  ? 'none'
                  : '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow:
                selectedIndex === i
                  ? '0 0 0 2px white, 0 0 0 4px black, inset 0 2px 4px rgba(0,0,0,0.5)'
                  : 'inset 0 2px 4px rgba(0,0,0,0.5)',
              transform: selectedIndex === i ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 300ms',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Preview() {
  // 背景色索引（默认 Obsidian #050505，对齐原 demoCode 初始态）
  const [bgIndex, setBgIndex] = useState(0);

  return (
    // 外层 div：管背景色（颜色选择器切换）+ relative 定位承载 overlay
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: BG_COLORS[bgIndex].color,
        // 1s 过渡（对齐原 demoCode transition-colors duration-1000）
        transition: 'background-color 1000ms',
        overflow: 'hidden',
      }}
    >
      {/* 背景色选择器：absolute overlay，不参与 PreviewScaler 缩放 */}
      <BackgroundColorPicker
        colors={BG_COLORS}
        selectedIndex={bgIndex}
        onSelect={setBgIndex}
      />

      {/*
        PreviewScaler：虚拟宽屏 1280 + contain 缩放 + 居中
        保证 PricingGlass 的 grid auto-fit 在任何预览容器下都显示 3 列布局，
        且完整显示不裁切（留白用外层 div 的背景色填充）。
      */}
      <PreviewScaler designWidth={1280}>
        {/* 内边距：基于虚拟 1280 宽，沙箱全屏合理留白，缩略图 scale 后压缩 */}
        <div style={{ padding: '2rem 2.5rem' }}>
          <PricingGlass tiers={DEMO_TIERS} />
        </div>
      </PreviewScaler>
    </div>
  );
}
