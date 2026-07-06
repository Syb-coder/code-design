// @ts-nocheck
/**
 * 预览入口 - HeroUI Input OTP
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局：
 *   - 居中展示 Basic 示例（与 21st.dev demoCode 一致）
 *   - 浅色背景对齐原 demo（HeroUI 默认浅色主题）
 *
 * 样式依赖：
 *   - 项目已安装 tailwindcss v4 + @tailwindcss/vite 插件（vite.config.ts 已配置）
 *   - src/styles/heroui.css 全局引入 Tailwind + @heroui/styles，编译所有 @apply 指令
 *   - 本 preview.tsx 直接使用 HeroUI 原生样式
 *
 * 主题变量覆盖（对齐 21st.dev demo 实测值）：
 *   通过 Playwright 实测 21st.dev iframe 渲染后的 :root 计算样式：
 *     --radius: 0.625rem（HeroUI 默认 0.5rem）→ --field-radius: calc(0.625rem*1.5)=15px
 *     --border-width: 1px（默认 0px）
 *     --border-width-field: 0px / --field-border: transparent（slot 无可见边框）
 *   在最外层 div 通过 style 注入这些变量，让 HeroUI 组件按 demo 主题渲染。
 */

import { InputOTP } from './index'
import { Label, Link } from '@heroui/react'

export default function Preview() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        boxSizing: 'border-box',
        // 对齐 21st.dev demo 主题变量（实测值，见文件头注释）
        // --field-radius 需显式覆盖，因 :root 上的 calc 已在全局求值，不会因子元素 --radius 改变而重算
        '--radius': '0.625rem',
        '--field-radius': '0.9375rem',
        '--border-width': '1px',
        '--border-width-field': '0px',
        '--field-border': 'transparent',
      } as React.CSSProperties}
    >
      {/* 对齐 21st.dev 官方 Basic 示例 */}
      <div className="flex w-[280px] flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Label>Verify account</Label>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a code to a****@gmail.com
          </p>
        </div>
        <InputOTP maxLength={6}>
          <InputOTP.Group>
            <InputOTP.Slot index={0} />
            <InputOTP.Slot index={1} />
            <InputOTP.Slot index={2} />
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            <InputOTP.Slot index={3} />
            <InputOTP.Slot index={4} />
            <InputOTP.Slot index={5} />
          </InputOTP.Group>
        </InputOTP>
        <div className="flex items-center gap-[5px] px-1 pt-1">
          <p className="text-sm text-muted-foreground">Didn&apos;t receive a code?</p>
          <Link className="text-foreground underline" href="#">
            Resend
          </Link>
        </div>
      </div>
    </div>
  )
}
