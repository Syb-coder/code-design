import { Category } from '../lib/types'
import { getFilterCounts } from '../lib/mock-data'
import './FilterBar.css'

const CAT_LABELS: Record<Category, string> = {
  layout: '布局',
  navigation: '导航',
  form: '表单',
  'data-display': '数据展示',
  feedback: '反馈',
  button: '按钮',
  effects: '动效交互',
  '3d': '3D',
  business: '业务场景',
  visualization: '可视化',
}

interface Props {
  category: Category | 'all'
  onCategoryChange: (v: Category | 'all') => void
}

export default function FilterBar({ category, onCategoryChange }: Props) {
  const counts = getFilterCounts()
  const cats: Category[] = ['button', 'form', 'navigation', 'layout', 'data-display', 'feedback', 'effects', '3d', 'business', 'visualization']

  return (
    <div className="filter-bar">
      <div className="filter-bar__group">
        <span className="filter-bar__label">分类</span>
        <div className="filter-bar__pills">
          <button
            className={`filter-bar__pill ${category === 'all' ? 'is-active' : ''}`}
            onClick={() => onCategoryChange('all')}
          >
            全部
          </button>
          {cats.map(c => (
            <button
              key={c}
              className={`filter-bar__pill ${category === c ? 'is-active' : ''}`}
              onClick={() => onCategoryChange(c)}
            >
              {CAT_LABELS[c]}
              <span className="filter-bar__count">{counts[`cat:${c}`] || 0}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
