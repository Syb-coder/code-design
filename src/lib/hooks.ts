/**
 * 通用 React Hooks
 *
 * 从 DetailPage 提取的三个可复用 hook，消除"上帝组件"中混合的副作用职责：
 *   - useToast：Toast 通知状态管理 + 自动隐藏
 *   - useClipboard：剪贴板复制 + 错误兜底
 *   - useEscapeKey：ESC 键监听 + body overflow 副作用（用于全屏 Modal）
 *
 * 每个 hook 单一职责，可独立测试与复用。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Toast 显示时长（ms），与原 DetailPage 保持一致 */
const TOAST_DURATION_MS = 2500

/**
 * Toast 通知 hook
 *
 * 管理 toast 显示状态 + 消息内容 + 自动隐藏定时器。
 * 调用 showToast(msg) 触发显示，TOAST_DURATION_MS 后自动隐藏。
 *
 * @returns
 *   - visible: 当前是否显示
 *   - message: 当前消息内容
 *   - showToast: 触发显示函数
 */
export function useToast() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  // 用 ref 持有定时器，避免闭包陷阱 + 保证每次新触发能清掉旧定时器
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    setVisible(true)
    // 清掉前一次未完成的隐藏定时器，防止新消息被旧定时器提前隐藏
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), TOAST_DURATION_MS)
  }, [])

  // 组件卸载时清理定时器，避免内存泄漏 + 状态更新到已卸载组件
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { visible, message, showToast }
}

/**
 * 剪贴板复制 hook
 *
 * 封装 navigator.clipboard.writeText，复制成功/失败时通过 onToast 回调反馈。
 *
 * @param onToast 复制结果反馈函数（通常传入 useToast 的 showToast）
 * @returns copyToClipboard 函数，参数为 (text, label)，label 用于反馈消息
 */
export function useClipboard(onToast: (msg: string) => void) {
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast(`${label}已复制到剪贴板`)
    } catch {
      onToast('复制失败，请手动复制')
    }
  }, [onToast])

  return { copyToClipboard }
}

/**
 * ESC 键监听 + body 滚动锁定 hook（用于全屏 Modal）
 *
 * 当 active=true 时：
 *   - 监听 ESC 键，按下时调用 onEscape
 *   - 设置 document.body.style.overflow = 'hidden' 防止背景滚动
 * active=false 或组件卸载时恢复原状。
 *
 * @param active 是否激活监听（如 fullscreenOpen 状态）
 * @param onEscape ESC 按下时的回调
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', onKey)
    // 防止背景滚动
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [active, onEscape])
}
