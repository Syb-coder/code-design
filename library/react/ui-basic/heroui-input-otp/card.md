---
id: react-ui-basic-heroui-input-otp
name: HeroUI Input OTP
techStack: react
styling: tailwind
animation: none
category: ui-basic
tags: [input, otp, verification, form, minimal, clean, serious, accessible, auth, 2fa, heroui, segmented, controlled, modern, functional]
dependencies: [@heroui/react, @heroui/styles]
fonts: []
source: 21st.dev
sourceUrl: https://21st.dev/@reapollo/components/heroui-input-otp
installCommand: npx @21st-dev/cli add larsen66/heroui-input-otp
author: David Hakobyan
createdAt: 2026-07-03
updatedAt: 2026-07-03
---

# HeroUI Input OTP

> ℹ️ 本组件是 HeroUI v3 设计系统 InputOTP 组件的 re-export 适配层（21st.dev 标准 registry 模式）。
> 实际组件实现在 `@heroui/react` 内部，本文件仅做命名导出 + 默认导出，统一引用路径为
> `@/components/ui/heroui-input-otp`。下方 API 与示例基于官方 10 个示例代码归纳。

## 视觉描述
分段式 OTP（一次性密码）输入组件。每个输入位是一个独立的圆角矩形槽位（Slot），
槽位之间有细微间距，可通过 Separator 添加组间分隔符（如 6 位分成 3+3 两组）。

默认态：浅色边框 + 白色背景 + 占位文字色（中性灰）。
聚焦态：边框变蓝（HeroUI primary 色），当前槽位高亮。
输入态：已填入的槽位显示深色文字 + 略深边框。
禁用态：整体灰化，光标禁用。
错误态：边框变红，配合 `aria-describedby` 显示错误文案。

整体风格极简、克制，符合 HeroUI v3 设计语言。无动画装饰，专注功能性与可访问性。

## 关键 API

### InputOTP 主组件 Props
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxLength | number | - | 必填，最大输入位数（如 6 位 OTP） |
| value | string | - | 受控值（受控模式必填） |
| onChange | (value: string) => void | - | 值变化回调 |
| onComplete | (value: string) => void | - | 所有位填满时触发 |
| pattern | RegExp | - | 输入模式正则（如 REGEXP_ONLY_DIGITS） |
| isDisabled | boolean | false | 禁用态 |
| isInvalid | boolean | false | 错误态（边框变红） |
| variant | "primary" \| "secondary" | "primary" | 视觉变体 |
| name | string | - | 表单字段名（用于 FormData 读取） |
| aria-describedby | string | - | 错误文案元素 id，无障碍关联 |

### 子组件
| 组件 | 说明 |
|------|------|
| InputOTP.Group | 分组容器，包裹一组 Slot |
| InputOTP.Slot | 单个输入槽，必填 `index` 属性（从 0 开始） |
| InputOTP.Separator | 组间分隔符（如 "-" 或 "•"） |

### 预置正则常量
| 常量 | 说明 |
|------|------|
| REGEXP_ONLY_DIGITS | 仅允许数字 `[0-9]` |
| REGEXP_ONLY_CHARS | 仅允许字母 `[a-zA-Z]` |
| REGEXP_ONLY_DIGITS_AND_CHARS | 数字 + 字母 |

## 最小使用示例

### 1. 基础 6 位 OTP（与 21st.dev Basic 示例一致）
```tsx
import { InputOTP } from "@/components/ui/heroui-input-otp"
import { Label, Link } from "@heroui/react"

export default function Basic() {
  return (
    <div className="flex w-[280px] flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label>Verify account</Label>
        <p className="text-sm text-muted-foreground">We've sent a code to a****@gmail.com</p>
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
        <p className="text-sm text-muted-foreground">Didn't receive a code?</p>
        <Link className="text-foreground underline" href="#">Resend</Link>
      </div>
    </div>
  )
}
```

### 2. 受控组件 + Clear 按钮
```tsx
import { InputOTP } from "@/components/ui/heroui-input-otp"
import { Description, Label } from "@heroui/react"
import React from "react"

export default function Controlled() {
  const [value, setValue] = React.useState("")
  return (
    <InputOTP maxLength={6} value={value} onChange={setValue}>
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
  )
}
```

### 3. 表单校验（FormData 读取 + 错误态）
```tsx
import { InputOTP } from "@/components/ui/heroui-input-otp"
import { Button, Form, Label } from "@heroui/react"
import React from "react"

export default function WithValidation() {
  const [value, setValue] = React.useState("")
  const [isInvalid, setIsInvalid] = React.useState(false)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const code = new FormData(e.currentTarget).get("code")
    setIsInvalid(code !== "123456")
  }

  return (
    <Form onSubmit={onSubmit}>
      <InputOTP
        name="code"
        maxLength={6}
        value={value}
        isInvalid={isInvalid}
        onChange={(v) => { setValue(v); setIsInvalid(false) }}
      >
        {/* ...Slot 子组件... */}
      </InputOTP>
      <Button isDisabled={value.length !== 6} type="submit">Submit</Button>
    </Form>
  )
}
```

### 4. onComplete 回调（自动提交场景）
```tsx
<InputOTP
  maxLength={6}
  value={value}
  onComplete={(code) => console.log("全部填完:", code)}
  onChange={setValue}
>
  {/* ...Slot 子组件... */}
</InputOTP>
```

## 依赖安装

本组件依赖 HeroUI v3 设计系统，使用前需安装并配置：

```bash
npm install @heroui/react @heroui/styles
```

项目需配置 Tailwind CSS + HeroUI Provider，详见官方文档：https://heroui.com

> ⚠️ 当前知识库项目未安装 @heroui/react，因此 preview.tsx 渲染会失败（PreviewErrorBoundary 会捕获并注入 data-render-error 信号）。
> 这是预期行为：组件需要 HeroUI 设计系统支撑才能运行。安装依赖后预览即可正常。

## 源码路径
`library/react/ui-basic/heroui-input-otp/index.tsx`

原始源码（含 10 个官方示例）留存于 `library/react/ui-basic/heroui-input-otp/_source/original-source.tsx`，
包含：Basic / FourDigits / Disabled / WithPattern / Controlled / WithValidation / OnComplete / FormExample / Variants / OnSurface。

## 适用场景
- 短信/邮箱验证码输入（4-8 位 OTP）
- 双因素认证（2FA）码输入
- 支付确认 PIN 码
- 注册/登录流程的邮箱验证
- 一次性密码重置流程
- 需要分段式视觉反馈的数字输入场景
- 表单集成（支持 FormData + 校验）
- 需要无障碍支持的验证码输入（aria-describedby 关联错误文案）
