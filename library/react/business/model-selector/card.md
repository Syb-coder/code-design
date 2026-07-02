---
id: react-business-model-selector
name: Model Selector Prompt
techStack: react
styling: tailwind
animation: css-transition
category: business
tags: [input, select, combobox, prompt, minimal, clean, serious, professional, chat, llm, css-transition, svg, tailwind, dashboard, utilitarian]
dependencies: []
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@dqnamo/components/model-selector
author: dqnamo
createdAt: 2026-07-02
updatedAt: 2026-07-02
---

# Model Selector Prompt

## 实现说明

> ⚠️ 还原实现，非原始源码。JS 逻辑（动画/状态切换）为基于 DOM 的视觉反推，可能与原组件行为不一致。
>
> 真实源码需通过以下命令获取（21st.dev registry 需登录认证）：
> `npx shadcn@latest add "https://21st.dev/r/dqnamo/model-selector"`
>
> 本还原版基于：21st.dev 预览 iframe 的**多状态交互 DOM**（`_source/interactive/step-1-5.html`，含初始/下拉展开/hover 预览/配置切换/搜索过滤 5 个状态）+ 调用示例 demoCode（`_source/demo-code.txt`）+ JSON-LD 描述（`_source/metadata.json`）。原组件基于 Base UI Combobox + Preview Card，还原版用原生 HTML + ARIA 实现 Combobox/Dialog 行为，避免引入 `@base-ui-components/react` 依赖。

## 视觉描述

一个用于 LLM 提示词撰写的卡片式输入器，居中显示在浅灰背景（`bg-neutral-100`）上。卡片为白色圆角边框（`rounded-xl border border-neutral-200`），含：

- **顶部 Textarea**：占位文案 "What do you want to do?"，无视觉边框，与卡片融为一体。
- **左下模型选择按钮**：圆角边框按钮，含提供商图标（Anthropic 为橙棕色 `#D97757` 的 A 字母路径）+ 模型名 + 下拉箭头（展开时 `rotate-180`）。
- **右下 Send 按钮**：深黑底（`bg-neutral-900`）白字，含纸飞机图标，hover 变 `bg-neutral-800`。

点击模型按钮在按钮下方展开下拉弹层（`fixed` 定位模拟 portal，`w-60` 宽度），含：
- **搜索框**：`placeholder="Search models..."`，右侧放大镜图标，下边框分隔。
- **模型列表**（`role="listbox"`，`max-h-64` 可滚动）：4 个真实模型，每项含模型名 + provider 图标 + provider 名。选中项 `bg-neutral-100`，hover 项 `hover:bg-neutral-100`。
- **滚动渐隐遮罩**：底部 `h-8` 白色到透明渐变（`opacity-0` 默认隐藏，滚动时显现）。

hover 模型列表项时，在弹层右侧弹出**预览卡片**（`w-56`，`fixed` 定位模拟 portal），含：
- **顶部模型信息**：模型名 + provider 图标 + provider 名 + 描述文本。
- **metric bars**（`grid grid-cols-2 gap-4`）：4 个 metric（Intelligence/Speed/Context/Cost），每个是 **10 格栅格**（`grid grid-cols-10 gap-1`，每格 `h-3`），填充的格内有 `scaleY(1)` transform + `transition-transform duration-300 ease-out` + `transition-delay` 0/25/50...225ms 错峰动画。颜色按 metric 不同：Intelligence/Context 绿色 `rgb(48,164,108)`、Speed 橙色 `rgb(247,107,21)`、Cost 红色 `rgb(229,72,77)`。Context 有 ⓘ 提示 context window，Cost 有 ⓘ 提示价格。
- **底部 Configuration**：仅 Reasoning 配置（Low/Medium/High radiogroup），选中项 `bg-neutral-900 text-white`，未选中 `bg-neutral-100 text-neutral-500`。

整体风格极简、专业、克制，配色中性（neutral 色阶）+ metric 颜色编码，动画时长 300ms + 25ms 错峰，无装饰性发光。

## 关键 API

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| models | LLMModel[] | - | 模型列表（含 value/label/provider/metrics/description/contextWindow/costInfo） |
| value | string | - | 当前选中模型的 value |
| prompt | string | - | 输入框文本 |
| configurations | Record<string, ModelConfiguration> | - | 按模型 value 索引的配置字典 |
| onModelChange | (model: LLMModel) => void | - | 选中模型回调 |
| onPromptChange | (prompt: string) => void | - | 输入框变化回调 |
| onConfigurationChange | (modelValue, config, next) => void | - | 配置变化回调，第三参为 next 全量配置字典 |
| onSubmit | ({model, configuration, prompt}) => void | - | Send 触发回调 |

`LLMModel` 类型：`{ value, label, provider: 'anthropic'|'openai'|'gemini', metrics: {intelligence, speed, context, cost}, description, contextWindow, costInfo }`
`ModelConfiguration` 类型：`{ reasoning?: 'low'|'medium'|'high' }`（仅 Reasoning 配置，无 Speed）

## 最小使用示例

```tsx
import {
  DEFAULT_LLM_MODELS,
  ModelSelectorPrompt,
  type ModelConfiguration,
} from "@/library/react/business/model-selector";

import { useState } from "react";

export default function Demo() {
  const [modelValue, setModelValue] = useState("claude-fable-5");
  const [configurations, setConfigurations] = useState<
    Record<string, ModelConfiguration>
  >({});
  const [prompt, setPrompt] = useState("");

  return (
    <ModelSelectorPrompt
      configurations={configurations}
      models={DEFAULT_LLM_MODELS}
      onConfigurationChange={(_, __, next) => setConfigurations(next)}
      onModelChange={(model) => setModelValue(model.value)}
      onPromptChange={setPrompt}
      onSubmit={({ model, configuration, prompt: p }) => {
        // 提交回调，可在此触发实际请求
        void { model: model.value, configuration, prompt: p };
      }}
      prompt={prompt}
      value={modelValue}
    />
  );
}
```

## 源码路径

`library/react/business/model-selector/index.tsx`

## 适用场景

- AI 聊天/对话应用的提示词输入区
- LLM 模型对比选择器（capability/speed/context/cost）
- Prompt 工程工具的模型 + 配置选择
- 需要可搜索下拉 + hover 预览卡片的复杂选择器场景
- Dashboard 中带配置面板的输入控件
