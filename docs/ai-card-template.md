# AI 卡片模板（card.md）

> 每个组件目录维护一个 `card.md`，是入库 Skill 的产物、校验 Skill G3 自评的对象、检索 Skill 的返回结果。
> AI 卡片是组件级摘要，供 AI 快速理解组件无需读源码，节约上下文。

## 模板结构

```markdown
---
id: react-ui-basic-button-glow
name: 发光按钮
techStack: react
styling: css-modules
animation: framer-motion
category: ui-basic
tags: [button, glow, gradient, neon, interactive, futuristic, cyberpunk, energetic, cta, framer-motion]
dependencies: [framer-motion]
fonts: [Inter, Space Mono]
source: 21st.dev
sourceUrl: https://21st.dev/xxx
author: 原作者
createdAt: 2026-06-30
updatedAt: 2026-06-30
---

# 发光按钮

## 视觉描述
悬停时产生柔和发光效果，按钮边缘有渐变光晕。主色为青蓝色，配合深色背景营造科技感。
动画过渡平滑，hover 时发光强度渐增，移开时渐弱。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| color | string | '#3b82f6' | 发光颜色 |
| intensity | number | 1 | 发光强度（0-2） |
| children | ReactNode | - | 按钮内容 |
| onClick | () => void | - | 点击回调 |

## 最小使用示例
\`\`\`tsx
import { GlowButton } from '@/library/react/ui-basic/button-glow';

<GlowButton color="#3b82f6" intensity={1.5}>
  点击我
</GlowButton>
\`\`\`

## 源码路径
`library/react/ui-basic/button-glow/index.tsx`（相对路径，AI 读取时自动拼接项目根）

## 适用场景
- CTA 按钮
- 主操作按钮
- 需要强调的交互元素
- 科技/未来感主题页面

## 变体说明（若有 variants/）
| 变体 | 文件 | 差异说明 |
|------|------|---------|
| glow | variants/glow.tsx | 默认发光效果 |
| gradient | variants/gradient.tsx | 渐变背景替代发光 |
| neon | variants/neon.tsx | 霓虹描边效果 |
```

## 字段说明

### frontmatter（YAML 元数据）

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `id` | 是 | string | 组件唯一标识，格式 `{techStack}-{category}-{name}`，如 `react-ui-basic-button-glow` |
| `name` | 是 | string | 组件中文名，如"发光按钮" |
| `techStack` | 是 | string | 技术栈，枚举：`react` / `html` / `vue` / `visualization` |
| `styling` | 否 | string | 样式方案，如 `css-modules` / `tailwind` / `inline-style` |
| `animation` | 否 | string | 动画方案，如 `framer-motion` / `gsap` / `css-only` |
| `category` | 是 | string | 分类，枚举：`ui-basic` / `business` / `effects` / `three` / `canvas` / `svg` |
| `tags` | 是 | string[] | 六维标签数组，总数 8-15 个（功能/风格/情绪/场景/技术/灵感，每维度 ≥2） |
| `dependencies` | 是 | string[] | 依赖列表，须与 meta.json 一致且 ⊆ package.json 已装依赖 |
| `fonts` | 否 | string[] | 字体依赖（Google Fonts 在线导入时标注） |
| `source` | 是 | string | 来源平台，如 `21st.dev` / `codepen` / `原创` |
| `sourceUrl` | 是 | string | 原始 URL（无来源时填 `local`） |
| `author` | 否 | string | 原作者 |
| `createdAt` | 是 | string | 入库日期 `YYYY-MM-DD` |
| `updatedAt` | 否 | string | 最后更新日期 |

### 正文（Markdown 内容）

| 章节 | 必填 | 说明 |
|------|------|------|
| `# 组件名` | 是 | 一级标题，与 frontmatter name 一致 |
| `## 视觉描述` | 是 | 供 AI 理解外观的描述（颜色、动画、交互反馈、氛围） |
| `## 关键 API` | 是 | Props 表格：Prop / 类型 / 默认值 / 说明 |
| `## 最小使用示例` | 是 | 可运行的 import + 调用示例 |
| `## 源码路径` | 是 | 相对项目根的路径（**禁止用绝对路径**，迁移友好） |
| `## 适用场景` | 是 | 列表，描述组件用在哪 |
| `## 变体说明` | 否 | 仅当存在 `variants/` 时填写 |

## 编写规范

1. **路径用相对路径**：源码路径、变体文件路径均相对项目根（如 `library/react/ui-basic/button-glow/index.tsx`），禁止绝对路径
2. **tags 六维覆盖**：必须覆盖功能/风格/情绪/场景/技术/灵感六个维度，每维度至少 2 个，总数 8-15 个
3. **tags 归一化**：`btn`→`button`，`按钮`→`button`，英文为主中文为辅
4. **依赖一致性**：frontmatter `dependencies` 须与同目录 `meta.json` 的 `dependencies` 完全一致
5. **视觉描述要具体**：描述颜色、动画时长、交互反馈、整体氛围，避免"好看""漂亮"等主观词
6. **示例必须可运行**：import 路径用 `@library/...` 或相对路径，调用方式与 Props 表格一致

## 校验关联

- **G1 静态校验**：校验 frontmatter 必填字段、tags 数组长度、依赖与 meta.json 一致性
- **G3 AI 自评**：对照 original.png + rendered.png 自检视觉描述一致性、Props 覆盖度、tags 六维覆盖、分类合理性
