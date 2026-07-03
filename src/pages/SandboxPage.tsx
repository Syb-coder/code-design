import { useParams } from 'react-router-dom'
import { PreviewLoader } from '../lib/preview-loader'

/**
 * 沙箱路由页面 /__sandbox__/*
 *
 * 供 G2 渲染校验（screenshot-diff.ts）截图：纯白背景、无应用 chrome
 * 路由参数 * 为组件相对路径，如 library/react/ui-basic/button-glow
 *
 * 渲染失败信号：通过 errorFallback 注入 data-render-error 属性，
 * screenshot-diff.ts 通过 querySelector([data-render-error]) 判定渲染失败。
 *
 * 预览组件加载委托给 PreviewLoader（lib/preview-loader.tsx），
 * 消除与 ComponentPreview 的重复扫描/lazy 解析/ErrorBoundary 样板。
 */
export default function SandboxPage() {
  const params = useParams()
  const splat = params['*'] || ''
  // 拼接 Vite glob key 格式：/library/.../preview.tsx
  const previewPath = `/${splat}/preview.tsx`

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#ffffff', margin: 0, padding: 0 }}>
      <PreviewLoader
        previewPath={previewPath}
        loadingFallback={<div style={{ width: '100vw', height: '100vh', background: '#ffffff' }} />}
        errorFallback={(err) => (
          // data-render-error 属性是 screenshot-diff.ts 检测渲染失败的信号
          <div
            data-render-error={err.message}
            style={{ width: '100vw', height: '100vh', background: '#ffffff' }}
          />
        )}
      />
    </div>
  )
}
