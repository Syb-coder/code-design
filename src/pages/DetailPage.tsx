import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { components } from '../lib/mock-data'
import { useToast, useClipboard, useEscapeKey } from '../lib/hooks'
import ComponentPreview from '../components/ComponentPreview'
import DetailToast from '../components/detail/DetailToast'
import DetailFullscreen from '../components/detail/DetailFullscreen'
import {
  BackIcon,
  CopyIcon,
  CopyExampleIcon,
  FullscreenIcon,
  ExternalLinkIcon,
} from '../components/icons'
import './DetailPage.css'

export default function DetailPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()

  const component = components.find(c => c.id === idParam)

  // 局部 UI 状态（原 DetailPage 拆出，职责清晰）
  const [activeVariant, setActiveVariant] = useState(0)
  const [activeTab, setActiveTab] = useState<'card' | 'source'>('card')
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  // 通过 hooks 复用副作用逻辑（原内联在 DetailPage 中）
  const { visible: toastVisible, message: toastMsg, showToast } = useToast()
  const { copyToClipboard } = useClipboard(showToast)
  useEscapeKey(fullscreenOpen, () => setFullscreenOpen(false))

  // 全屏预览内容渲染函数，避免重复 JSX
  const renderPreview = useCallback(
    (fillContainer = false) => (
      <ComponentPreview
        previewPath={component?.previewPath ?? ''}
        componentId={component?.id ?? ''}
        fillContainer={fillContainer}
      />
    ),
    [component?.previewPath, component?.id],
  )

  if (!component) {
    return (
      <div className="detail-page">
        <div className="detail-page__empty">
          <h2>组件未找到</h2>
          <p>请检查 URL 或返回首页浏览</p>
          <Link to="/">返回首页</Link>
        </div>
      </div>
    )
  }

  const relatedComponents = component.relatedComponents
    ? components.filter(c => component.relatedComponents!.includes(c.id))
    : []

  // 提取 sourceUrl 为局部常量，便于在 JSX 闭包（onClick）中收窄为 string 类型
  const sourceUrl = component.sourceUrl

  return (
    <div className="detail-page">
      {/* 顶部导航 */}
      <nav className="detail-page__nav">
        <button className="detail-page__back" onClick={() => navigate('/')}>
          <BackIcon size={16} />
          返回
        </button>
        <div className="detail-page__breadcrumb">
          <Link to="/">知识库</Link>
          <span className="detail-page__sep">/</span>
          <span>{component.category}</span>
          <span className="detail-page__sep">/</span>
          <span>{component.name}</span>
        </div>
        <div className="detail-page__actions">
          <button
            className="detail-page__action-btn"
            onClick={() => copyToClipboard(component.sourcePath, '源码路径')}
          >
            <CopyIcon size={14} />
            复制路径
          </button>
          <button
            className="detail-page__action-btn"
            onClick={() => copyToClipboard(component.card.usageExample, '使用示例')}
          >
            <CopyExampleIcon size={14} />
            复制示例
          </button>
        </div>
      </nav>

      <div className="detail-page__content">
        {/* 左侧：完整预览 */}
        <section className="detail-page__preview-section">
          <div className="detail-page__preview-container">
            <div className="detail-page__preview-frame">
              {renderPreview()}
              {/* 全屏按钮：悬浮在预览框右上角 */}
              <button
                className="detail-page__fullscreen-btn"
                onClick={() => setFullscreenOpen(true)}
                title="全屏预览"
                aria-label="全屏预览"
              >
                <FullscreenIcon size={16} />
              </button>
            </div>
            {component.variants && component.variants.length > 0 && (
              <div className="detail-page__variants">
                <span className="detail-page__variants-label">变体</span>
                <div className="detail-page__variants-list">
                  <button
                    className={`detail-page__variant-btn ${activeVariant === -1 ? 'is-active' : ''}`}
                    onClick={() => setActiveVariant(-1)}
                  >
                    默认
                  </button>
                  {component.variants.map((v, i) => (
                    <button
                      key={v.name}
                      className={`detail-page__variant-btn ${activeVariant === i ? 'is-active' : ''}`}
                      onClick={() => setActiveVariant(i)}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 右侧：信息面板 */}
        <aside className="detail-page__info">
          <div className="detail-page__info-header">
            <h2 className="detail-page__comp-name">{component.name}</h2>
            <div className="detail-page__meta-badges">
              <span className="detail-page__badge">{component.techStack}</span>
              <span className="detail-page__badge">{component.category}</span>
              <span className="detail-page__badge">{component.source}</span>
              {component.variants && component.variants.length > 0 && (
                <span className="detail-page__badge detail-page__badge--accent">
                  {component.variants.length} 变体
                </span>
              )}
            </div>
          </div>

          <p className="detail-page__description">{component.card.description}</p>

          {/* 标签 */}
          <div className="detail-page__tags">
            {component.tags.map(tag => (
              <span key={tag} className="detail-page__tag">{tag}</span>
            ))}
          </div>

          {/* 标签切换 */}
          <div className="detail-page__tabs">
            <button
              className={`detail-page__tab ${activeTab === 'card' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('card')}
            >
              AI 卡片
            </button>
            <button
              className={`detail-page__tab ${activeTab === 'source' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('source')}
            >
              源码路径
            </button>
          </div>

          <div className="detail-page__tab-content">
            {activeTab === 'card' && (
              <div className="detail-page__card-panel">
                {component.card.props.length > 0 && (
                  <>
                    <h4 className="detail-page__section-title">Props</h4>
                    <table className="detail-page__props-table">
                      <thead>
                        <tr>
                          <th>名称</th>
                          <th>类型</th>
                          <th>默认值</th>
                          <th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {component.card.props.map(prop => (
                          <tr key={prop.name}>
                            <td className="detail-page__prop-name">{prop.name}</td>
                            <td className="detail-page__prop-type">{prop.type}</td>
                            <td className="detail-page__prop-default">{prop.defaultValue || '-'}</td>
                            <td>{prop.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <h4 className="detail-page__section-title">使用示例</h4>
                <pre className="detail-page__code-block">
                  <code>{component.card.usageExample}</code>
                </pre>
                <button
                  className="detail-page__copy-code"
                  onClick={() => copyToClipboard(component.card.usageExample, '代码')}
                >
                  <CopyIcon size={12} />
                  复制
                </button>

                <h4 className="detail-page__section-title">适用场景</h4>
                <ul className="detail-page__scenes">
                  {component.card.applicableScenes.map(s => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>

                {component.dependencies.length > 0 && (
                  <>
                    <h4 className="detail-page__section-title">依赖</h4>
                    <div className="detail-page__deps">
                      {component.dependencies.map(d => (
                        <span key={d} className="detail-page__dep-tag">{d}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {activeTab === 'source' && (
              <div className="detail-page__source-panel">
                <div className="detail-page__source-path">
                  <span className="detail-page__source-label">源码文件</span>
                  <code>{component.sourcePath}</code>
                  <button
                    className="detail-page__copy-inline"
                    onClick={() => copyToClipboard(component.sourcePath, '源码路径')}
                  >
                    复制
                  </button>
                </div>
                <div className="detail-page__source-path">
                  <span className="detail-page__source-label">预览文件</span>
                  <code>{component.previewPath}</code>
                </div>
                {/* 源组件 URL：显式展示 + 复制 + 一键新标签跳转 */}
                {sourceUrl ? (
                  <div className="detail-page__source-url">
                    <span className="detail-page__source-label">源组件 URL</span>
                    <code className="detail-page__source-url-code" title={sourceUrl}>
                      {sourceUrl}
                    </code>
                    <button
                      className="detail-page__copy-inline"
                      onClick={() => copyToClipboard(sourceUrl, '源组件 URL')}
                    >
                      复制
                    </button>
                    <a
                      className="detail-page__open-btn"
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="在新标签页打开源组件"
                    >
                      <ExternalLinkIcon size={12} aria-hidden="true" />
                      新标签打开
                    </a>
                  </div>
                ) : (
                  <div className="detail-page__source-path">
                    <span className="detail-page__source-label">源组件 URL</span>
                    <span className="detail-page__source-empty">无</span>
                  </div>
                )}
                <div className="detail-page__source-meta">
                  <span>入库日期: {component.createdAt}</span>
                  {component.author && <span>作者: {component.author}</span>}
                </div>
              </div>
            )}
          </div>

          {/* 关联组件 */}
          {relatedComponents.length > 0 && (
            <div className="detail-page__related">
              <h4 className="detail-page__section-title">关联组件</h4>
              <div className="detail-page__related-list">
                {relatedComponents.map(rc => (
                  <Link
                    key={rc.id}
                    to={`/component/${rc.id}`}
                    className="detail-page__related-item"
                  >
                    <span className="detail-page__related-name">{rc.name}</span>
                    <span className="detail-page__related-desc">{rc.card.description.slice(0, 40)}...</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 全屏预览 Modal：ESC 关闭由 useEscapeKey hook 处理 */}
      <DetailFullscreen
        open={fullscreenOpen}
        componentName={component.name}
        onClose={() => setFullscreenOpen(false)}
      >
        {renderPreview(true)}
      </DetailFullscreen>

      {/* Toast 通知 */}
      <DetailToast visible={toastVisible} message={toastMsg} />
    </div>
  )
}
