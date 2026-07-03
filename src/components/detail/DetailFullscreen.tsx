/**
 * 详情页全屏预览 Modal
 *
 * 从 DetailPage 提取的纯展示组件，接收 open/componentName/children 渲染全屏预览。
 * ESC 关闭与 body 滚动锁定由父组件通过 useEscapeKey hook 控制（本组件不处理副作用）。
 *
 * 视觉与原内联实现完全一致：顶部返回栏 + 1:1 预览区。
 */

import { type ReactNode } from 'react'
import { BackIcon } from '../icons'

interface Props {
  open: boolean
  componentName: string
  onClose: () => void
  /** 全屏预览内容（通常是 ComponentPreview fillContainer 模式） */
  children: ReactNode
}

export default function DetailFullscreen({ open, componentName, onClose, children }: Props) {
  if (!open) return null
  return (
    <div className="detail-page__fullscreen" role="dialog" aria-modal="true" aria-label="全屏预览">
      {/* 顶部返回栏 */}
      <div className="detail-page__fullscreen-bar">
        <button
          className="detail-page__fullscreen-back"
          onClick={onClose}
          title="返回详情页"
        >
          <BackIcon size={16} />
          返回
        </button>
        <span className="detail-page__fullscreen-title">{componentName}</span>
      </div>
      {/* 全屏预览区：组件 1:1 渲染 */}
      <div className="detail-page__fullscreen-stage">
        {children}
      </div>
    </div>
  )
}
