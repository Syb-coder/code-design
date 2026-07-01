import { useState, useCallback, useRef, useEffect } from 'react'
import { components } from '../lib/mock-data'
import { searchComponents } from '../lib/search'
import { ComponentMeta } from '../lib/types'
import './SearchBox.css'

interface Props {
  value: string
  onChange: (value: string) => void
  onResultSelect?: (component: ComponentMeta) => void
}

export default function SearchBox({ value, onChange, onResultSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ComponentMeta[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback((q: string) => {
    onChange(q)
    if (q.trim()) {
      setResults(searchComponents(components, q).slice(0, 8))
      setOpen(true)
      setActiveIndex(-1)
    } else {
      setOpen(false)
    }
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      onResultSelect?.(results[activeIndex])
      setOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }, [open, activeIndex, results, onResultSelect])

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="search-box" ref={containerRef}>
      <svg className="search-box__icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        className="search-box__input"
        type="text"
        placeholder="搜索组件名、标签、用途..."
        value={value}
        onChange={e => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => value.trim() && results.length > 0 && setOpen(true)}
        aria-label="搜索组件"
        aria-expanded={open}
        role="combobox"
      />
      {value && (
        <button
          className="search-box__clear"
          onClick={() => { handleSearch(''); inputRef.current?.focus() }}
          aria-label="清除搜索"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="search-box__dropdown" role="listbox">
          {results.map((r, i) => (
            <li
              key={r.id}
              className={`search-box__item ${i === activeIndex ? 'is-active' : ''}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={e => { e.preventDefault(); onResultSelect?.(r); setOpen(false) }}
            >
              <span className="search-box__item-name">{r.name}</span>
              <span className="search-box__item-meta">
                {r.techStack} · {r.category.replace('-', ' ')}
              </span>
              <span className="search-box__item-tags">
                {r.tags.slice(0, 3).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && value.trim() && results.length === 0 && (
        <div className="search-box__empty">
          未找到匹配组件
        </div>
      )}
    </div>
  )
}
