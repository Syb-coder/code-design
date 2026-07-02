---
id: react-effects-scroll-fade-list
name: Scroll Fade List
techStack: react
styling: inline-style
animation: scroll-driven
category: effects
tags: [list, scroll, fade, dropdown, select, minimal, clean, calm, subtle, picker, settings, css-only, resize-observer, minimalist, functional]
dependencies: []
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@dqnamo/components/scroll-fade-list
author: dqnamo
createdAt: 2026-07-02
updatedAt: 2026-07-02
---

# Scroll Fade List

> ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 403），未能获取真实源码。
> 本实现基于渲染后 DOM + iframe 编译后 JS 反推 + JSON-LD 描述 + demoCode 还原。
> 核心机制忠实还原原组件：CSS 伪元素 ::before/::after + CSS 变量驱动 fade 高度，
> scroll+ResizeObserver+rAF 批处理，泛型 API。

## 视觉描述
带圆角边框的白色列表容器，上下边缘有从背景色到透明的渐变 fade 层。未滚动时顶部 fade 消失、底部 fade 满高（76px）提示下方有更多内容；滚动到中间时上下 fade 同时出现；滚动到底部时底部 fade 消失、顶部 fade 满高。fade 高度随滚动位置线性变化，过渡自然无突兀感。容器右侧保留稳定的滚动条槽（scrollbar-gutter: stable），滚动条出现/消失不引起内容抖动。整体风格极简干净，适合与中性色背景搭配。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | T[] | - | 列表数据（泛型 T） |
| getKey | (item: T) => string \| number | - | 从列表项提取唯一 key |
| renderItem | (item: T) => ReactNode | - | 渲染单个列表项内容 |
| scrollAreaHeight | string | "20rem" | 滚动区域高度（CSS 长度值） |
| maxFadeHeight | number | 76 | fade 渐变最大高度（px） |
| backgroundColor | string | "white" | 容器背景色，fade 以此色过渡 |
| borderColor | string | "rgb(229 231 235)" | 容器边框色 |
| borderRadius | string | "0.75rem" | 容器圆角 |
| scrollbarGutterWidth | number | 10 | 滚动条槽宽度（px），fade 层右侧留出 |
| style | CSSProperties | - | 容器额外 inline style |

## 最小使用示例
```tsx
import { ScrollFadeList } from '@/library/react/effects/scroll-fade-list';

const items = [
  { id: 1, label: '项一' },
  { id: 2, label: '项二' },
];

<ScrollFadeList
  items={items}
  getKey={(item) => item.id}
  renderItem={(item) => <span>{item.label}</span>}
/>
```

## 源码路径
`library/react/effects/scroll-fade-list/index.tsx`

## 适用场景
- 长列表选择器（国家/城市/分类）
- 下拉菜单内容区
- 设置项列表
- 需要提示"还有更多内容"的滚动区域
- 极简风格的后台/工具类界面
