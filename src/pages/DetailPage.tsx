import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { components } from '../lib/mock-data'
import ComponentPreview from '../components/ComponentPreview'
import './DetailPage.css'

export default function DetailPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()

  const component = components.find(c => c.id === idParam)

  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [activeVariant, setActiveVariant] = useState(0)
  const [activeTab, setActiveTab] = useState<'card' | 'source'>('card')

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }, [])

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label}已复制到剪贴板`)
    } catch {
      showToast('复制失败，请手动复制')
    }
  }, [showToast])

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

  return (
    <div className="detail-page">
      {/* 顶部导航 */}
      <nav className="detail-page__nav">
        <button className="detail-page__back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="4" y="4" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 4V2.5A1.5 1.5 0 008.5 1h-6A1.5 1.5 0 001 2.5v6A1.5 1.5 0 002.5 10H4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            复制路径
          </button>
          <button
            className="detail-page__action-btn"
            onClick={() => copyToClipboard(component.card.usageExample, '使用示例')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 9V4.5A1.5 1.5 0 015.5 3H10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            复制示例
          </button>
        </div>
      </nav>

      <div className="detail-page__content">
        {/* 左侧：完整预览 */}
        <section className="detail-page__preview-section">
          <div className="detail-page__preview-container">
            <div className="detail-page__preview-frame">
              <ComponentPreview
                previewPath={component.previewPath}
                componentId={component.id}
              />
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
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="4" y="4" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 4V2.5A1.5 1.5 0 008.5 1h-6A1.5 1.5 0 001 2.5v6A1.5 1.5 0 002.5 10H4" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
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
                <div className="detail-page__source-meta">
                  <span>入库日期: {component.createdAt}</span>
                  {component.author && <span>作者: {component.author}</span>}
                  {component.sourceUrl && (
                    <a href={component.sourceUrl} target="_blank" rel="noopener noreferrer">
                      查看原始来源
                    </a>
                  )}
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

      {/* Toast 通知 */}
      {toastVisible && (
        <div className="detail-page__toast" role="alert">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4.5 7l2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
