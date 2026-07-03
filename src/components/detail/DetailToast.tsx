/**
 * 详情页 Toast 通知组件
 *
 * 从 DetailPage 提取的纯展示组件，接收 visible/message props 渲染 Toast。
 * 视觉与原内联实现完全一致：固定底部、成功图标 + 消息。
 */

import { CheckCircleIcon } from '../icons'

interface Props {
  visible: boolean
  message: string
}

export default function DetailToast({ visible, message }: Props) {
  if (!visible) return null
  return (
    <div className="detail-page__toast" role="alert">
      <CheckCircleIcon size={14} />
      {message}
    </div>
  )
}
