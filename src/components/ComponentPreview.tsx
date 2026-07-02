import { lazy, Suspense, Component, ReactNode, useEffect, useRef, useState } from 'react'
import { previewModules } from '../lib/scan-components'
import './ComponentPreview.css'

interface Props {
  /** 预览文件路径，需为 Vite glob key 格式（/library/.../preview.tsx） */
  previewPath: string
  componentId: string
  viewMode?: 'grid' | 'list'
  /**
   * 渲染模式：
   *   - false（默认，卡片预览用）：固定 640 画布 + 等比缩放到容器，组件按设计尺寸渲染再缩小
   *   - true（全屏预览用）：画布尺寸=容器尺寸，组件按容器实际尺寸 1:1 渲染，字体清晰不模糊
   */
  fillContainer?: boolean
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
 * 设计画布宽度：组件按"设计尺寸"渲染的画布宽度
 *
 * 取 640px：比组件常见 maxWidth（400）略大，让组件在画布里自然居中渲染，
 * 字体/间距在原始尺寸下正常显示，再等比缩放到预览容器。
 */
const STAGE_WIDTH = 640

/**
 * 组件预览容器
 *
 * 实现"设计画布 + 等比缩放"：
 *   1. 组件在固定宽度（STAGE_WIDTH）的"画布"层内按设计尺寸自然渲染
 *   2. 画布高度按容器宽高比动态计算，保证画布与容器同比例
 *   3. 用 transform: scale 把画布等比缩放到容器尺寸，完美填满容器
 *
 * 这样无论组件自然尺寸多大（如完整登录页约 400×500），都能在卡片预览框（280×175）里
 * 完整显示且不变形。Three.js canvas 等绝对定位元素也随画布缩放。
 *
 * 替代了原 `import(/* @vite-ignore *\/ previewPath)` 实现（Vite 无法静态分析路径，
 * 浏览器原生 ESM 也无法加载本地文件），改为通过 scan-components.ts 中
 * import.meta.glob 预扫描的 previewModules 查找模块。
 *
 * 模块缺失时显示简洁错误提示，不会拖垮整页
 */
export default function ComponentPreview({ previewPath, fillContainer = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [stageHeight, setStageHeight] = useState(400)

  // 监听容器尺寸变化，动态计算画布高度和缩放比例
  // fillContainer 模式下无需缩放，组件直接按容器尺寸渲染
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const update = () => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw === 0 || ch === 0) return
      if (fillContainer) {
        // 全屏模式：画布尺寸=容器尺寸，scale=1，组件 1:1 渲染
        setStageHeight(ch)
        setScale(1)
      } else {
        // 卡片模式：固定 640 画布，按容器宽高比计算画布高度，再缩放
        const sh = Math.round(STAGE_WIDTH * ch / cw)
        setStageHeight(sh)
        setScale(cw / STAGE_WIDTH)
      }
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [fillContainer])

  const loader = previewModules[previewPath]

  // 模块未在 import.meta.glob 扫描结果中：显示错误提示而不是抛错
  if (!loader) {
    return (
      <PreviewErrorBoundary previewPath={previewPath}>
        <PreviewError previewPath={previewPath} />
      </PreviewErrorBoundary>
    )
  }

  const PreviewComponent = lazy(() =>
    (loader as () => Promise<Record<string, unknown>>)().then(mod => {
      const Comp = mod.default || mod.Preview || mod.ComponentPreview
      if (!Comp) throw new Error('No preview component found')
      return { default: Comp as React.ComponentType }
    })
  )

  return (
    <PreviewErrorBoundary previewPath={previewPath}>
      <div ref={containerRef} className="comp-preview-container">
        <div
          ref={stageRef}
          className="comp-preview-stage"
          style={{
            width: fillContainer ? '100%' : STAGE_WIDTH,
            height: stageHeight,
            transform: `scale(${scale})`,
          }}
        >
          <Suspense fallback={<div className="comp-preview-error">加载中...</div>}>
            <PreviewComponent />
          </Suspense>
        </div>
      </div>
    </PreviewErrorBoundary>
  )
}
