/**
 * PreviewScaler - 预览缩放器（公共组件）
 *
 * 解决问题：
 *   ComponentPreview 的 stage 固定 640 画布，宽幅组件（设计宽 > 640，如三列
 *   定价卡片 1280px、Dashboard 多列布局）在 640 画布下布局会折叠（grid 变 1 列、
 *   flex 换行异常），导致预览失真。此前每个宽幅组件都要在 preview.tsx 里自己
 *   实现"虚拟宽屏 + scale"逻辑，违反 DRY。
 *
 * 工作原理（虚拟宽屏 + contain 缩放 + 居中）：
 *   1. 内层 virtual 以 designWidth（如 1280）固定宽度渲染组件，保证布局正确
 *   2. 测量 virtual 的自然尺寸（offsetWidth/offsetHeight，不受 transform 影响）
 *   3. contain 模式缩放：scale = min(容器宽/naturalW, 容器高/naturalH)
 *      取较小值保证组件完整显示不裁切（而非 cover 模式填满但裁切）
 *   4. 居中偏移：留白用父级背景填充
 *
 * 使用方式（宽幅组件 preview.tsx）：
 *   ```tsx
 *   import { PreviewScaler } from '@/components/PreviewScaler';
 *
 *   export default function Preview() {
 *     return (
 *       <PreviewScaler designWidth={1280} style={{ backgroundColor: '#050505' }}>
 *         <PricingGlass tiers={DEMO_TIERS} />
 *       </PreviewScaler>
 *     );
 *   }
 *   ```
 *
 * 何时使用：
 *   - 组件设计宽度 > 640（stage 画布宽度）：必须用 PreviewScaler 声明 designWidth
 *   - 组件设计宽度 ≤ 640：无需 PreviewScaler，preview.tsx 直接 100%×100% 渲染即可
 *
 * 嵌套关系（主页卡片预览为例）：
 *   previewBox (290×181)
 *   └─ ComponentPreview stage (640×399, scale=0.453)  ← ComponentPreview 的画布缩放
 *      └─ PreviewScaler container (640×399, 100%×100%)
 *         └─ virtual (1280×962, scale=0.415, offset)  ← PreviewScaler 的 contain 缩放
 *            └─ PricingGlass (三列布局正确)
 *
 *   双层 transform 叠乘（0.453 × 0.415 ≈ 0.188）等价于单层缩放，视觉无差异。
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface PreviewScalerProps {
  /**
   * 组件设计宽度（虚拟视口宽度）。
   * 组件在此宽度下渲染能保证布局正确（如三列 grid 不折叠）。
   * 取组件的 max-width 或设计稿宽度，如 1280。
   */
  designWidth: number;
  /** 组件内容，会在虚拟宽屏层内以 designWidth 宽度渲染 */
  children: ReactNode;
  /** 容器额外样式（背景色、过渡等），留白区域会显示此背景 */
  style?: CSSProperties;
  /** 容器额外 className */
  className?: string;
}

/**
 * 预览缩放器：虚拟宽屏 + contain 缩放 + 居中。
 *
 * 保证宽幅组件在各预览场景（沙箱全屏、主页卡片缩略、详情页预览）下
 * 布局正确且完整显示不裁切。
 */
export function PreviewScaler({ designWidth, children, style, className }: PreviewScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // virtualRef：指向虚拟宽屏层，测量组件自然尺寸（scale=1 时的 offsetWidth/Height）
  const virtualRef = useRef<HTMLDivElement>(null);
  // scale 初始 1：首帧未测量前用 1，避免 0 导致内容消失；ResizeObserver 立即校正
  const [scale, setScale] = useState(1);
  // 居中偏移：contain 模式下组件完整显示后，水平/垂直方向的留白偏移
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // contain 模式缩放：scale = min(cw/naturalW, ch/naturalH)，保证完整显示不裁切
  useEffect(() => {
    const container = containerRef.current;
    const virtual = virtualRef.current;
    if (!container || !virtual) return;

    const update = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      // 容器尺寸为 0 时跳过（首帧未布局）
      if (cw === 0 || ch === 0) return;

      // virtual 的 offsetWidth/offsetHeight 是 scale=1 时的自然布局尺寸
      // transform 不影响 offset 尺寸，所以多次测量稳定，不会因 setScale 触发循环
      const naturalW = virtual.offsetWidth;
      const naturalH = virtual.offsetHeight;
      if (naturalW === 0 || naturalH === 0) return;

      // contain 模式：取宽高缩放比的较小值，保证完整包含
      const scaleW = cw / naturalW;
      const scaleH = ch / naturalH;
      const s = Math.min(scaleW, scaleH);

      setScale(s);
      // 居中偏移：容器尺寸 - 组件缩放后尺寸，再除以 2
      setOffsetX((cw - naturalW * s) / 2);
      setOffsetY((ch - naturalH * s) / 2);
    };

    update();
    const ro = new ResizeObserver(update);
    // 观察 container：容器尺寸变化时重算（如窗口 resize、卡片布局变化）
    ro.observe(container);
    // 观察 virtual：内容异步加载（如图片、lazy 组件）导致高度变化时重算
    ro.observe(virtual);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {/*
        虚拟宽屏层：固定 designWidth 宽渲染组件，保证布局正确（如 3 列 grid 不折叠）。
        contain 模式缩放 + 居中偏移：
          - scale = min(容器宽/designWidth, 容器高/自然高)
          - offsetX/offsetY 让组件在容器中居中，留白用背景填充
        transformOrigin: top left 让 scale 从左上角开始，
        再用 left/top 的 offset 平移到居中位置。
      */}
      <div
        ref={virtualRef}
        style={{
          width: designWidth,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          position: 'absolute',
          top: offsetY,
          left: offsetX,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PreviewScaler;
