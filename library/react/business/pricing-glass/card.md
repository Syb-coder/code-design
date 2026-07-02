---
id: react-business-pricing-glass
name: Pricing Glass
techStack: react
styling: inline-style
animation: css-keyframes
category: business
tags: [pricing, card, glassmorphism, glow, mouse-tracking, premium, cyberpunk, cta, marketing, saas, futuristic, elegant, animated, gradient, toggle]
dependencies: []
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@uithefactory/components/pricing-glass
author: uithefactory
createdAt: 2026-07-02
updatedAt: 2026-07-02
---

# Pricing Glass

> ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 403），未能获取真实源码。
> 本实现基于渲染后 DOM + JSON-LD 描述（"deep glassmorphism, animated light beams, and
> interactive mouse-tracking physics"）+ demoCode 使用示例还原。
> JS 逻辑（鼠标跟踪光束、Monthly/Annual 切换、Pro 旋转光边框、入场交错动画）为基于
> DOM 的视觉反推 + CSS keyframes 实现，可能与原组件实现细节不一致，但视觉行为对齐。

## 视觉描述
深色背景（Obsidian #050505）下的三档定价卡片组，整体走高端玻璃拟态路线。每张卡片为
半透明玻璃材质（backdrop-blur + saturate + brightness 多重滤镜），边缘有细微白色描边和
内嵌高光阴影。中心有一团 blur(120px) 的大光晕营造氛围。

核心动态效果：
- **鼠标跟踪光束**：hover 卡片时，跟随鼠标位置出现 600px 半径的 radial 白色光晕，移出
  时光晕渐隐
- **Pro 卡片旋转光边框**：Pro 档卡片有 conic-gradient 旋转的白色光带沿边框循环转动
  （4s 一周），配合 mask 镂空只显示 1px 边框
- **Monthly/Annually 切换**：胶囊形切换器，滑块带弹性曲线平滑左右滑动，价格数字在
  60px 高的窗口内上滑切换
- **入场交错动画**：标题、副标题、切换器、三张卡片依次淡入上浮（120ms 间隔）

Pro 卡片额外差异：向上偏移 1rem、Most Popular 顶部标签、实心白色 CTA 按钮（其余档位为
半透明描边按钮）。卡片背景有极低透明度的 SVG fractalNoise 噪点纹理增加质感。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| tiers | PricingTier[] | - | 定价档位数组（建议 3 个，其中一个设 isPopular） |
| style | CSSProperties | - | 容器额外 inline style |

**PricingTier 结构**：
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 档位名称（如 "Basic"） |
| priceMonthly | string | 月付价格数字（如 "9"） |
| priceAnnual | string | 年付价格数字（如 "7"） |
| description | string | 档位描述 |
| isPopular | boolean? | 是否 Pro 档（触发旋转光边框 + 上偏移 + 标签） |
| features | string[] | 功能特性列表 |

## 最小使用示例
```tsx
import { PricingGlass } from '@/library/react/business/pricing-glass';

<PricingGlass
  tiers={[
    {
      name: 'Basic',
      priceMonthly: '9',
      priceAnnual: '7',
      description: 'Perfect for individuals.',
      features: ['1 Workspace', 'Basic Analytics'],
    },
    {
      name: 'Pro',
      priceMonthly: '29',
      priceAnnual: '24',
      description: 'For growing teams.',
      isPopular: true,
      features: ['Unlimited Workspaces', 'Advanced Analytics', 'Priority Support'],
    },
    {
      name: 'Ultra',
      priceMonthly: '99',
      priceAnnual: '79',
      description: 'For massive scale.',
      features: ['Unlimited Everything', 'AI Insights', '24/7 Support'],
    },
  ]}
/>
```

**注意**：需放置在深色背景容器上才能显出玻璃效果（背景色由父容器提供）。

## 源码路径
`library/react/business/pricing-glass/index.tsx`

## 适用场景
- SaaS 产品定价页
- 订阅制服务会员档位展示
- 高端/科技感产品的付费方案区
- 需要突出 Pro 档的营销页
- 深色主题 landing page 的 pricing section
