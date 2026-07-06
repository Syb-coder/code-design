---
id: react-effects-liquid-morph-floating-menu
name: Liquid Morph Floating Menu
techStack: react
styling: inline-style
animation: framer-motion
category: effects
tags: [menu, nav, floating, button, minimal, morph, organic, playful, energetic, hero, dashboard, framer-motion, css-transition, fluid, futuristic]
dependencies: [framer-motion]
fonts: [Trobika, Bebas Neue, Aeonik TRIAL, Inter]
source: 21st.dev
sourceUrl: https://21st.dev/@aayush-duhan/components/liquid-morph-floating-menu
author: aayush-duhan
createdAt: 2026-07-03
updatedAt: 2026-07-03
---

# Liquid Morph Floating Menu

## 视觉描述
固定在视口底部居中的浮动菜单按钮。**关闭态**为黄色胶囊（150×48px，圆角 72），左侧深色 "Menu" 文案 + 右侧汉堡图标，hover 时整体轻微放大 1.05 倍。

**点击展开**时（800ms 急停缓出 `[0.22, 1, 0.36, 1]`）发生液态变形：
- 容器从胶囊（150×48, radius 72）变形为圆角矩形（280×260, radius 32）
- 深色圆形（#242424, 直径 200%）从底部 `-200%` 上升至 `-20%`，如墨滴上涌覆盖黄色背景
- 顶部菜单项按 stagger 渐显（基础延迟 0.4s + 0.08s × index）
- 底部 "Menu" 文案与汉堡图标颜色从深色反转为浅色（#f7f1ed）
- 汉堡图标两条线旋转 ±45° 变形为关闭 X

**菜单项 hover** 触发字符级 stagger 上推动画：每个字符按索引延迟 30ms，向上平移 50% 露出副本字符，单字符过渡 800ms，形成波浪式切换。字符级动画有防抖机制（lockDuration = 30 × 字符数 + 300ms），动画进行中缓存 leave 事件，避免快速移动导致抖动。

整体氛围：黄色 + 深灰高对比配色，液态变形 + 字符波浪动画营造未来感与趣味性，适合作为个人作品集/创意 Agency 站点的导航入口。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | MenuItem[] | [{label:'Home'},{label:'Works'},{label:'Contact'}] | 菜单项列表 |
| MenuItem.label | string | - | 菜单文案（支持字符级动画） |
| MenuItem.onClick | () => void | - | 点击回调 |
| menuLabel | string | 'Menu' | 底部触发文案 |

## 最小使用示例
```tsx
import FloatingMenu from '@/library/react/effects/liquid-morph-floating-menu';

// 默认三项菜单
<FloatingMenu />

// 自定义菜单项 + 触发文案
<FloatingMenu
  menuLabel="导航"
  items={[
    { label: '首页', onClick: () => navigate('/') },
    { label: '作品', onClick: () => navigate('/works') },
    { label: '关于', onClick: () => navigate('/about') },
  ]}
/>
```

## 源码路径
`library/react/effects/liquid-morph-floating-menu/index.tsx`

## 适用场景
- 个人作品集 / 创意 Agency 站点的主导航
- Landing page 底部浮动菜单入口
- 移动端友好的隐藏式导航（fixed 底部定位）
- 需要"惊喜感"交互的 Hero 区导航
- 极简风格页面（仅一个浮动入口，无传统导航栏）
- 深色主题站点（黄色胶囊在深色背景上视觉冲击强）

## 实现说明
- **样式方案**：原组件使用 Tailwind 类名，本项目未集成 Tailwind，入库时全部转为 inline style（视觉行为完全一致）
- **定位**：组件使用 `position: fixed; bottom: 2.5rem; left: 50%`，相对视口底部居中定位。在卡片缩略图场景下，若祖先有 transform，fixed 会相对该祖先定位
- **描边实现**：原作黄色背景层使用 `borderWidth:1 + borderColor`（关闭态 borderColor #d1bb3b，展开态与背景同色 #FFE862），入库严格保留原作实现
- **字体依赖**：菜单项使用 Trobika / Bebas Neue（标题展示字），容器使用 Aeonik TRIAL / Inter（UI 字体）。这些字体非 Google Fonts，需项目自行引入；缺字时回退至 sans-serif
- **防抖机制**：字符 hover 动画使用 animatingRef + pendingLeaveRef 双 ref 锁定，确保动画完成后才处理 leave 事件
- **外部点击关闭**：展开态监听 document mousedown，点击容器外区域自动关闭
