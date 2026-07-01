import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { components } from '../lib/mock-data'
import { searchComponents } from '../lib/search'
import { Category, ComponentMeta } from '../lib/types'
import SearchBox from '../components/SearchBox'
import FilterBar from '../components/FilterBar'
import ComponentGrid from '../components/ComponentGrid'
import './HomePage.css'

export default function HomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filtered = useMemo(() => {
    let result = components
    if (category !== 'all') result = result.filter(c => c.category === category)
    if (query.trim()) result = searchComponents(result, query)
    return result
  }, [query, category])

  const handleResultSelect = useCallback((c: ComponentMeta) => {
    setQuery('')
    navigate(`/component/${c.id}`)
  }, [navigate])

  return (
    <div className="home">
      <header className="home__header">
        <div className="home__brand">
          <div className="home__logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="3" fill="var(--color-accent)" opacity="0.9" />
              <rect x="16" y="2" width="10" height="10" rx="3" fill="var(--color-accent)" opacity="0.5" />
              <rect x="2" y="16" width="10" height="10" rx="3" fill="var(--color-accent)" opacity="0.5" />
              <rect x="16" y="16" width="10" height="10" rx="3" fill="var(--color-accent)" opacity="0.3" />
            </svg>
            <h1 className="home__title">组件知识库</h1>
          </div>
          <p className="home__subtitle">
            收集、整理、预览本地高质量组件，让 AI 在 vibecoding 时精准参考
          </p>
        </div>
      </header>

      <div className="home__toolbar">
        <SearchBox value={query} onChange={setQuery} onResultSelect={handleResultSelect} />
        <div className="home__toolbar-right">
          <FilterBar
            category={category}
            onCategoryChange={setCategory}
          />
          <div className="home__view-toggle">
            <button
              className={`home__view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="网格视图"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
              </svg>
            </button>
            <button
              className={`home__view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="列表视图"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="14" height="4" rx="1.5" />
                <rect x="1" y="7" width="14" height="4" rx="1.5" />
                <rect x="1" y="13" width="14" height="2" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="home__status">
        <span>{filtered.length} 个组件</span>
        {(category !== 'all' || query) && (
          <button
            className="home__clear-filters"
            onClick={() => { setCategory('all'); setQuery('') }}
          >
            清除筛选
          </button>
        )}
      </div>

      <main className="home__content">
        <ComponentGrid components={filtered} viewMode={viewMode} />
      </main>
    </div>
  )
}
