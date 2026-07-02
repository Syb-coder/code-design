---
id: react-effects-shining-text
name: Shining Text
techStack: react
styling: inline-style
animation: css-keyframes
category: effects
tags: [text, shining, glow, gradient, minimal, calm, thoughtful, loading, ai, css-only, background-clip, futuristic, cyberpunk, sleek]
dependencies: []
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@hextaui/components/shining-text
author: HextaUI
createdAt: 2026-07-02
updatedAt: 2026-07-02
---

# Shining Text

> ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 返回 403），未能获取真实源码。
> 本实现基于渲染后 DOM + JSON-LD 描述 + demoCode 反推。
> 核心机制忠实还原原组件：linear-gradient 高光带 + background-clip:text + background-position 平移动画。
> 动画方向（左→右）与时长（3s）为基于 DOM 帧（background-position: -74.2% 0px）的视觉反推，可能与原组件参数略有差异。

## 视觉描述
深灰色（#404040）文字上有一道白色高光带从左到右周期性扫过，扫过处文字局部泛白发光，形成"闪耀/思考"动效。文字采用 base 字号、regular 字重，在白色点阵网格背景上居中显示。整体风格极简克制，无多余装饰，高光扫过时的明暗对比营造出 AI"正在思考"的沉静科技感。配色仅深灰+白两色，适合与中性色界面搭配。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| text | string | - | 闪耀显示的文本（必填） |
| duration | number | 3 | 扫光动画周期（秒），周期越短扫光越快 |
| highlightColor | string | "#fff" | 高光带颜色 |
| baseColor | string | "#404040" | 基底文字颜色（高光之外的渐变区域） |
| className | string | - | 自定义类名 |
| style | CSSProperties | - | 自定义内联样式 |

## 最小使用示例
```tsx
import { ShiningText } from '@/library/react/effects/shining-text';

// 基础用法
<ShiningText text="HextaAI is thinking..." />

// 自定义扫光速度与配色
<ShiningText
  text="Loading..."
  duration={2}
  highlightColor="#a5b4fc"
  baseColor="#1e293b"
/>
```

## 源码路径
`library/react/effects/shining-text/index.tsx`

## 适用场景
- AI 助手"正在思考"状态提示
- 加载/处理中文案动效
- 数据同步/计算进度暗示
- 极简风格的标题或状态文字
- 暗示"后台有活动"的静态文字
