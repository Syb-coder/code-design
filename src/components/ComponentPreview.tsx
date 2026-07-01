import { lazy, Suspense, Component, ReactNode } from 'react'

interface Props {
  /** 预览文件路径，用于动态 import */
  previewPath: string
  componentId: string
  viewMode?: 'grid' | 'list'
}

/** 加载失败时的简洁错误提示 */
function PreviewError({ previewPath }: { previewPath: string }) {
  const shortPath = previewPath.split('/').slice(-3).join('/')
  return (
    <div className="comp-preview-error">
      预览不可用: {shortPath}
    </div>
  )
}

/** 错误边界：捕获 lazy import 失败，防止整页崩溃 */
interface EBState { hasError: boolean }
class PreviewErrorBoundary extends Component<{ children: ReactNode; previewPath: string }, EBState> {
  state: EBState = { hasError: false }
  static getDerivedStateFromError(): EBState { return { hasError: true } }
  render() {
    return this.state.hasError
      ? <PreviewError previewPath={this.props.previewPath} />
      : this.props.children
  }
}

/**
 * 组件预览容器
 * 动态 import previewPath 渲染真实组件预览
 * 文件不存在时显示简洁错误提示，不会拖垮整页
 */
export default function ComponentPreview({ previewPath }: Props) {
  const PreviewComponent = lazy(() =>
    import(/* @vite-ignore */ previewPath)
      .then(mod => {
        const Comp = mod.default || mod.Preview || mod.ComponentPreview
        if (!Comp) throw new Error('No preview component found')
        return { default: Comp as React.ComponentType }
      })
  )

  return (
    <PreviewErrorBoundary previewPath={previewPath}>
      <Suspense fallback={<div className="comp-preview-error">加载中...</div>}>
        <PreviewComponent />
      </Suspense>
    </PreviewErrorBoundary>
  )
}
