---
id: react-three-magic-dust-shader
name: Magic Dust Shader
techStack: react
styling: three-shader
animation: r3f-useFrame
category: three
tags: [particle, shader, text-animation, glow, futuristic, energetic, mysterious, hero, landing, three.js, react-three-fiber, webgl, glsl, magical, cyberpunk]
dependencies: [three, @react-three/fiber]
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@uithefactory/components/magic-dust-shader
author: UI Factory
createdAt: 2026-07-04
updatedAt: 2026-07-04
---

# Magic Dust Shader

## 视觉描述
大量白色粒子（默认 10000）在深色空间中循环切换三种状态：从散乱云团聚合为目标形状（文字/几何体）→ 短暂保持 → 解构散开 → 切换下一个目标，循环往复。聚合时粒子沿 X 轴有序成形（左→右扫描式），配合 cubic ease 缓动与逐粒子延迟，形成"扫描成形"的动效。粒子使用 AdditiveBlending 叠加发光，呈现柔和的辉光质感。默认序列为 MAGIC → 圆环 → DUST → 球体 → UI FACTORY → 立方体，文字态会自动旋转吸附到正对镜头，几何体态则持续自转，整体呈现神秘、未来感的"魔法尘埃"氛围。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| sequence | SequenceItem[] | MAGIC/DUST/UI FACTORY + 几何体交替 | 循环切换的文字与几何体序列 |
| particleCount | number | 10000 | 粒子数量，越多越细腻但越耗性能 |
| particleColor | string | "#ffffff" | 粒子基色（HEX） |
| particleSize | number | 0.02 | 粒子基础尺寸（相对于屏幕短边） |
| fontFamily | string | "sans-serif" | 文字字体族 |
| holdDuration | number | 3.0 | 形状保持时长（秒）后开始解构 |
| animationSpeed | number | 1.0 | 聚合/解构动画速度倍率 |
| scatterRadius | number | 12 | 粒子完全散开时的云团半径 |

SequenceItem 类型：
```ts
type SequenceItem =
  | { type: 'text'; text: string; offset?: [number, number, number] }
  | { type: 'shape'; shape: 'torus' | 'sphere' | 'box'; offset?: [number, number, number] };
```

## 最小使用示例
```tsx
import { MagicDust } from '@/library/react/three/magic-dust-shader';

// 基础用法（默认序列）
<MagicDust />

// 自定义序列与配色
<MagicDust
  sequence={[
    { type: 'text', text: 'HELLO' },
    { type: 'shape', shape: 'sphere' },
  ]}
  particleColor="#a5b4fc"
  particleCount={8000}
  holdDuration={2}
/>

// 仅文字循环
<MagicDust
  sequence={[
    { type: 'text', text: 'TRAE' },
    { type: 'text', text: 'AI' },
  ]}
  fontFamily="Inter, sans-serif"
/>
```

## 源码路径
`library/react/three/magic-dust-shader/index.tsx`

## 适用场景
- 首页 Hero 区视觉焦点（全屏粒子动画）
- 产品/品牌发布页 Landing 动效
- 加载/启动屏的动态背景
- 科技/未来感主题展示页
- 3D 互动展示区背景
- 数据可视化场景的过渡动效

## 实现说明
- **粒子聚合机制**：文字通过 Canvas 2D 光栅化采样像素点，粒子随机映射到白色像素形成文字轮廓；几何体用参数方程直接采样表面点
- **状态机**：CONSTRUCTING（聚合进度 0→1.5）→ HOLDING（保持 holdDuration 秒）→ DECONSTRUCTING（进度→0）→ 切换 target 循环
- **着色器**：顶点着色器用 `mix(position, aTarget, ease)` 插值位置，cubic ease 缓动；片元着色器 discard 圆外像素做圆形粒子 + 软边缘
- **逐粒子延迟**：按 X 坐标归一化映射到 [0,1]，让粒子沿 X 轴有序聚合，营造扫描成形效果
- **响应式**：按视口宽度限制组件最大宽度（15 单位），保证不溢出屏幕
- **依赖**：`three` + `@react-three/fiber`，须确保项目已安装
- **限制**：`particleColor` 仅在初始化时同步，运行时修改不会更新粒子颜色（如需动态变色需扩展 colorObj 同步逻辑）
