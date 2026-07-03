/**
 * 预览组件加载器
 *
 * 集中管理 library 下所有 preview.tsx 的扫描、动态加载与错误边界，
 * 消除 ComponentPreview 与 SandboxPage 中重复的：
 *   1. import.meta.glob 扫描（原两处各自扫描一次，浪费构建产物体积）
 *   2. lazy 模块解析逻辑（mod.default || mod.Preview || mod.ComponentPreview）
 *   3. ErrorBoundary 类定义（PreviewErrorBoundary vs SandboxErrorBoundary）
 *
 * 数据流：
 *   previewModules（Vite 构建时扫描）→ resolvePreviewComponent（运行时 lazy 解析）
 *   → PreviewLoader（Suspense + ErrorBoundary 包装）
 *
 * 行为保持：
 *   - 扫描结果与原 scan-components.ts 导出的 previewModules 完全一致（同一 glob）
 *   - 模块解析顺序与原代码一致：default → Preview → ComponentPreview
 *   - SandboxErrorBoundary 的 data-render-error 属性保留（screenshot-diff.ts 依赖此信号）
 */

import { Component, lazy, Suspense, type ReactNode, type ComponentType } from 'react'

/**
 * Vite 构建时扫描所有 preview.tsx 模块
 * key 格式：/library/react/ui-basic/button-glow/preview.tsx
 *
 * 单一数据源：ComponentPreview 与 SandboxPage 共用此映射，
 * 避免各自 import.meta.glob 产生重复的构建产物
 */
export const previewModules = import.meta.glob('/library/**/preview.tsx')

/**
 * preview.tsx 模块解析结果
 * - module：动态 import 的模块对象（含 default/Preview/ComponentPreview 导出）
 * - component：解析后的预览组件（取首个非空导出）
 */
interface ResolvedPreview {
  /** lazy 包装的组件，可直接渲染 */
  Component: ComponentType
}

/**
 * 从 preview.tsx 模块对象解析出预览组件
 *
 * 解析顺序（与原代码一致）：
 *   1. mod.default（默认导出，最常见）
 *   2. mod.Preview（命名导出 Preview）
 *   3. mod.ComponentPreview（命名导出 ComponentPreview，向后兼容）
 *
 * @param mod 动态 import 返回的模块对象
 * @throws Error 模块未导出任何可识别的预览组件
 */
function pickPreviewComponent(mod: Record<string, unknown>): ComponentType {
  const Comp = mod.default || mod.Preview || mod.ComponentPreview
  if (!Comp) {
    throw new Error('preview.tsx 未导出 default / Preview / ComponentPreview')
  }
  return Comp as ComponentType
}

/**
 * 根据 previewPath 构建 lazy 组件
 *
 * @param previewPath Vite glob key 格式路径（如 /library/react/.../preview.tsx）
 * @returns lazy 组件；路径不存在于 previewModules 时返回 null
 */
export function resolvePreviewComponent(previewPath: string): ResolvedPreview | null {
  const loader = previewModules[previewPath]
  if (!loader) return null

  const Component = lazy(() =>
    (loader as () => Promise<Record<string, unknown>>)().then(mod => ({
      default: pickPreviewComponent(mod),
    }))
  )

  return { Component }
}

// ============================================================
// 错误边界
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * 错误时的 fallback 渲染函数
   * @param error 捕获的错误（含 message）
   */
  fallback: (error: Error) => ReactNode
  /** preview 路径，用于日志/调试（可选） */
  previewPath?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 预览错误边界
 *
 * 捕获 lazy import 失败或组件渲染错误，调用 fallback 渲染降级 UI。
 *
 * SandboxPage 通过 fallback 注入 data-render-error 属性，
 * 供 screenshot-diff.ts 检测渲染失败。
 */
export class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    // 仅日志输出，不阻断流程；previewPath 用于关联失败的具体组件
    if (this.props.previewPath) {
      console.error(`[preview-loader] 渲染失败: ${this.props.previewPath}`, error)
    }
  }

  render() {
    const { error } = this.state
    if (error) return this.props.fallback(error)
    return this.props.children
  }
}

// ============================================================
// 组合加载器
// ============================================================

interface PreviewLoaderProps {
  /** 预览文件路径，需为 Vite glob key 格式（/library/.../preview.tsx） */
  previewPath: string
  /** 正常加载中时的 fallback（如 spinner / 占位文字） */
  loadingFallback: ReactNode
  /** 模块未找到或渲染失败时的 fallback */
  errorFallback: (error: Error) => ReactNode
}

/**
 * 预览加载器：组合 lazy + Suspense + ErrorBoundary
 *
 * 一站式解决预览组件的动态加载、加载中状态、错误降级。
 * ComponentPreview 与 SandboxPage 均通过此组件加载预览，消除重复样板。
 *
 * @example
 * <PreviewLoader
 *   previewPath={component.previewPath}
 *   loadingFallback={<div>加载中...</div>}
 *   errorFallback={(err) => <div data-render-error={err.message} />}
 * />
 */
export function PreviewLoader({
  previewPath,
  loadingFallback,
  errorFallback,
}: PreviewLoaderProps) {
  const resolved = resolvePreviewComponent(previewPath)

  if (!resolved) {
    // 模块未扫描到：直接走 errorFallback（不进 ErrorBoundary，因为这不是渲染错误）
    return (
      <PreviewErrorBoundary previewPath={previewPath} fallback={errorFallback}>
        {errorFallback(new Error(`preview 模块未找到: ${previewPath}`))}
      </PreviewErrorBoundary>
    )
  }

  const { Component } = resolved
  return (
    <PreviewErrorBoundary previewPath={previewPath} fallback={errorFallback}>
      <Suspense fallback={loadingFallback}>
        <Component />
      </Suspense>
    </PreviewErrorBoundary>
  )
}
