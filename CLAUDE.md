# 本地组件知识库

本项目是个人组件知识库，供 AI 在 vibecoding 时参考本地高质量组件素材。完整规范见 `docs/PRD.md`。

## 三个 Skill（按需调用，勿全量读取）

### 入库 Skill
- 触发：用户发来组件代码 / 截图 / URL
- 路径：`.trae/skills/component-ingest/SKILL.md`
- 调用时机：识别到用户想"整理/收录/保存这个组件"时

### 校验 Skill
- 触发：入库流程转交 / 用户手动校验某组件 / 入库后纠错
- 路径：`.trae/skills/component-validate/SKILL.md`
- 调用时机：入库流程生成产物后转交；或用户说"校验/检查 xxx 组件"时

### 检索 Skill
- 触发：用户 vibecoding 描述需求，需要参考组件
- 路径：`.trae/skills/component-search/SKILL.md`
- 调用时机：识别到用户想"找组件/参考/看看有没有合适的"时

## 目录结构速览
- `library/react/`         - React 组件
- `library/html/`          - 原生 HTML 组件
- `library/vue/`           - Vue 组件
- `library/visualization/` - 可视化组件
- `library/_inbox/`        - 入库失败待人工处理队列
- `library/_archive/`      - 已归档/标记删除组件
- `.trae/skills/`          - Skill 目录（每个 skill 含 SKILL.md + scripts/ + .batch/）

## 组件存储结构（每个组件目录）
- `index.tsx` / `index.html` / `index.vue` - 源码
- `preview.tsx`                          - 预览入口
- `card.md`                              - AI 卡片（摘要）
- `meta.json`                            - 元数据（含 sourceType 决定校验分级）
- `_source/`                             - 原始素材（代码/URL 模式均留存，供纠错重放）
  - `original-source.tsx`                - 真实源码（pasted-code/registry-source 模式，G3 保真度基准）

## 批量处理脚本（已归入各 skill 目录）
- `.trae/skills/component-ingest/scripts/batch-fetch.ts`    - 批量抓取（读 `docs/组件URL收集清单.md` → 调 fetch-source.ts）
- `.trae/skills/component-ingest/scripts/batch-ingest.ts`   - 批量入库（读抓取产物 → 生成入库任务清单给 AI 按 Skill 处理）
- `.trae/skills/component-validate/scripts/batch-validate.ts` - 批量校验（扫描 `library/` → 生成校验任务清单给 AI 按 Skill 处理）

## 重要约定
- AI 卡片内源码路径用**相对路径**，勿用绝对路径
- URL 模式入库禁止 AI 自己 fetch，必须调 `.trae/skills/component-ingest/scripts/fetch-source.ts`
- 批量脚本产出统一写入所属 skill 的 `.batch/` 工作目录（任务清单、状态、日志）
- 详细规范见对应 Skill 文件，按需读取

## 预览缩放约定（宽幅组件必读）
ComponentPreview 的 stage 固定 640 画布，宽幅组件（设计宽 > 640，如三列定价卡片、Dashboard 多列布局）在 640 下布局会折叠。**禁止在 preview.tsx 手写缩放逻辑**，改用公共组件：

```tsx
import { PreviewScaler } from '@/components/PreviewScaler';

export default function Preview() {
  return (
    <PreviewScaler designWidth={1280} style={{ backgroundColor: '#050505' }}>
      <YourComponent />
    </PreviewScaler>
  );
}
```

- `designWidth`：组件设计宽度（如 1280），保证 grid/flex 布局正确
- PreviewScaler 自动 contain 模式缩放 + 居中，适配沙箱/卡片/详情页三场景
- 装饰性 overlay（如背景色选择器）放在 PreviewScaler 外层的兄弟元素，用 absolute + z-index 叠加
- 设计宽 ≤ 640 的简单组件无需 PreviewScaler，preview.tsx 直接 100%×100% 渲染
