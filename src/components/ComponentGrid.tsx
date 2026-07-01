import { ComponentMeta } from '../lib/types'
import ComponentCard from './ComponentCard'
import './ComponentGrid.css'

interface Props {
  components: ComponentMeta[]
  viewMode: 'grid' | 'list'
}

export default function ComponentGrid({ components, viewMode }: Props) {
  if (components.length === 0) {
    return (
      <div className="comp-grid__empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="4" y="8" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="28" y="8" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="4" y="28" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="28" y="28" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p>没有找到匹配的组件</p>
        <span>尝试调整筛选条件或搜索关键词</span>
      </div>
    )
  }

  return (
    <div className={`comp-grid comp-grid--${viewMode}`}>
      {components.map(c => (
        <ComponentCard key={c.id} component={c} viewMode={viewMode} />
      ))}
    </div>
  )
}
