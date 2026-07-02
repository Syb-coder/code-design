/**
 * Model Selector Prompt - 还原实现
 *
 * 来源：https://21st.dev/@dqnamo/components/model-selector
 * 作者：dqnamo
 * 入库日期：2026-07-02
 *
 * ⚠️ 还原实现，非原始源码。原组件基于 Base UI Combobox + Preview Card，
 * 本还原版用原生 HTML + ARIA 实现 Combobox/Dialog 行为，避免引入 @base-ui-components/react 依赖。
 * 还原依据：21st.dev 预览 iframe 的多状态交互 DOM（_source/interactive/step-1-5.html）
 *         + 调用示例 demoCode（_source/demo-code.txt）+ JSON-LD 描述（_source/metadata.json）
 *
 * 关键还原点（基于真实交互 DOM）：
 *   1. metric bars 是 10 格栅格 + scaleY transform 错峰动画（每格延迟 25ms），非进度条
 *   2. 颜色按 metric 不同：Intelligence/Context 绿色、Speed 橙色、Cost 红色
 *   3. 配置含 Reasoning（Low/Medium/High，所有模型）+ Speed（Standard/Fast，仅 GPT-5.5）
 *   4. 真实模型 4 个：Claude Fable 5/Claude Opus 4.8/GPT-5.5/Gemini 3.1 Pro Preview
 *   5. provider 图标：Anthropic A字母、OpenAI 圆环、Gemini 星形闪烁
 *   6. Context/Cost 有 ⓘ 提示（title 属性）
 *   7. 下拉弹层用 fixed 定位模拟 portal
 *   8. combobox 按钮显示当前选中模型的非默认配置 chip（如 Reasoning: High）
 *
 * 改造点（相对原 21st.dev 渲染 DOM）：
 *   - Tailwind 类名转为 inline style + <style> 伪类 CSS（本项目未引入 Tailwind）
 *   - 用 useId + data-ms 属性选择器隔离多实例的伪类 CSS
 */

import { useState, useRef, useEffect, useId, type KeyboardEvent, type CSSProperties } from "react";

// ============================================================
// 类型定义
// ============================================================

type ModelProvider = "anthropic" | "openai" | "gemini";

type ReasoningLevel = "low" | "medium" | "high";

// Speed 配置：仅部分模型支持（如 GPT-5.5），原版抓取确认 Standard/Fast 两档
type SpeedLevel = "standard" | "fast";

interface ModelMetrics {
  intelligence: number; // 0-10
  speed: number; // 0-10
  context: number; // 0-10
  cost: number; // 0-10
}

interface LLMModel {
  value: string; // 模型唯一标识，如 "claude-fable-5"
  label: string; // 显示名，如 "Claude Fable 5"
  provider: ModelProvider;
  metrics: ModelMetrics;
  description: string;
  contextWindow: string; // 如 "1M ctx"
  costInfo: string; // 如 "$12.50 / 1M input · $50.00 / 1M output"
  supportsSpeed?: boolean; // 是否支持 Speed 配置（仅 GPT-5.5 为 true，原版抓取确认）
}

interface ModelConfiguration {
  reasoning?: ReasoningLevel;
  speed?: SpeedLevel;
}

interface ModelSelectorPromptProps {
  models: LLMModel[];
  value: string;
  prompt: string;
  configurations: Record<string, ModelConfiguration>;
  onModelChange: (model: LLMModel) => void;
  onPromptChange: (prompt: string) => void;
  onConfigurationChange: (
    modelValue: string,
    config: ModelConfiguration,
    nextConfigurations: Record<string, ModelConfiguration>
  ) => void;
  onSubmit: (data: {
    model: LLMModel;
    configuration: ModelConfiguration;
    prompt: string;
  }) => void;
}

// ============================================================
// 默认数据（基于真实 DOM 还原的 4 个模型）
// ============================================================

const DEFAULT_LLM_MODELS: LLMModel[] = [
  {
    value: "claude-fable-5",
    label: "Claude Fable 5",
    provider: "anthropic",
    metrics: { intelligence: 10, speed: 5, context: 10, cost: 10 },
    description:
      "Anthropic's newest frontier model with Opus fallback for difficult reasoning tasks.",
    contextWindow: "1M ctx",
    costInfo: "$12.50 / 1M input · $50.00 / 1M output",
  },
  {
    value: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    metrics: { intelligence: 9, speed: 5, context: 10, cost: 5 },
    description:
      "Flagship Claude model for long-horizon coding, analysis, and agentic work.",
    contextWindow: "1M ctx",
    costInfo: "$5.00 / 1M input · $25.00 / 1M output",
  },
  {
    value: "gpt-5-5",
    label: "GPT-5.5",
    provider: "openai",
    metrics: { intelligence: 9, speed: 5, context: 9, cost: 5 },
    description:
      "OpenAI's strongest GPT-5.5 reasoning configuration for frontier coding and agentic workflows.",
    contextWindow: "920K ctx",
    costInfo: "$5.00 / 1M input · $30.00 / 1M output",
    // 仅 GPT-5.5 支持 Speed 配置（Standard/Fast），原版抓取确认
    supportsSpeed: true,
  },
  {
    value: "gemini-3-1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    provider: "gemini",
    metrics: { intelligence: 9, speed: 10, context: 10, cost: 2 },
    description:
      "Google DeepMind's latest Gemini flagship with leading reasoning, coding, and multimodal input.",
    contextWindow: "1M ctx",
    costInfo: "$2.00 / 1M input · $12.00 / 1M output",
  },
];

// ============================================================
// Provider 图标（基于真实 SVG 还原）
// ============================================================

function ProviderIcon({
  provider,
}: {
  provider: ModelProvider;
  className?: string;
}) {
  const svgStyle: CSSProperties = {
    width: '14px',
    height: '14px',
    flexShrink: 0,
  };
  if (provider === "anthropic") {
    return (
      <svg style={svgStyle} viewBox="0 0 24 24" fill="#D97757" aria-hidden="true">
        <path d="M13.6 3h3.1l6.3 18h-3.2l-1.3-3.8h-6.6L10.7 21H7.5L13.6 3Zm-1.6 3.9-2.3 6.9h4.7L12 6.9Z" />
      </svg>
    );
  }
  if (provider === "openai") {
    return (
      <svg style={svgStyle} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }
  // gemini
  return (
    <svg style={svgStyle} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2c.4 4.7 3.3 8.4 8 9-4.7.6-7.6 4.3-8 9-.4-4.7-3.3-8.4-8-9 4.7-.6 7.6-4.3 8-9Z"
        fill="#3B82F6"
      />
    </svg>
  );
}

// ============================================================
// Metric Bars：10 格栅格 + scaleY transform 错峰动画
// ============================================================

const METRIC_COLORS: Record<keyof ModelMetrics, string> = {
  intelligence: "rgb(48, 164, 108)", // 绿色
  speed: "rgb(247, 107, 21)", // 橙色
  context: "rgb(48, 164, 108)", // 绿色
  cost: "rgb(229, 72, 77)", // 红色
};

const METRIC_LABELS: Record<keyof ModelMetrics, string> = {
  intelligence: "Intelligence",
  speed: "Speed",
  context: "Context",
  cost: "Cost",
};

function MetricBars({
  metric,
  value,
  infoText,
}: {
  metric: keyof ModelMetrics;
  value: number; // 0-10
  infoText?: string;
}) {
  const color = METRIC_COLORS[metric];
  const label = METRIC_LABELS[metric];
  // 动画控制：挂载后下一帧设为 true，从 scaleY(0)→scaleY(1) 触发 transition + transitionDelay 错峰
  // 配合 ModelPreviewCard 的 key={model.value}，hover 不同模型时重新挂载，动画重新播放
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontWeight: 500,
          fontSize: '10px',
          color: '#a3a3a3',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {label}
        </span>
        {infoText && (
          <span
            style={{
              cursor: 'help',
              fontSize: '10px',
              color: '#a3a3a3',
              lineHeight: 1,
            }}
            title={infoText}
          >
            ⓘ
          </span>
        )}
      </div>
      <div
        aria-label={`${label}: ${value} out of 10`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
          gap: '4px',
        }}
        role="img"
      >
        {Array.from({ length: 10 }, (_, i) => {
          const filled = i < value;
          return (
            <div key={i} style={{ height: '12px', overflow: 'hidden', borderRadius: '2px', backgroundColor: '#f5f5f5' }}>
              {filled && (
                <div
                  style={{
                    height: '100%',
                    width: '100%',
                    transformOrigin: 'bottom',
                    borderRadius: '2px',
                    transition: 'transform 300ms ease-out',
                    backgroundColor: color,
                    transform: grown ? 'scaleY(1)' : 'scaleY(0)',
                    transitionDelay: `${i * 25}ms`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 配置控件（通用 radiogroup：Reasoning / Speed 共用）
// ============================================================

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

const REASONING_OPTIONS: RadioOption<ReasoningLevel>[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Speed 仅 GPT-5.5 支持，原版抓取确认 Standard/Fast 两档，默认 Standard
const SPEED_OPTIONS: RadioOption<SpeedLevel>[] = [
  { value: "standard", label: "Standard" },
  { value: "fast", label: "Fast" },
];

/**
 * 通用配置 radiogroup 控件
 *
 * Reasoning 和 Speed 结构完全一致（label + radiogroup + 按钮组），
 * 提取为通用组件避免重复。data-config-radio 属性用于 CSS hover 伪类。
 *
 * @template T - 选项值类型（如 ReasoningLevel / SpeedLevel）
 */
function ConfigRadioGroup<T extends string>({
  label,
  ariaLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ color: '#737373', fontSize: '12px', lineHeight: 1 }}>{label}</p>
      <div
        aria-label={ariaLabel}
        style={{ display: 'flex', gap: '4px' }}
        role="radiogroup"
      >
        {options.map((opt) => {
          const checked = value === opt.value;
          return (
            <button
              key={opt.value}
              aria-checked={checked}
              data-config-radio=""
              style={{
                flex: 1,
                borderRadius: '6px',
                paddingLeft: '8px',
                paddingRight: '8px',
                paddingTop: '4px',
                paddingBottom: '4px',
                fontSize: '12px',
                transition: 'color, background-color, border-color 150ms',
                border: 'none',
                cursor: 'pointer',
                ...(checked
                  ? { backgroundColor: '#171717', color: '#ffffff' }
                  : { backgroundColor: '#f5f5f5', color: '#737373' }),
              }}
              role="radio"
              type="button"
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 预览卡片（hover 模型项后出现，portal 模拟）
// ============================================================

function ModelPreviewCard({
  model,
  configuration,
  onConfigurationChange,
}: {
  model: LLMModel;
  configuration: ModelConfiguration;
  onConfigurationChange: (next: ModelConfiguration) => void;
}) {
  return (
    <div
      data-open=""
      data-side="right"
      data-align="center"
      style={{
        overflow: 'hidden',
        borderRadius: '8px',
        border: '1px solid #e5e5e5',
        backgroundColor: '#ffffff',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        outline: 'none',
      }}
    >
      <div data-preview-card="" style={{ display: 'flex', width: '224px', flexDirection: 'column' }}>
        {/* 顶部：模型信息 + metric bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontWeight: 500, color: '#171717', fontSize: '14px' }}>{model.label}</p>
            <span style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '6px', color: '#737373', fontSize: '12px' }}>
              <ProviderIcon provider={model.provider} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {model.provider === "anthropic"
                  ? "Anthropic"
                  : model.provider === "openai"
                    ? "OpenAI"
                    : "Gemini"}
              </span>
            </span>
          </div>
          <p style={{
            textWrap: 'pretty',
            color: '#737373',
            fontSize: '12px',
            lineHeight: '16px',
          }}>
            {model.description}
          </p>
          <div style={{
            marginTop: '8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '16px',
            fontSize: '12px',
          }}>
            <MetricBars metric="intelligence" value={model.metrics.intelligence} />
            <MetricBars metric="speed" value={model.metrics.speed} />
            <MetricBars
              metric="context"
              value={model.metrics.context}
              infoText={`${model.contextWindow} context window`}
            />
            <MetricBars
              metric="cost"
              value={model.metrics.cost}
              infoText={model.costInfo}
            />
          </div>
        </div>
        {/* 底部：Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
          <p style={{
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontWeight: 600,
            fontSize: '10px',
            color: '#737373',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            Configuration
          </p>
          {/* Reasoning / Speed 配置组：原版抓取确认仅 GPT-5.5 多出 Speed（Standard/Fast） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ConfigRadioGroup
              label="Reasoning"
              ariaLabel="Reasoning level"
              options={REASONING_OPTIONS}
              value={configuration.reasoning ?? "medium"}
              onChange={(reasoning) => onConfigurationChange({ ...configuration, reasoning })}
            />
            {model.supportsSpeed && (
              <ConfigRadioGroup
                label="Speed"
                ariaLabel="Speed"
                options={SPEED_OPTIONS}
                value={configuration.speed ?? "standard"}
                onChange={(speed) => onConfigurationChange({ ...configuration, speed })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 下拉列表项
// ============================================================

function ModelOption({
  model,
  selected,
  highlighted,
  onSelect,
  onHover,
}: {
  model: LLMModel;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const providerName =
    model.provider === "anthropic"
      ? "Anthropic"
      : model.provider === "openai"
        ? "OpenAI"
        : "Gemini";

  return (
    <div
      role="option"
      aria-selected={selected}
      data-option=""
      data-selected={selected ? "" : undefined}
      style={{
        width: '100%',
        padding: 0,
        color: selected ? '#171717' : '#404040',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'flex-start',
          gap: '8px',
          borderRadius: '6px',
          paddingLeft: '6px',
          paddingRight: '6px',
          paddingTop: '6px',
          paddingBottom: '6px',
          cursor: 'pointer',
          ...(selected ? { backgroundColor: '#f5f5f5' } : {}),
        }}
        onClick={onSelect}
        onMouseEnter={onHover}
      >
        <div style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', gap: '2px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.label}</span>
          <span style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '6px', color: '#737373', fontSize: '12px' }}>
            <ProviderIcon provider={model.provider} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{providerName}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 下拉弹层（搜索框 + 列表 + 滚动遮罩 + 预览卡片）
// ============================================================

function ModelDropdown({
  models,
  selectedValue,
  highlightedIndex,
  configurations,
  onSelect,
  onHighlight,
  onConfigurationChange,
}: {
  models: LLMModel[];
  selectedValue: string;
  highlightedIndex: number;
  configurations: Record<string, ModelConfiguration>;
  onSelect: (model: LLMModel) => void;
  onHighlight: (index: number) => void;
  onConfigurationChange: (
    modelValue: string,
    next: ModelConfiguration
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = models.filter(
    (m) =>
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
  );

  // 弹层定位：用 absolute 而非 fixed
  // 原因：卡片预览有 transform: scale，position: fixed 会基于 transform 元素
  // （stage）而非视口定位，导致下拉弹层定位错乱被 overflow:hidden 裁剪不可见
  // absolute 基于 combobox 按钮的 position:relative wrapper，不受 transform 影响
  // top: 100% 紧贴按钮底部，marginTop: -1px 让 border-top 覆盖按钮 border-bottom 避免双线
  const popupStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: "-1px",
    zIndex: 50,
  };

  return (
    <div data-dropdown="" style={popupStyle}>
      <div
        data-open=""
        data-side="bottom"
        data-align="start"
        role="dialog"
        aria-label="Select model"
        style={{
          width: '240px',
          borderRadius: '12px',
          border: '1px solid #e5e5e5',
          backgroundColor: '#ffffff',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
          outline: 'none',
        }}
      >
        {/* 搜索框 */}
        <div
          role="group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: 0,
            border: 0,
            borderBottom: '1px solid #f5f5f5',
            backgroundColor: 'transparent',
            paddingLeft: '8px',
            paddingRight: '8px',
          }}
        >
          <input
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-autocomplete="list"
            placeholder="Search models..."
            data-search=""
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: '8px',
              paddingBottom: '8px',
              fontSize: '14px',
              outline: 'none',
              border: 'none',
            }}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 256 256"
            aria-hidden="true"
            style={{ flexShrink: 0, color: '#a3a3a3' }}
          >
            <path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z" />
          </svg>
        </div>
        <div style={{ position: 'relative' }}>
          {/* 模型列表 */}
          <div
            role="listbox"
            style={{
              maxHeight: '256px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              padding: '4px',
            }}
          >
            {filtered.map((model, idx) => {
              const originalIndex = models.indexOf(model);
              return (
                <ModelOption
                  key={model.value}
                  model={model}
                  selected={model.value === selectedValue}
                  highlighted={idx === highlightedIndex}
                  onSelect={() => onSelect(model)}
                  onHover={() => onHighlight(originalIndex)}
                />
              );
            })}
            {filtered.length === 0 && (
              <div style={{
                paddingLeft: '8px',
                paddingRight: '8px',
                paddingTop: '16px',
                paddingBottom: '16px',
                textAlign: 'center',
                color: '#a3a3a3',
                fontSize: '12px',
              }}>
                No models found
              </div>
            )}
          </div>
          {/* 滚动渐隐遮罩 */}
          <div
            aria-hidden="true"
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              height: '32px',
              backgroundImage: 'linear-gradient(to top, #ffffff, transparent)',
              transition: 'opacity 150ms',
              opacity: 0,
            }}
          />
        </div>
      </div>

      {/* 预览卡片：hover 模型项时出现，定位在列表项右侧 */}
      {highlightedIndex >= 0 && highlightedIndex < models.length && (
        <PreviewCardPortal
          models={models}
          highlightedIndex={highlightedIndex}
          configurations={configurations}
          onConfigurationChange={onConfigurationChange}
        />
      )}
    </div>
  );
}

// ============================================================
// 预览卡片 portal（定位在 hover 项右侧）
// ============================================================

function PreviewCardPortal({
  models,
  highlightedIndex,
  configurations,
  onConfigurationChange,
}: {
  models: LLMModel[];
  highlightedIndex: number;
  configurations: Record<string, ModelConfiguration>;
  onConfigurationChange: (
    modelValue: string,
    next: ModelConfiguration
  ) => void;
}) {
  const model = models[highlightedIndex];
  const config = configurations[model.value] ?? {};
  return (
    <div
      data-open=""
      data-side="right"
      data-align="center"
      data-preview-wrapper=""
      role="presentation"
      style={{
        zIndex: 60,
        position: "absolute",
        left: "calc(100% + 8px)",
        top: 0,
        pointerEvents: "auto",
      }}
    >
      <ModelPreviewCard
        key={model.value}
        model={model}
        configuration={config}
        onConfigurationChange={(next) =>
          onConfigurationChange(model.value, next)
        }
      />
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export function ModelSelectorPrompt({
  models,
  value,
  prompt,
  configurations,
  onModelChange,
  onPromptChange,
  onConfigurationChange,
  onSubmit,
}: ModelSelectorPromptProps) {
  const [open, setOpen] = useState(false);
  // 初始 -1：不显示预览卡片（原版预览卡片仅 hover 时出现，打开下拉不默认显示）
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const comboboxRef = useRef<HTMLButtonElement>(null);

  // 用 useId 生成唯一标识，隔离多实例的伪类 CSS
  const reactId = useId();
  const instanceId = 'ms-' + reactId.replace(/:/g, '');

  // 选中模型
  const selectedModel = models.find((m) => m.value === value) ?? models[0];

  // 当前选中模型的配置 chip：非默认配置才在 combobox 按钮上体现
  // reasoning 默认 medium，speed 默认 standard（仅 supportsSpeed 模型）
  // 原版行为：选择配置后主栏（combobox 按钮）显示当前配置状态
  const selectedConfig = configurations[selectedModel.value] ?? {};
  const configChips: { key: string; label: string }[] = [];
  if (selectedConfig.reasoning && selectedConfig.reasoning !== "medium") {
    const v = selectedConfig.reasoning;
    configChips.push({ key: "reasoning", label: `R·${v[0].toUpperCase()}${v.slice(1)}` });
  }
  if (
    selectedModel.supportsSpeed &&
    selectedConfig.speed &&
    selectedConfig.speed !== "standard"
  ) {
    const v = selectedConfig.speed;
    configChips.push({ key: "speed", label: `S·${v[0].toUpperCase()}${v.slice(1)}` });
  }

  // 打开下拉：切换 open 状态，不预设 highlightedIndex（预览卡片仅 hover 时显示）
  const handleComboboxClick = () => {
    setOpen((prev) => !prev);
    if (!open) setHighlightedIndex(-1);
  };

  // 关闭下拉（点击外部）
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // 点击 combobox 按钮本身由按钮 onClick 处理
      if (comboboxRef.current?.contains(target)) return;
      // 检查是否在下拉弹层内（含预览卡片，预览卡片是 dialog 的兄弟元素不在 dialog 内）
      const dropdown = document.querySelector(`[data-ms="${instanceId}"] [data-dropdown]`);
      if (dropdown?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // 键盘导航
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(models.findIndex((m) => m.value === value));
      } else if (e.key === "ArrowDown") {
        setHighlightedIndex((prev) => (prev + 1) % models.length);
      }
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + models.length) % models.length);
    } else if (e.key === "Escape" && open) {
      setOpen(false);
    }
  };

  // 选中模型
  const handleSelect = (model: LLMModel) => {
    onModelChange(model);
    setOpen(false);
  };

  // 配置变更
  const handleConfigChange = (
    modelValue: string,
    next: ModelConfiguration
  ) => {
    const nextConfigurations = { ...configurations, [modelValue]: next };
    onConfigurationChange(modelValue, next, nextConfigurations);
  };

  // 提交
  const handleSubmit = () => {
    onSubmit({
      model: selectedModel,
      configuration: configurations[selectedModel.value] ?? {},
      prompt,
    });
  };

  const providerName =
    selectedModel.provider === "anthropic"
      ? "Anthropic"
      : selectedModel.provider === "openai"
        ? "OpenAI"
        : "Gemini";

  // 伪类 CSS：hover / data-selected / placeholder 等
  const css = `
[data-ms="${instanceId}"] [data-combo]:hover {
  background-color: #fafafa;
}
[data-ms="${instanceId}"] [data-combo][data-popup-open] {
  background-color: #fafafa;
}
[data-ms="${instanceId}"] [data-send]:hover {
  background-color: #404040;
}
[data-ms="${instanceId}"] [data-option]:hover {
  background-color: #f5f5f5;
}
[data-ms="${instanceId}"] [data-option][data-selected] {
  background-color: #f5f5f5;
}
[data-ms="${instanceId}"] [data-config-radio]:not([aria-checked="true"]):hover {
  background-color: #e5e5e5;
  color: #171717;
}
[data-ms="${instanceId}"] [data-search]::placeholder {
  color: #a3a3a3;
}
[data-ms="${instanceId}"] [data-preview-card] > * + * {
  border-top: 1px solid #f5f5f5;
}
@keyframes ms-card-enter {
  from {
    opacity: 0;
    transform: scale(0.96) translateX(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateX(0);
  }
}
[data-ms="${instanceId}"] [data-preview-wrapper] {
  animation: ms-card-enter 180ms ease-out;
  transform-origin: left center;
}
`;

  return (
    <>
      <style>{css}</style>
      <div
        data-ms={instanceId}
        style={{
          display: 'flex',
          // 用 100% 而非 100vh：卡片预览画布有固定高度（stageHeight），
          // 100vh 会撑破画布被 overflow:hidden 裁剪；100% 基于 stage 高度，
          // sandbox 全屏模式下 stage 高度=100vh，同样撑满
          minHeight: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          padding: '32px',
        }}
      >
        <div style={{
          margin: '0 auto',
          display: 'flex',
          width: '100%',
          maxWidth: '448px',
          flexDirection: 'column',
          borderRadius: '12px',
          border: '1px solid #e5e5e5',
          backgroundColor: '#ffffff',
        }}>
          {/* 顶部 Textarea */}
          <textarea
            style={{
              minHeight: '64px',
              width: '100%',
              resize: 'none',
              backgroundColor: 'transparent',
              padding: '12px',
              fontWeight: 500,
              color: '#171717',
              fontSize: '14px',
              outline: 'none',
              border: 'none',
            }}
            placeholder="What do you want to do?"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
          {/* 底部操作栏 */}
          <div style={{
            display: 'flex',
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px',
          }}>
            {/* 模型选择 combobox + 下拉弹层 wrapper
                position: relative 作为 ModelDropdown absolute 定位上下文，
                替代原 fixed+anchorRect 方案（卡片预览 transform 会导致 fixed 失效） */}
            <span style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              ref={comboboxRef}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label="Select model"
              data-combo=""
              data-popup-open={open ? "" : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                backgroundColor: open ? '#fafafa' : '#ffffff',
                paddingLeft: '8px',
                paddingRight: '8px',
                paddingTop: '6px',
                paddingBottom: '6px',
                color: '#171717',
                fontSize: '14px',
                transition: 'color, background-color, border-color 150ms',
                cursor: 'pointer',
              }}
              onClick={handleComboboxClick}
              onKeyDown={handleKeyDown}
            >
              <span style={{ display: 'flex', minWidth: 0, flex: 1, alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '6px' }}>
                  <ProviderIcon provider={selectedModel.provider} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedModel.label}</span>
                  {/* 配置状态 chip：非默认配置在 combobox 按钮上体现（如 R·High / S·Fast） */}
                  {configChips.length > 0 && (
                    <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {configChips.map((chip) => (
                        <span
                          key={chip.key}
                          style={{
                            borderRadius: '4px',
                            backgroundColor: '#f5f5f5',
                            color: '#737373',
                            fontSize: '11px',
                            lineHeight: 1,
                            paddingLeft: '4px',
                            paddingRight: '4px',
                            paddingTop: '2px',
                            paddingBottom: '2px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {chip.label}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: '#737373' }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 256 256"
                  style={{
                    transition: 'transform 300ms ease-out',
                    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z" />
                </svg>
              </span>
            </button>
            {/* 下拉弹层：absolute 定位基于 combobox wrapper */}
            {open && (
              <ModelDropdown
                models={models}
                selectedValue={value}
                highlightedIndex={highlightedIndex}
                configurations={configurations}
                onSelect={handleSelect}
                onHighlight={setHighlightedIndex}
                onConfigurationChange={handleConfigChange}
              />
            )}
            </span>

            {/* Send 按钮 */}
            <button
              data-send=""
              style={{
                display: 'inline-flex',
                height: '32px',
                flexShrink: 0,
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                backgroundColor: '#171717',
                paddingLeft: '12px',
                paddingRight: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#ffffff',
                transition: 'color, background-color, border-color 150ms',
                border: 'none',
                cursor: 'pointer',
              }}
              type="button"
              onClick={handleSubmit}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="currentColor"
                viewBox="0 0 256 256"
              >
                <path d="M231.4,44.34s0,.1,0,.15l-58.2,191.94a15.88,15.88,0,0,1-14,11.51q-.69.06-1.38.06a15.86,15.86,0,0,1-14.42-9.15L107,164.15a4,4,0,0,1,.77-4.58l57.92-57.92a8,8,0,0,0-11.31-11.31L96.43,148.26a4,4,0,0,1-4.58.77L17.08,112.64a16,16,0,0,1,2.49-29.8l191.94-58.2.15,0A16,16,0,0,1,231.4,44.34Z" />
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export { DEFAULT_LLM_MODELS };
export type {
  LLMModel,
  ModelMetrics,
  ModelProvider,
  ModelConfiguration,
  ReasoningLevel,
  ModelSelectorPromptProps,
};
