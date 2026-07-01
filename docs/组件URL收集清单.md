# 开源组件 URL 收集清单

> **用途**：收集待入库的开源组件 URL，供后续入库 Skill 脚本批量处理。
> **创建日期**：2026-07-01
> **状态**：收集中

---

## 收集清单

| 序号 | 组件名称 | URL | 技术栈 | 预估分类 | 状态 | 备注 |
|------|---------|-----|--------|---------|------|------|
| 1 | Modern Login Signup | https://21st.dev/@pulseawan/components/modern-login-signup | React + TypeScript | business / auth | 📥 待处理 | 登录注册表单 |
| 2 | Spotlight Card | https://21st.dev/@easemize/components/spotlight-card | React + TypeScript | effects / business | 📥 待处理 | 鼠标跟随聚光灯卡片 |
| 3 | Dotted Surface | https://21st.dev/@efferd/components/dotted-surface | React + TypeScript | effects / background | 📥 待处理 | 点状背景动效 |
| 4 | Slider with Plus Minus | https://21st.dev/@originui/components/slider/slider-with-plus-munis | React + TypeScript | ui-basic | 📥 待处理 | 带加减按钮的滑块 |
| 5 | Chat Input | https://21st.dev/@simple-ai/components/chat-input | React + TypeScript | business | 📥 待处理 | 聊天输入框 |
| 6 | AI Voice Input | https://21st.dev/@kokonutd/components/ai-voice-input | React + TypeScript | business | 📥 待处理 | AI语音输入组件 |

---

## 处理状态说明

- ⏳ 待收集：等待用户提供 URL
- 📥 待处理：已收录，等待入库 Skill 处理
- ✅ 已入库：已完成入库 + 校验
- ⚠️ 需人工：G1/G2/G3 连续失败，降级到 _inbox/

---

## 后续脚本规划

基于这些 URL 开发的脚本：

1. **批量抓取脚本**：调用 `scripts/fetch-source.ts` 批量抓取所有 URL 的原始素材
2. **批量入库脚本**：调用人库 Skill 批量处理
3. **批量校验脚本**：调用校验 Skill 批量校验

