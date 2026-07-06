// @ts-nocheck
/**
 * 原始源码 - HeroUI Input OTP
 *
 * 来源：21st.dev @reapollo/heroui-input-otp
 * 原始 URL：https://21st.dev/@reapollo/components/heroui-input-otp
 * 抓取方式：用户粘贴（pasted-code）
 * 抓取时间：2026-07-03
 *
 * 说明：本组件是 HeroUI 设计系统 InputOTP 组件的 re-export 适配层
 * （21st.dev 标准 registry 模式），实际组件实现在 @heroui/react 内部。
 * 下方包含主组件源码 + 官方提供的 10 个使用示例。
 *
 * 合并说明：原始代码为 10 个独立示例文件，每个文件有自己的 `export default`。
 * 合并成单文件留存时，将示例的 `export default function Xxx()` 改为 `export function Xxx()`
 * （命名导出），仅保留主组件的 `export default InputOTP`，以符合 ES 模块语法。
 * 代码逻辑完全未改动，仅调整 export 方式。
 */

/* ============================================================
 * 主组件：@/components/ui/heroui-input-otp
 * 安装命令：npx @21st-dev/cli add larsen66/heroui-input-otp
 * ============================================================ */
"use client"

import "@heroui/styles/css"
import {
  InputOTP,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from "@heroui/react"

export { InputOTP, REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS }
export default InputOTP


/* ============================================================
 * 示例 1：Basic - 基础 6 位 OTP 输入
 * ============================================================ */
import { Label, Link } from "@heroui/react"

export function Basic() {
  return (
    <div className="flex w-[280px] flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label>Verify account</Label>
        <p className="text-sm text-muted-foreground">We&apos;ve sent a code to a****@gmail.com</p>
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
  )
}


/* ============================================================
 * 示例 2：FourDigits - 4 位 PIN 输入
 * ============================================================ */
export function FourDigits() {
  return (
    <div className="flex w-[280px] flex-col gap-2">
      <Label>Enter PIN</Label>
      <InputOTP maxLength={4}>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
          <InputOTP.Slot index={3} />
        </InputOTP.Group>
      </InputOTP>
    </div>
  )
}


/* ============================================================
 * 示例 3：Disabled - 禁用态
 * ============================================================ */
import { Description } from "@heroui/react"

export function Disabled() {
  return (
    <div className="flex w-[280px] flex-col gap-2">
      <Label isDisabled>Verify account</Label>
      <Description>Code verification is currently disabled</Description>
      <InputOTP isDisabled maxLength={6}>
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
    </div>
  )
}


/* ============================================================
 * 示例 4：WithPattern - 字母-only 输入模式
 * ============================================================ */
export function WithPattern() {
  return (
    <div className="flex w-[280px] flex-col gap-2">
      <Label>Enter code (letters only)</Label>
      <Description>Only alphabetic characters are allowed</Description>
      <InputOTP maxLength={6} pattern={REGEXP_ONLY_CHARS}>
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
    </div>
  )
}


/* ============================================================
 * 示例 5：Controlled - 受控组件
 * ============================================================ */
"use client"
import React from "react"

export function Controlled() {
  const [value, setValue] = React.useState("")

  return (
    <div className="flex w-[280px] flex-col gap-2">
      <Label>Verify account</Label>
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
      <Description>
        {value.length > 0 ? (
          <>
            Value: {value} ({value.length}/6) •{" "}
            <button className="font-medium text-foreground underline" onClick={() => setValue("")}>
              Clear
            </button>
          </>
        ) : (
          "Enter a 6-digit code"
        )}
      </Description>
    </div>
  )
}


/* ============================================================
 * 示例 6：WithValidation - 表单校验
 * ============================================================ */
"use client"
import { Button, Form } from "@heroui/react"

export function WithValidation() {
  const [value, setValue] = React.useState("")
  const [isInvalid, setIsInvalid] = React.useState(false)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const code = formData.get("code")

    if (code !== "123456") {
      setIsInvalid(true)

      return
    }

    setIsInvalid(false)
    setValue("")

    alert("Code verified successfully!")
  }

  const handleChange = (val: string) => {
    setValue(val)
    setIsInvalid(false)
  }

  return (
    <div className="flex w-[280px] flex-col gap-2">
      <Form className="flex flex-col gap-2" onSubmit={onSubmit}>
        <Label>Verify account</Label>
        <Description>Hint: The code is 123456</Description>
        <InputOTP
          aria-describedby={isInvalid ? "code-error" : undefined}
          isInvalid={isInvalid}
          maxLength={6}
          name="code"
          value={value}
          onChange={handleChange}
        >
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
        <span className="field-error" data-visible={isInvalid} id="code-error">
          Invalid code. Please try again.
        </span>
        <Button isDisabled={value.length !== 6} type="submit">
          Submit
        </Button>
      </Form>
    </div>
  )
}


/* ============================================================
 * 示例 7：OnComplete - 完成回调
 * ============================================================ */
"use client"
import { Spinner } from "@heroui/react"

export function OnComplete() {
  const [value, setValue] = React.useState("")
  const [isComplete, setIsComplete] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleComplete = (code: string) => {
    setIsComplete(true)

    console.log("Code complete:", code)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setIsSubmitting(true)
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setValue("")
      setIsComplete(false)
    }, 2000)
  }

  return (
    <Form className="flex w-[280px] flex-col gap-2" onSubmit={handleSubmit}>
      <Label>Verify account</Label>
      <InputOTP
        maxLength={6}
        value={value}
        onComplete={handleComplete}
        onChange={(val) => {
          setValue(val)
          setIsComplete(false)
        }}
      >
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
      <Button
        className="mt-2 w-full"
        isDisabled={!isComplete}
        isPending={isSubmitting}
        type="submit"
        variant="primary"
      >
        {isSubmitting ? (
          <>
            <Spinner color="current" size="sm" />
            Verifying...
          </>
        ) : (
          "Verify Code"
        )}
      </Button>
    </Form>
  )
}


/* ============================================================
 * 示例 8：FormExample - 完整 2FA 表单
 * ============================================================ */
"use client"

export function FormExample() {
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (value.length !== 6) {
      setError("Please enter all 6 digits")

      return
    }

    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      if (value === "123456") {
        console.log("Code verified successfully!")
        setValue("")
      } else {
        setError("Invalid code. Please try again.")
      }
      setIsSubmitting(false)
    }, 1500)
  }

  return (
    <Form className="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label>Two-factor authentication</Label>
        <Description>Enter the 6-digit code from your authenticator app</Description>
        <InputOTP
          isInvalid={!!error}
          maxLength={6}
          value={value}
          onChange={(val) => {
            setValue(val)
            setError("")
          }}
        >
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
        <span className="field-error" data-visible={!!error} id="code-error">
          {error}
        </span>
      </div>
      <Button
        className="w-full"
        isDisabled={value.length !== 6}
        isPending={isSubmitting}
        type="submit"
        variant="primary"
      >
        {isSubmitting ? (
          <>
            <Spinner color="current" size="sm" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </Button>
      <div className="flex items-center justify-center gap-1">
        <p className="text-sm text-muted-foreground">Having trouble?</p>
        <Link className="text-sm text-foreground underline" href="#">
          Use backup code
        </Link>
      </div>
    </Form>
  )
}


/* ============================================================
 * 示例 9：Variants - primary / secondary 变体
 * ============================================================ */
export function Variants() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Primary variant</Label>
        <InputOTP maxLength={6} variant="primary">
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
      </div>
      <div className="flex flex-col gap-2">
        <Label>Secondary variant</Label>
        <InputOTP maxLength={6} variant="secondary">
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
      </div>
    </div>
  )
}


/* ============================================================
 * 示例 10：OnSurface - Surface 容器内渲染
 * ============================================================ */
import { Surface } from "@heroui/react"

export function OnSurface() {
  return (
    // The docs render this on the page's light-gray background (--background),
    // which is what makes the white Surface card visible. The 21st preview page
    // is white, so reproduce that backdrop here to match the original.
    <div className="mx-auto flex w-full max-w-md justify-center rounded-3xl bg-[#f4f4f5] p-8">
      <Surface className="flex w-full flex-col gap-2 rounded-3xl p-6">
        <div className="flex flex-col gap-1">
          <Label>Verify account</Label>
          <p className="text-sm text-muted">We&apos;ve sent a code to a****@gmail.com</p>
        </div>
        <InputOTP maxLength={6} variant="secondary">
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
          <p className="text-sm text-muted">Didn&apos;t receive a code?</p>
          <Link className="text-foreground underline" href="#">
            Resend
          </Link>
        </div>
      </Surface>
    </div>
  )
}
