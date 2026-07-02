---
id: react-ui-basic-interactive-hover-button
name: Interactive Hover Button
techStack: react
styling: inline-style
animation: css-only
category: ui-basic
tags: [button, hover, interactive, animated, cta, arrow, minimal, clean, energetic, playful, css-only, geometric, action, marketing, minimalist]
dependencies: []
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@magicui/components/interactive-hover-button
author: magicui
createdAt: 2026-07-02
updatedAt: 2026-07-02
---

# Interactive Hover Button

> ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 403），未能获取真实源码。
> 本实现基于渲染后 DOM + JSON-LD 描述 + demoCode 使用示例还原。
> 纯 CSS hover 动画组件无 JS 逻辑，还原度高；颜色用固定值替代原 shadcn 设计变量
> （bg-background/foreground/primary 等），与原项目主题变量可能略有差异，可通过 Props 覆盖。

## 视觉描述
胶囊形按钮（圆角 9999px），宽 128px、高约 36px，浅灰边框 + 白色背景 + 黑色加粗文字。
默认态显示居中略偏右的 "Button" 文字，左下角 20%/40% 位置有一个 8x8 的黑色小圆点装饰。

Hover 时触发三层联动动画（300ms 过渡）：
- **原文字**：向右平移 48px 并渐隐到 opacity 0
- **新文字 + 箭头**：从右侧 48px 外滑入到居中略偏左位置，渐显到 opacity 100
- **滑块背景**：从左下角的 8x8 小圆点扩展为铺满整个按钮的圆角矩形
  （scale 1.8 放大覆盖圆角区域），作为新文字的黑色背景

整体效果：原文字被"推走"消失，黑色滑块从角落"席卷"覆盖按钮，新文字 + 箭头从黑底中浮现。
鼠标移出时三层动画反向回弹，平滑回到默认态。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| children | ReactNode | "Button" | 按钮文字 |
| width | string | "8rem" | 按钮宽度（CSS 长度值，如 "10rem"/"160px"） |
| backgroundColor | string | "#ffffff" | 默认态背景色 |
| textColor | string | "#0a0a0a" | 默认态文字色 |
| primaryColor | string | "#0a0a0a" | Hover 态滑块背景色 |
| primaryForeground | string | "#fafafa" | Hover 态文字 + 箭头色 |
| borderColor | string | "#e5e5e5" | 边框色 |
| onClick | () => void | - | 点击回调（继承自 button） |
| type | "button"/"submit"/"reset" | "button" | 按钮类型（继承自 button） |
| disabled | boolean | false | 禁用状态（继承自 button） |

## 最小使用示例
```tsx
import { InteractiveHoverButton } from '@/library/react/buttons/interactive-hover-button';

<InteractiveHoverButton onClick={() => console.log('clicked')}>
  Get Started
</InteractiveHoverButton>
```

自定义主题色示例：
```tsx
<InteractiveHoverButton
  primaryColor="#3b82f6"
  primaryForeground="#ffffff"
  borderColor="#3b82f6"
>
  Subscribe
</InteractiveHoverButton>
```

## 源码路径
`library/react/buttons/interactive-hover-button/index.tsx`

## 适用场景
- CTA 主操作按钮（Get Started / Sign Up / Subscribe）
- Landing page 行动召唤区
- 表单提交按钮（需配合 type="submit"）
- 卡片/列表项的次要操作按钮
- 浅色主题极简风格界面
- 需要细微交互反馈但不抢戏的场景
