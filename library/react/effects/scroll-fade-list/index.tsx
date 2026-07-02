/**
 * Scroll Fade List
 *
 * 来源：21st.dev
 * 原作者：dqnamo
 * 原始 URL：https://21st.dev/@dqnamo/components/scroll-fade-list
 * 入库日期：2026-07-02
 *
 * 实现说明：
 *   ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 403），
 *   未能获取真实源码。本实现基于 fetch-source.ts 抓取的渲染后 DOM + iframe
 *   编译后 JS 反推 + JSON-LD 描述 + demoCode 使用示例还原。
 *
 *   核心机制忠实还原原组件：
 *   - scroll 事件（passive）+ ResizeObserver 监听滚动位置与容器尺寸变化
 *   - requestAnimationFrame 批处理，同帧多次触发只测一次，避免高频 scroll 卡顿
 *   - 上下 fade 高度按滚动位置线性计算（上限 maxFadeHeight）
 *   - **fade 层用 CSS 伪元素 ::before/::after + CSS 变量驱动高度**（与原组件一致）
 *   - scrollbar-gutter: stable 保留滚动条槽，避免出现/消失导致布局抖动
 *   - 泛型组件，通过 getKey/items/renderItem 适配任意列表项类型
 *   - 零运行时依赖（原组件 JSON-LD 描述明确 "Dependency-free"）
 *
 * 渲染机制关键点（V1 还原版 bug 根因）：
 *   原组件用 CSS 伪元素 ::before/::after 实现 fade，伪元素是 absolute 定位
 *   在容器上，会层叠在滚动区域内容之上，从而遮挡 li 文本形成淡入淡出。
 *   V1 还原版误用真实 div fade 层，导致 fade 层无法正确遮挡 li 文本
 *   （div 的层叠行为与伪元素不同）。V2 改回伪元素 + CSS 变量方式，与原组件一致。
 *
 * 改造点（相对原 21st.dev 渲染 DOM）：
 *   - Tailwind 类转为 inline style + <style> 伪元素 CSS（本项目未引入 Tailwind）
 *   - 用 useId + data-sfl 属性选择器隔离多实例的伪元素 CSS
 *   - 加文件头注释 + JSDoc + Props 类型 + 泛型约束
 */

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';

// ============================================================
// Props 类型定义
// ============================================================

/**
 * ScrollFadeList 组件 Props
 *
 * @template T - 列表项类型，泛型确保 getKey/renderItem 类型安全
 */
export interface ScrollFadeListProps<T> {
  /** 列表数据 */
  items: T[];
  /** 从列表项提取唯一 key（React key 用） */
  getKey: (item: T) => string | number;
  /** 渲染单个列表项内容 */
  renderItem: (item: T) => ReactNode;
  /** 滚动区域高度（CSS 长度值），默认 "20rem"（320px） */
  scrollAreaHeight?: string;
  /** fade 渐变最大高度（px），到达上限后不再增长，默认 76 */
  maxFadeHeight?: number;
  /** 容器背景色（CSS 颜色值），fade 渐变以此色过渡到透明，默认 "white" */
  backgroundColor?: string;
  /** 容器边框色，默认 "rgb(229 231 235)"（gray-200） */
  borderColor?: string;
  /** 容器圆角（CSS 长度值），默认 "0.75rem"（12px） */
  borderRadius?: string;
  /** 滚动条槽宽度（px），fade 层右侧留出此宽度避免覆盖滚动条，默认 10 */
  scrollbarGutterWidth?: number;
  /** 容器额外 inline style（用于覆盖默认样式） */
  style?: CSSProperties;
}

// ============================================================
// 组件实现
// ============================================================

/**
 * ScrollFadeList - 带渐变 fade 边缘的滚动列表
 *
 * 上下边缘有渐变 fade，根据滚动位置动态增长/收缩：
 * - 顶部 fade：scrollTop > 0 时出现，随 scrollTop 增长到 maxFadeHeight 后保持
 * - 底部 fade：未滚动到底时出现，随剩余距离增长到 maxFadeHeight 后保持
 *
 * 渲染机制：fade 层用 CSS 伪元素 ::before/::after 实现，高度通过 CSS 变量
 * `--top-fade-height` / `--bottom-fade-height` 驱动。measure 函数读取滚动位置
 * 后，通过 containerRef.style.setProperty 更新变量，伪元素高度自动跟随变化。
 *
 * 测量策略：scroll 事件（passive）+ ResizeObserver 监听内容尺寸变化，
 * 统一通过 requestAnimationFrame 批处理，同帧多次触发只测一次。
 *
 * @example
 * <ScrollFadeList
 *   items={teams}
 *   getKey={(t) => t.code}
 *   renderItem={(t) => <span>{t.name}</span>}
 * />
 */
export function ScrollFadeList<T>({
  items,
  getKey,
  renderItem,
  scrollAreaHeight = '20rem',
  maxFadeHeight = 76,
  backgroundColor = 'white',
  borderColor = 'rgb(229 231 235)',
  borderRadius = '0.75rem',
  scrollbarGutterWidth = 10,
  style,
}: ScrollFadeListProps<T>) {
  // 用 useId 生成唯一标识，隔离多实例的伪元素 CSS
  // useId 返回值含冒号（如 ":r0:"），CSS 选择器中冒号是伪类分隔符，需清理
  const reactId = useId();
  const instanceId = `sfl-${reactId.replace(/:/g, '')}`;

  // 容器引用，操作 CSS 变量驱动伪元素 fade 高度（与原组件一致）
  const containerRef = useRef<HTMLDivElement>(null);
  // 内层滚动区域引用，读取 scrollTop/scrollHeight/clientHeight
  const scrollRef = useRef<HTMLDivElement>(null);
  // rAF 句柄，批处理 + 卸载时取消
  const rafRef = useRef<number | null>(null);

  /**
   * 测量滚动位置并更新 fade 高度 CSS 变量
   *
   * 计算逻辑（与原组件编译后 JS 完全一致）：
   * - scrollableDistance = max(0, scrollHeight - clientHeight)
   * - topFade = min(maxFadeHeight, max(0, scrollTop))
   * - bottomFade = min(maxFadeHeight, max(0, scrollableDistance - scrollTop))
   *
   * 通过 CSS 变量驱动伪元素高度，不经过 React state，避免 scroll 高频 re-render
   */
  const measure = () => {
    const scrollEl = scrollRef.current;
    const containerEl = containerRef.current;
    if (!scrollEl || !containerEl) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    // 可滚动距离：<0 表示内容未溢出，取 0 避免 bottomFade 为负
    const scrollableDistance = Math.max(0, scrollHeight - clientHeight);

    // 顶部 fade：随 scrollTop 线性增长，上限 maxFadeHeight
    const topFade = Math.min(maxFadeHeight, Math.max(0, scrollTop));
    // 底部 fade：随"距底部的剩余距离"线性增长，上限 maxFadeHeight
    const bottomFade = Math.min(
      maxFadeHeight,
      Math.max(0, scrollableDistance - scrollTop),
    );

    // 通过 CSS 变量驱动伪元素 fade 高度（忠实还原原组件机制）
    containerEl.style.setProperty('--top-fade-height', `${topFade}px`);
    containerEl.style.setProperty('--bottom-fade-height', `${bottomFade}px`);
  };

  /**
   * 存最新 measure 函数，effect 闭包通过 ref 调用
   * 避免 maxFadeHeight 等 props 变化时重新绑定 scroll listener
   */
  const latestMeasure = useRef(measure);
  latestMeasure.current = measure;

  /**
   * 通过 rAF 批处理测量请求
   * 同一帧内多次调用（scroll + resize 事件叠加）只执行一次 measure
   */
  const scheduleMeasure = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      latestMeasure.current();
    });
  };

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    // 同步初始测量，避免首帧 fade=0 闪烁
    latestMeasure.current();

    // scroll 事件：passive 避免阻塞主线程，仅触发测量
    const handleScroll = () => scheduleMeasure();
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });

    // ResizeObserver：监听滚动容器尺寸变化（窗口 resize / 父容器变化 / 字体加载）
    const resizeObserver = new ResizeObserver(() => scheduleMeasure());
    resizeObserver.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      // 清理未执行的 rAF，避免卸载后回调报错
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // 伪元素 CSS：通过容器上的 CSS 变量驱动 fade 高度
  // ::before 顶部 fade（背景色 → 透明），::after 底部 fade（透明 → 背景色）
  // 用属性选择器 [data-sfl="..."] 隔离多实例，避免类名冲突
  // z-index: 10 确保伪元素层叠在滚动内容之上，遮挡 li 文本形成淡入淡出
  const fadeCss = `
[data-sfl="${instanceId}"] {
  --top-fade-height: 0px;
  --bottom-fade-height: 0px;
  --scroll-fade-list-bg: ${backgroundColor};
  --scrollbar-gutter-width: ${scrollbarGutterWidth}px;
}
[data-sfl="${instanceId}"]::before {
  content: '';
  position: absolute;
  pointer-events: none;
  left: 0;
  right: var(--scrollbar-gutter-width);
  top: 0;
  height: var(--top-fade-height);
  background: linear-gradient(to bottom, var(--scroll-fade-list-bg), transparent);
  z-index: 10;
}
[data-sfl="${instanceId}"]::after {
  content: '';
  position: absolute;
  pointer-events: none;
  left: 0;
  right: var(--scrollbar-gutter-width);
  bottom: 0;
  height: var(--bottom-fade-height);
  background: linear-gradient(to bottom, transparent, var(--scroll-fade-list-bg));
  z-index: 10;
}
`;

  return (
    <>
      <style>{fadeCss}</style>
      <div
        ref={containerRef}
        data-sfl={instanceId}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius,
          border: `1px solid ${borderColor}`,
          background: backgroundColor,
          ...style,
        }}
      >
        {/* 滚动区域：固定高度 + 稳定滚动条槽 */}
        {/* 不设 position/z-index，保持普通流，让伪元素（absolute）层叠在其之上 */}
        <div
          ref={scrollRef}
          style={{
            height: scrollAreaHeight,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
          }}
        >
          <ul
            style={{
              padding: '0.5rem',
              margin: 0,
              listStyle: 'none',
              // 显式设置字体样式，避免被项目全局暗色主题覆盖
              // 对齐原组件：color oklch(0.145 0 0) ≈ rgb(15,15,15)，fontSize 16px
              color: 'rgb(15, 15, 15)',
              fontSize: '16px',
              fontFamily:
                'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            }}
          >
            {items.map((item) => (
              <li
                key={getKey(item)}
                style={{
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                }}
              >
                {renderItem(item)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default ScrollFadeList;
