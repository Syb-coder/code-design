"use client";

/**
 * Model Selector Prompt - 预览入口
 * 基于 21st.dev 原始 demoCode（Usage.tsx）还原
 */

import { useState } from "react";
import {
  DEFAULT_LLM_MODELS,
  ModelSelectorPrompt,
  type ModelConfiguration,
} from "./index";

export default function Preview() {
  const [modelValue, setModelValue] = useState("claude-fable-5");
  const [configurations, setConfigurations] = useState<
    Record<string, ModelConfiguration>
  >({});
  const [prompt, setPrompt] = useState("");

  return (
    <ModelSelectorPrompt
      configurations={configurations}
      models={DEFAULT_LLM_MODELS}
      onConfigurationChange={(_, __, nextConfigurations) => {
        setConfigurations(nextConfigurations);
      }}
      onModelChange={(model) => {
        setModelValue(model.value);
      }}
      onPromptChange={setPrompt}
      onSubmit={({ model, configuration, prompt: submittedPrompt }) => {
        // 演示用：提交回调，可在此触发实际请求
        // 净化后保留回调签名供接入，实际请求逻辑由调用方实现
        void { model: model.value, configuration, prompt: submittedPrompt };
      }}
      prompt={prompt}
      value={modelValue}
    />
  );
}
