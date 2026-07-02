/**
 * ShiningText - 文字闪耀扫光特效组件
 *
 * 来源：https://21st.dev/@hextaui/components/shining-text
 * 作者：HextaUI
 * 入库日期：2026-07-02
 * 许可：MIT
 *
 * 实现说明：
 *   通过 linear-gradient 在文字上铺设一条白色高光带（位于渐变 50% 处），
 *   其余区域为深灰 #404040；配合 background-clip: text + color: transparent
 *   让渐变成为文字填充色；再用 @keyframes 平移 background-position，
 *   使高光带从左到右周期性扫过文字，形成"闪耀/思考"动效。
 *
 * ⚠️ 还原实现（rendered-dom）：基于 21st.dev 渲染后 DOM 反推。
 *   因 registry 需认证（shadcn add 403），未能获取真实源码；
 *   动画方向/时长为基于 DOM 帧的视觉反推，可能与原组件参数略有差异。
 */

import { useEffect, type CSSProperties } from 'react';

/** ShiningText 组件 Props */
export interface ShiningTextProps {
  /** 闪耀显示的文本 */
  text: string;
  /** 扫光动画周期（秒），默认 3s */
  duration?: number;
  /** 高光颜色，默认 #fff（白色高光带） */
  highlightColor?: string;
  /** 基底文字颜色（高光之外的渐变区域），默认 #404040（深灰） */
  baseColor?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义内联样式 */
  style?: CSSProperties;
}

/** keyframes 注入标志，确保全局只注入一次 */
let keyframesInjected = false;

/**
 * 注入扫光动画 keyframes 到 document head
 * 仅在客户端执行，SSR 安全（typeof document 检查）
 */
function injectKeyframes(): void {
  if (keyframesInjected || typeof document === 'undefined') return;
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-shining-text', '');
  styleEl.textContent = `
    @keyframes shining-text-sweep {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(styleEl);
  keyframesInjected = true;
}

/**
 * ShiningText - 文字闪耀扫光特效
 *
 * 高光带从左到右周期性扫过文字，适合"AI 思考中"、"加载中"等场景的提示文案。
 * 核心机制：linear-gradient 高光带 + background-clip:text + background-position 动画。
 *
 * @param text 闪耀显示的文本
 * @param duration 扫光周期（秒），默认 3
 * @param highlightColor 高光色，默认 #fff
 * @param baseColor 基底色，默认 #404040
 * @param className 自定义类名
 * @param style 自定义内联样式
 * @returns 渲染的 h1 元素，文字带扫光动效
 */
export function ShiningText({
  text,
  duration = 3,
  highlightColor = '#fff',
  baseColor = '#404040',
  className,
  style,
}: ShiningTextProps) {
  // 组件挂载时注入 keyframes（全局仅一次）
  useEffect(() => {
    injectKeyframes();
  }, []);

  return (
    <h1
      className={className}
      style={{
        // 线性渐变：110deg 方向，35%-75% 区间内 50% 处为高光带
        backgroundImage: `linear-gradient(110deg, ${baseColor}, 35%, ${highlightColor}, 50%, ${baseColor}, 75%, ${baseColor})`,
        // 背景宽度 200%，为平移留出扫光空间
        backgroundSize: '200% 100%',
        // 文字裁剪：渐变作为文字填充色
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        // 扫光动画：线性循环，高光从左到右扫过
        animation: `shining-text-sweep ${duration}s linear infinite`,
        fontSize: '1rem',
        fontWeight: 400,
        margin: 0,
        ...style,
      }}
    >
      {text}
    </h1>
  );
}

export default ShiningText;
