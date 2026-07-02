/**
 * Interactive Hover Button
 *
 * 来源：21st.dev
 * 原作者：Magic UI
 * 原始 URL：https://21st.dev/@magicui/components/interactive-hover-button
 * 入库日期：2026-07-02
 *
 * 实现说明：
 *   ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 403），
 *   未能获取真实源码。本实现基于 fetch-source.ts 抓取的渲染后 DOM +
 *   JSON-LD 描述 + demoCode 使用示例还原。
 *
 *   核心机制忠实还原原组件（纯 CSS hover 动画，无 JS 逻辑）：
 *   - 默认态：按钮显示 "Button" 文字，文字略向右偏移（translate-x-1）
 *   - Hover 态三层联动（300ms 过渡）：
 *     1) 原文字右移 3rem + 渐隐（opacity 0）
 *     2) 新文字+箭头从右 3rem 外滑入到 -0.25rem 位置 + 渐显（opacity 1）
 *     3) 滑块背景从左下角 20%/40% 位置的 8x8 小点扩展到全按钮
 *        （w-full h-full + scale 1.8 放大覆盖圆角区域）作为新文字背景色
 *
 * 改造点（相对原 21st.dev 渲染 DOM）：
 *   - Tailwind 类 + shadcn CSS 变量（bg-background/foreground/primary 等）
 *     转为 inline <style> + 固定颜色值（让组件独立可移植，不依赖 shadcn 主题）
 *   - 用 useId + data-ihb 属性选择器隔离多实例的 hover CSS
 *   - 提取 children/颜色为 Props，支持主题定制
 *   - arrow-right 图标用内联 SVG（避免引入 lucide-react 依赖）
 *   - 加文件头注释 + JSDoc + Props 类型
 */

import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ============================================================
// Props 类型定义
// ============================================================

/**
 * InteractiveHoverButton 组件 Props
 *
 * 继承原生 button 属性（onClick/disabled/type 等），新增主题定制 Props。
 * 颜色 Props 默认值对齐 shadcn 浅色主题的设计变量。
 */
export interface InteractiveHoverButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮文字，默认 "Button" */
  children?: ReactNode;
  /** 按钮宽度（CSS 长度值），默认 "8rem"（128px，对应 Tailwind w-32） */
  width?: string;
  /** 默认态背景色（对应 shadcn bg-background），默认 "#ffffff" */
  backgroundColor?: string;
  /** 默认态文字色（对应 shadcn text-foreground），默认 "#0a0a0a" */
  textColor?: string;
  /** Hover 态滑块背景色（对应 shadcn bg-primary），默认 "#0a0a0a" */
  primaryColor?: string;
  /** Hover 态前景文字色（对应 shadcn text-primary-foreground），默认 "#fafafa" */
  primaryForeground?: string;
  /** 边框色（对应 shadcn border），默认 "#e5e5e5"（gray-200） */
  borderColor?: string;
}

// ============================================================
// 组件实现
// ============================================================

/**
 * InteractiveHoverButton - 交互式悬停按钮
 *
 * 悬停时触发三层联动动画：
 * 1. 原文字右移渐隐
 * 2. 新文字 + 箭头图标从右滑入渐显
 * 3. 滑块从左下角 8x8 小点扩展为全按钮背景色
 *
 * 纯 CSS hover 实现，无 JS 状态管理，无外部动画库依赖。
 * 通过 useId 隔离多实例的 hover CSS，可安全在同页面渲染多个按钮。
 *
 * @example
 * <InteractiveHoverButton onClick={() => alert('clicked')}>
 *   Get Started
 * </InteractiveHoverButton>
 *
 * @param props - 组件 Props，详见 InteractiveHoverButtonProps
 */
export function InteractiveHoverButton({
  children = 'Button',
  width = '8rem',
  backgroundColor = '#ffffff',
  textColor = '#0a0a0a',
  primaryColor = '#0a0a0a',
  primaryForeground = '#fafafa',
  borderColor = '#e5e5e5',
  ...rest
}: InteractiveHoverButtonProps) {
  // useId 生成唯一实例 ID，隔离多实例的 hover CSS
  // 冒号在 CSS 选择器中是伪类分隔符，需清理
  const reactId = useId();
  const instanceId = `ihb-${reactId.replace(/:/g, '')}`;

  // hover 动画 CSS：用属性选择器 [data-ihb] 隔离多实例
  // 三层动画全部通过 :hover 触发，无 JS 状态
  // 数值对齐原 Tailwind 类：translate-x-1=0.25rem, translate-x-12=3rem,
  // h-2/w-2=0.5rem, scale-[1.8]=1.8, rounded-full=9999px, rounded-lg=0.5rem
  const hoverCss = `
[data-ihb="${instanceId}"] {
  position: relative;
  width: ${width};
  cursor: pointer;
  overflow: hidden;
  border-radius: 9999px;
  border: 1px solid ${borderColor};
  background: ${backgroundColor};
  padding: 0.5rem;
  text-align: center;
  font-weight: 600;
  color: ${textColor};
}
[data-ihb="${instanceId}"] .ihb-label {
  display: inline-block;
  /* 默认右偏 0.25rem，让文字略偏右居中（对齐 translate-x-1） */
  transform: translateX(0.25rem);
  transition: all 300ms;
}
[data-ihb="${instanceId}"]:hover .ihb-label {
  /* 右移 3rem + 渐隐（对齐 translate-x-12 + opacity-0） */
  transform: translateX(3rem);
  opacity: 0;
}
[data-ihb="${instanceId}"] .ihb-hover {
  position: absolute;
  top: 0;
  z-index: 10;
  display: flex;
  height: 100%;
  width: 100%;
  /* 默认右偏 3rem + 渐隐，等待 hover 时滑入 */
  transform: translateX(3rem);
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: ${primaryForeground};
  opacity: 0;
  transition: all 300ms;
}
[data-ihb="${instanceId}"]:hover .ihb-hover {
  /* 左偏 0.25rem（对齐 -translate-x-1）+ 渐显 */
  transform: translateX(-0.25rem);
  opacity: 1;
}
[data-ihb="${instanceId}"] .ihb-bg {
  position: absolute;
  /* 初始小点位置：左 20% 上 40%，8x8 圆角小点 */
  left: 20%;
  top: 40%;
  height: 0.5rem;
  width: 0.5rem;
  border-radius: 0.5rem;
  background: ${primaryColor};
  /* 显式 scale(1) 让 transform 过渡起点明确，避免 none → scale(1.8) 跳变 */
  transform: scale(1);
  transition: all 300ms;
}
[data-ihb="${instanceId}"]:hover .ihb-bg {
  /* 扩展为全按钮 + scale 1.8 放大覆盖圆角区域 */
  left: 0%;
  top: 0%;
  height: 100%;
  width: 100%;
  transform: scale(1.8);
}
`;

  return (
    <>
      <style>{hoverCss}</style>
      <button data-ihb={instanceId} type="button" {...rest}>
        {/* 默认文字层：hover 时右移渐隐 */}
        <span className="ihb-label">{children}</span>
        {/* Hover 文字+箭头层：从右滑入渐显，z-10 高于滑块 */}
        <div className="ihb-hover">
          <span>{children}</span>
          {/* arrow-right 图标（lucide 风格，内联 SVG 避免依赖） */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
        {/* 滑块背景层：hover 时从左下角扩展为全按钮背景 */}
        <div className="ihb-bg" />
      </button>
    </>
  );
}

export default InteractiveHoverButton;
