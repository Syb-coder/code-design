# Code Design

一个面向 AI 辅助开发的本地 UI 组件知识库与预览工具。项目将高质量组件按目录、源码、元数据和 AI 卡片进行整理，并通过 Vite Web 应用提供搜索、筛选、预览和详情浏览，帮助开发者在生成新界面时快速找到可参考的实现。

## 核心能力

- 组件卡片网格与详情页浏览
- 按分类、标签和关键词筛选
- 组件搜索及同义词辅助检索
- 组件源码、元数据和预览信息展示
- 全屏预览、沙盒预览和响应式查看
- 为 AI 使用场景保留的组件知识库结构与索引文档
- 通过 PRD 记录收集、整理、校验和检索工作流

## 技术栈

- React 19 + TypeScript
- Vite 6
- React Router
- HeroUI
- Tailwind CSS
- Framer Motion
- Three.js / React Three Fiber
- Playwright、pixelmatch、PNGJS（测试或视觉校验工具）

## 环境要求

- Node.js 20+
- npm 10+（以 `package.json` 和 lockfile 为准）

## 快速开始

```bash
git clone https://github.com/Syb-coder/code-design.git
cd code-design
npm install
npm run dev
```

开发服务器启动后，按终端提示打开本地地址（通常为 `http://localhost:5173`）。

生产构建与预览：

```bash
npm run build
npm run preview
```

## 项目结构

```text
src/
├── components/       # 组件卡片、预览、筛选和详情相关 UI
├── lib/               # 类型、搜索、数据加载和辅助逻辑
├── pages/             # 首页、详情页和沙盒页
├── styles/            # 全局样式与设计 token
└── App.tsx            # 应用入口与路由组织
docs/                  # 产品需求和知识库工作流文档
```

组件素材的具体存储位置和扫描规则请参考 `src/lib/scan-components.ts`、`src/lib/preview-loader.tsx` 及项目文档。新增组件时，应同时补充清晰的名称、分类、来源、依赖和使用说明，避免只有演示而缺少可复用信息。

## 开发规范

- 运行 `npm run build` 检查 TypeScript 类型和生产构建。
- 修改交互或视觉效果后，优先在本地预览验证桌面端和窄屏布局。
- 组件来源、第三方素材及字体应保留相应许可或来源说明。
- 不要将 API 密钥、个人凭据或未经授权的商业素材提交到仓库。

## 产品文档

- [产品需求文档](docs/PRD.md)
- [AI 卡片模板](docs/ai-card-template.md)
- [组件 URL 收集清单](docs/组件URL收集清单.md)

## 许可与使用

本项目主要用于个人知识沉淀、UI 研究和 AI 辅助开发。使用仓库中的第三方组件、字体、图片或示例代码时，请分别遵守其原始许可证和来源平台的使用条款。
