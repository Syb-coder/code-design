import { useNavigate } from 'react-router-dom'
import { ComponentMeta } from '../lib/types'
import ComponentPreview from './ComponentPreview'
import './ComponentCard.css'

interface Props {
  component: ComponentMeta
  viewMode: 'grid' | 'list'
}

export default function ComponentCard({ component, viewMode }: Props) {
  const navigate = useNavigate()
  const { id, name, techStack, category, tags, variants, dependencies, source, previewPath } = component
  const variantCount = variants?.length || 0

  return (
    <div
      className={`comp-card ${viewMode === 'list' ? 'comp-card--list' : ''}`}
      onClick={() => navigate(`/component/${id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/component/${id}`)}
    >
      <div className="comp-card__preview">
        <ComponentPreview previewPath={previewPath} componentId={id} viewMode={viewMode} />
        {viewMode === 'grid' && variantCount > 0 && (
          <div className="comp-card__preview-overlay">
            <span className="comp-card__variant-badge">
              {variantCount} 变体
            </span>
          </div>
        )}
      </div>
      <div className="comp-card__body">
        <div className="comp-card__header">
          <h3 className="comp-card__name">{name}</h3>
          <div className="comp-card__meta-row">
            <span className="comp-card__cat">{category}</span>
            <span className="comp-card__source">{source}</span>
          </div>
        </div>
        <p className="comp-card__desc">{component.card.description}</p>
        <div className="comp-card__tags">
          {tags.slice(0, viewMode === 'list' ? 6 : 4).map(tag => (
            <span key={tag} className="comp-card__tag">{tag}</span>
          ))}
          {tags.length > (viewMode === 'list' ? 6 : 4) && (
            <span className="comp-card__tag comp-card__tag--more">+{tags.length - (viewMode === 'list' ? 6 : 4)}</span>
          )}
        </div>
        {viewMode === 'list' && (
          <div className="comp-card__list-footer">
            {variantCount > 0 && <span className="comp-card__variant-badge">{variantCount} 变体</span>}
            {dependencies.length > 0 && (
              <span className="comp-card__deps">
                依赖: {dependencies.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
