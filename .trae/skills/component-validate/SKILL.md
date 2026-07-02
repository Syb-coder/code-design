---
name: "component-validate"
description: "组件校验：执行G1静态/G2渲染双图对比/G3 AI自评三层校验，产出JSON校验报告。当入库Skill生成产物后转交，或用户手动'/校验组件'，或入库后纠错触发时调用。"
---

# 校验 Skill

> **核心职责**：执行 G1/G2/G3 三层校验，产出 JSON 校验报告，回交入库 Skill 或展示给用户。
> **关键约束**：校验 Skill 本身**无状态不主动重试**，重试由入库 Skill 读报告后触发；失败兜底（写 `_inbox/`）由入库 Skill 负责。

## 一、三层 Gate 总览

> **sourceType 分级原则**：校验强度按 `meta.json.sourceType` 分级。`registry-source`/`pasted-code` 有真实源码可做实现保真度对比；`rendered-dom`/`screenshot-restore` 无真实源码，只能视觉+静态校验，**overall 最高为 `warn`**，强制 G4 人工确认逻辑保真。

| Gate | 校验内容 | 方式 | 失败处理 |
|------|---------|------|---------|
| **G1 静态校验** | TS 编译、meta.json Schema（含 `sourceType` 枚举）、card.md frontmatter、grep 黑名单、依赖一致性、**还原模式警示标注** | `.trae/skills/component-validate/scripts/validate-component.ts` | 由入库 Skill 自动修复重试（最多 3 次） |
| **G2 渲染校验** | 沙箱路由渲染不报错 + Playwright **多帧截图** pixelmatch 对比（相似度 ≥ 0.7）+ **可交互元素探测** | `.trae/skills/component-validate/scripts/screenshot-diff.ts` + 预览应用 `/__sandbox__/:id` | 由入库 Skill 半自动重试（最多 3 次） |
| **G3 AI 自评** | 视觉描述一致性、Props 覆盖度、tags 六维 ≥2、分类合理性 + **实现保真度检查**（按 sourceType 分级：有真实源码则逐项对比核心逻辑，无源码则标注无法验证） | AI 二次调用 | 由入库 Skill 对照原文重生成卡片（最多 2 次） |

## 二、G1 静态校验

**调用脚本**：
```bash
npx tsx .trae/skills/component-validate/scripts/validate-component.ts --component "<组件目录>"
```

脚本检查项：
1. **TypeScript 编译**：`tsc --noEmit` 通过
2. **meta.json Schema 校验**：必填字段（`id`/`name`/`techStack`/`category`/`tags`/`dependencies`/`source`/`sourceUrl`/`sourceType`/`createdAt`）、枚举值合法（`techStack` ∈ react/html/vue/visualization，`category` ∈ ui-basic/business/effects/three/canvas/svg，**`sourceType` ∈ registry-source/pasted-code/rendered-dom/screenshot-restore**）
3. **card.md frontmatter 校验**：含 `id`/`name`/`techStack`/`category`/`tags`/`dependencies`/`source`
4. **grep 黑名单扫描**：`console.log` / `debugger` / `api[_-]?key` / `token` / `https?://.*api`
5. **依赖声明一致性**：`card.md` 与 `meta.json` 声明的 deps 一致，且 ⊆ `package.json` 已装 deps
6. **还原模式警示标注**（仅 `sourceType=rendered-dom`）：card.md 必须含"还原实现"关键词，否则报 `restore-warning` 错误（防止还原产物隐瞒风险等级）
7. **真实源码留存校验**（仅 `sourceType ∈ {registry-source, pasted-code}`）：`_source/original-source.tsx`（或 `.html`/`.vue`）必须存在，否则报 `source-missing` 错误（无真实源码则 G3 无法做实现保真度对比）

**脚本输出 JSON**：
```json
{
  "componentId": "react-ui-basic-button-glow",
  "sourceType": "registry-source",
  "g1": {
    "pass": false,
    "errors": [
      { "type": "ts-compile", "file": "index.tsx", "line": 12, "message": "Cannot find name 'foo'" },
      { "type": "blacklist", "file": "index.tsx", "line": 5, "match": "console.log" },
      { "type": "restore-warning", "file": "card.md", "message": "sourceType=rendered-dom 但 card.md 未含还原实现警示" },
      { "type": "source-missing", "message": "sourceType=registry-source 但 _source/original-source.tsx 不存在" }
    ]
  }
}
```

## 三、G2 渲染校验

**前置条件**：预览应用沙箱路由 `/__sandbox__/:id` 可访问（需预览应用 dev server 运行中）。

**调用脚本**：
```bash
npx tsx .trae/skills/component-validate/scripts/screenshot-diff.ts --component "<组件目录>" --preview-url "http://localhost:5173/__sandbox__/<id>"
```

脚本流程：
1. Playwright 启动，访问沙箱路由（1280×800，纯白背景，等待 1.5s 动画起播）
2. 检测 React error boundary 注入的 `data-render-error` 属性，命中则直接判失败
3. 截第一帧保存为 `_source/rendered.png`（起播帧，t=1.5s）
4. **再等待 1.5s 截第二帧**保存为 `_source/rendered-stable.png`（稳定帧，t=3s）——用于捕捉动画轨迹/状态切换，供 G3 分析"动画类型是否一致"
5. **可交互元素探测**：`page.evaluate` 扫描 `button`/`a`/`input[type=submit]`/`[role=button]`/可切换控件，输出 `interactiveElements` 清单——供 G3 检查"真实源码有的交互，还原版是否也实现"
6. 若存在 `_source/original.png`，与 `rendered.png` 做 pixelmatch 对比，相似度 ≥ 0.7 通过
7. 若无 `original.png`（代码粘贴模式），G2 退化为"仅渲染不报错即通过"
8. 产出 `diff.png`（差异图，供 G4 人工确认查看）

**脚本输出 JSON**：
```json
{
  "componentId": "react-ui-basic-button-glow",
  "g2": {
    "pass": true,
    "renderError": false,
    "similarity": 0.83,
    "diffPath": "_source/diff.png",
    "renderedPath": "_source/rendered.png",
    "renderedStablePath": "_source/rendered-stable.png",
    "interactiveElements": [
      { "tag": "button", "text": "登录", "role": "submit" },
      { "tag": "button", "text": "注册", "role": "switch" }
    ],
    "mode": "compare" | "render-only"
  }
}
```

**相似度阈值 0.7 说明**：经验值，过低漏检、过高误报，可通过 `--threshold` 参数覆盖。相似度仅衡量**单帧视觉相似**，不保证功能/逻辑一致——功能一致性由 G3 实现保真度检查负责。

## 四、G3 AI 自评

> G3 需要 AI 推理能力，归校验 Skill 完整 owning 三层。
> **V1 教训**：还原版曾通过 G3 自评，但把 ShaderMaterial 2D 点阵猜成 3D 漂浮粒子、漏掉登录/注册双态切换。根因是 G3 对照的"原始抓取内容"是渲染后 DOM（不含 JS 逻辑），导致同源偏差。G3 现按 sourceType 分级：有真实源码时做实现保真度逐项对比，无源码时标注无法验证。

**AI 行为**：
1. 读取以下输入：
   - **真实源码**（`sourceType ∈ {registry-source, pasted-code}` 时）：`_source/original-source.tsx`（或 `.html`/`.vue`）——实现保真度对比的权威基准
   - 原始抓取内容：`_source/original.html`（URL 模式，渲染后 DOM，仅作视觉参考，**不含 JS 逻辑，不可作为逻辑保真基准**）
   - 原页截图：`_source/original.png`（URL 模式）
   - 本地渲染截图：`_source/rendered.png`（G2 起播帧）+ `_source/rendered-stable.png`（G2 稳定帧）——双帧用于判断动画类型是否一致
   - G2 可交互元素清单 `interactiveElements`——用于检查还原版是否实现了真实源码的所有交互入口
   - 净化后源码：`index.tsx`
   - 已生成的 `card.md` / `meta.json`
2. 逐项自检（前 4 项所有 sourceType 都做；第 5 项按 sourceType 分级）：
   - **视觉描述一致性**：card.md 的"视觉描述"是否与 original.png / rendered.png / rendered-stable.png 一致
   - **Props 覆盖度**：card.md 列出的 Props 是否覆盖所有可配置项（检查源码中硬编码的值）
   - **tags 六维 ≥2**：meta.json 的 tags 是否覆盖六个维度（功能/风格/情绪/场景/技术/灵感），每维度至少 2 个
   - **分类合理性**：`techStack + category` 是否匹配组件实际类型
   - **实现保真度**（`fidelityCheck`，按 sourceType 分级）：
     - `registry-source` / `pasted-code`（有真实源码）：逐项对比 `original-source.tsx` 与 `index.tsx`：
       - `coreTech`：核心技术（shader/canvas/svg/动画库）是否保留——V1 教训：ShaderMaterial 被猜成 3D 粒子
       - `stateMgmt`：状态管理（useState/useReducer）是否保留——V1 教训：isLogin 登录/注册切换被漏掉
       - `interaction`：事件监听/交互入口是否保留——对照 G2 的 `interactiveElements` 检查
       - `props`：核心可配置 props 是否保留
       - 任一项 fail → G3 fail，overall 必然 fail（即使 G1/G2 通过）
     - `rendered-dom` / `screenshot-restore`（无真实源码）：`fidelityCheck` 标记 `skipped`，note 注明"无真实源码，无法验证实现保真度，需 G4 人工确认逻辑"
3. 输出自评报告：

```json
{
  "componentId": "react-ui-basic-button-glow",
  "sourceType": "registry-source",
  "g3": {
    "pass": true,
    "score": 0.9,
    "checks": {
      "visualConsistency": { "pass": true, "note": "描述与截图一致" },
      "propsCoverage": { "pass": false, "note": "缺少 size 参数" },
      "tagsSixDim": { "pass": true, "note": "六维均覆盖" },
      "categoryFit": { "pass": true, "note": "react/ui-basic 合理" },
      "fidelityCheck": {
        "status": "passed",
        "sourceType": "registry-source",
        "checks": {
          "coreTech": { "pass": true, "note": "ShaderMaterial + GLSL3 保留" },
          "stateMgmt": { "pass": true, "note": "isLogin 登录/注册切换保留" },
          "interaction": { "pass": true, "note": "切换按钮与 G2 interactiveElements 对齐" },
          "props": { "pass": true, "note": "17 个文案 props 保留" }
        }
      }
    },
    "risks": ["Props 缺少 size 参数"]
  }
}
```

**无真实源码时的 fidelityCheck 示例**：
```json
"fidelityCheck": {
  "status": "skipped",
  "sourceType": "rendered-dom",
  "note": "无真实源码（渲染后 DOM 不含 JS 逻辑），无法验证实现保真度，需 G4 人工确认"
}
```

## 五、汇总校验报告

合并 G1/G2/G3 结果为最终报告：

```json
{
  "componentId": "react-ui-basic-button-glow",
  "componentDir": "library/react/ui-basic/button-glow",
  "sourceType": "registry-source",
  "overall": "pass | fail | warn",
  "g1": { "pass": true, "errors": [] },
  "g2": { "pass": true, "similarity": 0.83, "diffPath": "_source/diff.png" },
  "g3": { "pass": true, "score": 0.9, "fidelityCheck": { "status": "passed" }, "risks": ["Props 缺少 size 参数"] },
  "report": "人类可读摘要：G1 通过 / G2 通过（相似度 0.83）/ G3 通过（评分 0.9，保真度 passed，风险：Props 缺少 size 参数）",
  "timestamp": "2026-07-01T12:00:00Z"
}
```

**overall 判定规则**（按 sourceType 分级）：
- `pass`：G1/G2/G3 全部通过 **且** `sourceType ∈ {registry-source, pasted-code}` **且** `fidelityCheck.status = passed`——有真实源码且实现保真度逐项通过
- `warn`：G1/G2 通过，但满足以下任一：
  - G3 有 risks
  - `sourceType ∈ {rendered-dom, screenshot-restore}`（无真实源码，无法验证逻辑保真）
  - `fidelityCheck.status = skipped`
- `fail`：G1 或 G2 失败，**或** G3 的 `fidelityCheck` 任一子项 fail（核心逻辑偏离真实源码）

> **关键设计**：`rendered-dom`/`screenshot-restore` 模式 overall 最高为 `warn`，强制进入 G4 人工确认逻辑保真——因为无真实源码时 AI 无法自动验证实现正确性，必须人工把关。

## 六、回交与展示

- **入库流程转交**：将汇总报告回交入库 Skill，由其决定重试 / 降级 / 进入 G4
- **手动触发（`/校验组件 <id>`）**：直接展示报告给用户，不触发入库流程
- **入库后纠错**：展示报告，由用户决定是否重新净化 / 重新生成卡片 / 标记删除

报告写入组件目录 `_source/ingest-log.json` 作为入库日志留存。

## 七、批量校验

批量场景调 `.trae/skills/component-validate/scripts/batch-validate.ts`：
```bash
npx tsx .trae/skills/component-validate/scripts/batch-validate.ts --scan library/
```
脚本会：
1. 扫描 `library/` 下所有组件目录（忽略 `_inbox/` `_archive/` `_source/`）
2. 逐个生成校验任务
3. 输出 `.trae/skills/component-validate/.batch/validate-tasks.json` 给 AI 按本 Skill 流程逐个处理
4. AI 拿到任务清单后，逐个执行 G1/G2/G3，汇总报告

注意：批量校验时 G2 需要预览应用 dev server 运行中，脚本会提示启动命令。
