/**
 * 图标组件库
 *
 * 集中管理项目内联 SVG 图标，消除各页面重复定义同图标的 DRY 违反。
 * 每个图标固定 viewBox，通过 props.size 控制渲染尺寸（width=height=size）。
 *
 * 使用方式：
 *   <BackIcon size={16} />
 *   <CopyIcon size={14} />
 *
 * 行为保持：所有图标视觉与原内联 SVG 完全一致，仅改为组件化引用。
 */

import { type SVGProps, type ReactNode } from 'react'

/** 通用图标 props：size 控制宽高，其余透传给原生 svg */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** 图标尺寸（px），同时设置 width 与 height */
  size?: number
}

/** 图标内部公共 props：固定 viewBox + 注入 size，避免每个图标重复样板代码 */
interface IconWrapperProps extends IconProps {
  viewBox: string
  defaultSize: number
  children: ReactNode
}

/**
 * 图标包装器：注入固定 viewBox + size，把内部 path 作为 children 渲染
 * 不使用 React.defaultProps（函数组件已废弃），改用默认参数值
 */
function IconWrapper({
  size,
  defaultSize,
  viewBox,
  children,
  ...rest
}: IconWrapperProps) {
  const s = size ?? defaultSize
  return (
    <svg
      width={s}
      height={s}
      viewBox={viewBox}
      fill="none"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** 返回箭头（向左），用于详情页返回按钮 / 全屏 Modal 返回 */
export function BackIcon({ size, ...rest }: IconProps) {
  return (
    <IconWrapper viewBox="0 0 16 16" defaultSize={16} size={size} {...rest}>
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconWrapper>
  )
}

/** 复制图标（双框），用于复制路径 / 复制代码 */
export function CopyIcon({ size, ...rest }: IconProps) {
  return (
    <IconWrapper viewBox="0 0 14 14" defaultSize={14} size={size} {...rest}>
      <rect x="4" y="4" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 4V2.5A1.5 1.5 0 008.5 1h-6A1.5 1.5 0 001 2.5v6A1.5 1.5 0 002.5 10H4" stroke="currentColor" strokeWidth="1.5" />
    </IconWrapper>
  )
}

/** 复制图标（单框带折角），用于"复制示例"按钮的视觉区分 */
export function CopyExampleIcon({ size, ...rest }: IconProps) {
  return (
    <IconWrapper viewBox="0 0 14 14" defaultSize={14} size={size} {...rest}>
      <path d="M5 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 9V4.5A1.5 1.5 0 015.5 3H10" stroke="currentColor" strokeWidth="1.5" />
    </IconWrapper>
  )
}

/** 全屏预览图标（四角向内），用于详情页全屏按钮 */
export function FullscreenIcon({ size, ...rest }: IconProps) {
  return (
    <IconWrapper viewBox="0 0 16 16" defaultSize={16} size={size} {...rest}>
      <path d="M2 6V2.5A.5.5 0 012.5 2H6M10 2h3.5a.5.5 0 01.5.5V6M14 10v3.5a.5.5 0 01-.5.5H10M6 14H2.5a.5.5 0 01-.5-.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconWrapper>
  )
}

/** 外链图标（右上角箭头 + 左下框），用于"新标签打开" */
export function ExternalLinkIcon({ size, ...rest }: IconProps) {
  return (
    <IconWrapper viewBox="0 0 14 14" defaultSize={12} size={size} {...rest}>
      <path d="M5 2h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8v3.5A1.5 1.5 0 018.5 13h-6A1.5 1.5 0 011 11.5v-6A1.5 1.5 0 012.5 4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconWrapper>
  )
}

/** 成功对勾图标（圆形边框 + 勾），用于 Toast 通知 */
export function CheckCircleIcon({ size, ...rest }: IconProps) {
  return (
    <IconWrapper viewBox="0 0 14 14" defaultSize={14} size={size} {...rest}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 7l2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconWrapper>
  )
}
