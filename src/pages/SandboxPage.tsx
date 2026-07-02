import { Component, lazy, Suspense, ReactNode, ComponentType } from 'react'
import { useParams } from 'react-router-dom'

// 预扫描所有组件 preview.tsx，Vite 构建时生成模块映射
// key 格式：/library/react/ui-basic/button-glow/preview.tsx
const previewModules = import.meta.glob('/library/**/preview.tsx')

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

/**
 * 沙箱错误边界
 * 捕获组件渲染/加载错误，在根 div 注入 data-render-error 属性供 Playwright 检测
 * screenshot-diff.ts 通过 querySelector([data-render-error]) 判定渲染失败
 */
class SandboxErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || String(error) }
  }

  render() {
    // 错误时渲染纯白页 + data-render-error 属性，Playwright 截图与脚本检测均以此为失败信号
    if (this.state.hasError) {
      return (
        <div
          data-render-error={this.state.message}
          style={{ width: '100vw', height: '100vh', background: '#ffffff' }}
        />
      )
    }
    return this.props.children
  }
}

/**
 * 沙箱内容：根据 splat 路径动态加载组件 preview 并渲染
 * splat 为组件相对路径，如 library/react/ui-basic/button-glow
 */
function SandboxContent({ splat }: { splat: string }) {
  const previewKey = `/${splat}/preview.tsx`
  const loader = previewModules[previewKey]

  // 模块不存在直接抛错，由 ErrorBoundary 捕获写入 data-render-error
  if (!loader) {
    throw new Error(`preview 模块未找到: ${previewKey}（检查组件目录是否存在 preview.tsx）`)
  }

  // lazy 包装动态 import，取 default / Preview / ComponentPreview 任一导出
  const PreviewComp = lazy(() =>
    (loader as () => Promise<Record<string, unknown>>)().then(mod => {
      const C = mod.default || mod.Preview || mod.ComponentPreview
      if (!C) throw new Error('preview.tsx 未导出 default / Preview / ComponentPreview')
      return { default: C as ComponentType }
    })
  )

  return (
    <Suspense fallback={<div style={{ width: '100vw', height: '100vh', background: '#ffffff' }} />}>
      <PreviewComp />
    </Suspense>
  )
}

/**
 * 沙箱路由页面 /__sandbox__/*
 * 供 G2 渲染校验（screenshot-diff.ts）截图：纯白背景、无应用 chrome
 * 路由参数 * 为组件相对路径，如 library/react/ui-basic/button-glow
 */
export default function SandboxPage() {
  const params = useParams()
  const splat = params['*'] || ''

  return (
    <SandboxErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', background: '#ffffff', margin: 0, padding: 0 }}>
        <SandboxContent splat={splat} />
      </div>
    </SandboxErrorBoundary>
  )
}
