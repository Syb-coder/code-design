---
id: react-business-modern-login-signup
name: Modern Login & Signup
techStack: react
styling: inline-style
animation: three.js-shader
category: business
tags: [login, form, auth, input, button, minimal, monochrome, dark, mysterious, serious, auth, onboarding, hero, three.js, shader, glsl, webgl, dot-matrix, futuristic, cyberpunk, scifi]
dependencies: [three]
fonts: [Inter]
source: 21st.dev
sourceUrl: https://21st.dev/@pulseawan/components/modern-login-signup
author: Muhammad Asif
createdAt: 2026-07-02
updatedAt: 2026-07-02
---

# Modern Login & Signup

## 视觉描述
全屏纯黑背景上覆盖一层 Three.js ShaderMaterial 渲染的 2D 点阵动画：屏幕被划分为 20px 网格，每个单元格中心绘制 6px 白色小点，根据 GLSL fragment shader 算法独立闪烁。点阵以屏幕中心为原点，按距离延迟起播，形成从中心向外扩散的波纹动画；每个点的最大透明度从 [0.3, 0.5, 0.8, 1.0] 四档中随机选取，配合 CustomBlending（SrcAlpha + One）叠加发光，营造出星空呼吸般的科技氛围。

中央叠加径向渐变黑色遮罩，将视觉焦点收束到中心的深灰色登录卡片（#121212，圆角 12px，1px #222 边框，深阴影）。

卡片支持登录/注册双态切换（点击底部按钮切换）。登录态：44px 圆形头像（"JS" 字样）+ 主标题 "Sign in to Account" + 邮箱输入框 + "Continue with Email" 实色按钮 + 分割线 + Google/GitHub/Apple 三个三方登录按钮。注册态：标题改为 "Sign up for Account"，表单增加姓名输入框，按钮文案改为 "Sign Up with Email"，三方按钮前缀改为 "Sign up with"。

整体配色黑灰白三色，无彩色，氛围神秘严肃，带未来感与赛博朋克气息。点阵动画连续呼吸无卡顿，卡片静止无过渡动效。

## 关键 API
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| avatarText | string | 'JS' | 头像文字 |
| loginTitle | string | 'Sign in to Account' | 登录态主标题 |
| loginSubtitle | string | 'Sign in to your Account.' | 登录态副标题 |
| signupTitle | string | 'Sign up for Account' | 注册态主标题 |
| signupSubtitle | string | 'Create a new account to get started.' | 注册态副标题 |
| emailPlaceholder | string | 'name@work-email.com' | 邮箱占位符 |
| namePlaceholder | string | 'Full Name' | 注册态姓名占位符 |
| loginButtonText | string | 'Continue with Email' | 登录提交按钮文案 |
| signupButtonText | string | 'Sign Up with Email' | 注册提交按钮文案 |
| loginProviders | AuthProvider[] | Google/GitHub/Apple | 登录态三方供应商 |
| signupProviders | AuthProvider[] | Google/GitHub/Apple | 注册态三方供应商 |
| loginSwitchPrompt | string | "Don't have an account?" | 登录态切换文案 |
| loginSwitchAction | string | 'Sign Up' | 登录态切换按钮 |
| signupSwitchPrompt | string | 'Already have an account?' | 注册态切换文案 |
| signupSwitchAction | string | 'Sign In' | 注册态切换按钮 |
| termsText | ReactNode | Vercel 占位文案 | 服务条款 |
| onLoginSubmit | (email: string) => void | - | 登录提交回调 |
| onSignupSubmit | (name: string, email: string) => void | - | 注册提交回调 |

## 最小使用示例
```tsx
import ModernLoginSignup from '@/library/react/business/modern-login-signup';

<ModernLoginSignup />
```

带自定义配置：
```tsx
import ModernLoginSignup from '@/library/react/business/modern-login-signup';

<ModernLoginSignup
  avatarText="AI"
  loginTitle="Welcome Back"
  onLoginSubmit={(email) => console.log(email)}
/>
```

## 源码路径
`library/react/business/modern-login-signup/index.tsx`（相对路径，AI 读取时自动拼接项目根）

## 适用场景
- 登录页 / 注册页主视觉
- SaaS 产品认证入口
- 需要未来感/科技感的认证场景
- 暗色主题产品
- 需要 shader 动效烘托氛围的 Hero 区
- 需要登录/注册切换的认证组件

## 实现说明
本组件源码通过 `npx shadcn@latest add` 从 21st.dev registry 获取（非 fetch-source.ts 抓取，因 21st.dev 渲染后 DOM 不含 Three.js shader 逻辑）。

核心技术：Three.js ShaderMaterial + GLSL3 实现 2D 点阵呼吸/波纹扩散动画。OrthographicCamera + PlaneGeometry(2,2) 全屏覆盖，fragment shader 内做点阵布局。点阵每个单元格根据 random() + u_time 闪烁，从中心向外波纹扩散。CustomBlending（SrcAlpha + One）实现叠加发光效果。

改造点（相对原 21st.dev 源码）：移除 "use client" 指令（本项目是 Vite）；动态 `<script>` 加载 Three.js 改为 ESM import（本项目已装 three 包）；硬编码文案提取为 Props；类型从 any 收窄为 THREE.WebGLRenderer / ShaderMaterial 等；加文件头注释 + JSDoc。
