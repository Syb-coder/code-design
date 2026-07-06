// @ts-nocheck
/**
 * HeroUI Input OTP
 *
 * 来源：21st.dev
 * 原作者：David Hakobyan
 * 原始 URL：https://21st.dev/@reapollo/components/heroui-input-otp
 * 安装命令：npx @21st-dev/cli add larsen66/heroui-input-otp
 * 入库日期：2026-07-03
 *
 * 实现说明：
 *   本组件是 HeroUI v3 设计系统 InputOTP 组件的 re-export 适配层
 *   （21st.dev 标准 registry 模式）。实际组件实现在 @heroui/react 内部，
 *   本文件仅做命名导出 + 默认导出，方便业务方通过 `@/components/ui/heroui-input-otp`
 *   统一引用路径。
 *
 *   HeroUI v3 的 InputOTP 基于 input-otp 库封装，提供分段式 OTP 输入：
 *   - InputOTP.Group：分组容器（支持多组 + Separator 分隔符）
 *   - InputOTP.Slot：单个输入槽（index 必填）
 *   - InputOTP.Separator：组间分隔符
 *   - REGEXP_ONLY_DIGITS / REGEXP_ONLY_CHARS / REGEXP_ONLY_DIGITS_AND_CHARS：
 *     预置输入模式正则
 *
 * 依赖：
 *   - @heroui/react（HeroUI v3 主包）
 *   - @heroui/styles（HeroUI v3 样式包，需 import "@heroui/styles/css"）
 *
 * 使用前提：
 *   1. 安装依赖：npm install @heroui/react @heroui/styles
 *   2. 项目需配置 Tailwind CSS + HeroUI Provider（详见 https://heroui.com）
 *   3. 全局引入样式：import "@heroui/styles/css"
 *
 * 完整使用示例见 card.md（含 10 个官方示例：Basic / FourDigits / Disabled /
 * WithPattern / Controlled / WithValidation / OnComplete / FormExample /
 * Variants / OnSurface）
 */

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
