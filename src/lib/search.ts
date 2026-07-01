import { ComponentMeta } from './types'

/**
 * 全文搜索：匹配组件名、标签、描述、适用场景
 */
export function searchComponents(
  list: ComponentMeta[],
  query: string,
): ComponentMeta[] {
  if (!query.trim()) return list
  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/)

  return list
    .map(c => {
      let score = 0
      const haystack = [
        c.name.toLowerCase(),
        ...c.tags,
        c.card.description.toLowerCase(),
        ...c.card.applicableScenes,
      ].join(' ')

      for (const term of terms) {
        if (c.name.toLowerCase().includes(term)) score += 5
        if (c.tags.some(t => t.includes(term))) score += 3
        if (c.card.applicableScenes.some(s => s.toLowerCase().includes(term))) score += 2
        if (c.card.description.toLowerCase().includes(term)) score += 1
        if (c.techStack.includes(term)) score += 2
        if (c.category.includes(term)) score += 1
      }
      return { component: c, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.component)
}
