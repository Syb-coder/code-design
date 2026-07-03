import { ComponentMeta } from './types'

/**
 * 搜索命中权重：不同字段的匹配重要程度
 * 名称命中权重最高，描述命中权重最低
 */
const SCORE_WEIGHTS = {
  name: 5,
  tag: 3,
  scene: 2,
  techStack: 2,
  description: 1,
  category: 1,
} as const

/**
 * 全文搜索：匹配组件名、标签、描述、适用场景
 *
 * @param list 待搜索组件列表
 * @param query 搜索关键词（支持空格分词，任意词命中即累计得分）
 * @returns 按命中得分倒序排列的组件列表（仅返回 score > 0 的项）
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
        if (c.name.toLowerCase().includes(term)) score += SCORE_WEIGHTS.name
        if (c.tags.some(t => t.includes(term))) score += SCORE_WEIGHTS.tag
        if (c.card.applicableScenes.some(s => s.toLowerCase().includes(term))) score += SCORE_WEIGHTS.scene
        if (c.card.description.toLowerCase().includes(term)) score += SCORE_WEIGHTS.description
        if (c.techStack.includes(term)) score += SCORE_WEIGHTS.techStack
        if (c.category.includes(term)) score += SCORE_WEIGHTS.category
      }
      return { component: c, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.component)
}
