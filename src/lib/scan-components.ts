/**
 * 组件扫描器：在 Vite 构建时自动扫描 library/ 目录下的所有组件
 *
 * 数据来源：
 *   - 每个组件目录的 meta.json（提供元数据：id/name/tags/category 等）
 *   - 每个组件目录的 card.md（提供 AI 卡片：description/props/usageExample/applicableScenes）
 *
 * 替代了原 mock-data.ts 中的硬编码虚拟数据，让网页端能直接反映 library/ 真实入库的组件
 */

import { AICard, ComponentMeta, PropDef, TechStack } from './types'

/**
 * Vite 构建时扫描：
 *   - meta.json：eager 加载为对象
 *   - card.md：以 ?raw 形式加载原始字符串，再运行时解析
 *   - preview.tsx：扫描但不 eager，留给 ComponentPreview 按需 lazy import
 */
const metaModules = import.meta.glob<Record<string, unknown>>('/library/**/meta.json', { eager: true })
const cardModules = import.meta.glob<string>('/library/**/card.md', { eager: true, query: '?raw', import: 'default' })

/** preview.tsx 模块映射，key 为从项目根起的绝对路径（如 /library/react/.../preview.tsx） */
export const previewModules = import.meta.glob('/library/**/preview.tsx')

/** meta.json 字段约束（meta.json 必含这些字段） */
interface MetaJson {
  id: string
  name: string
  techStack: TechStack
  category: string
  tags: string[]
  dependencies: string[]
  source: string
  sourceUrl?: string
  author?: string
  createdAt: string
  updatedAt: string
  variants?: Array<{ name: string; file: string; description: string }>
  relatedComponents?: string[]
  fonts?: string[]
  sourceType?: string
  styling?: string
  animation?: string
}

/**
 * 解析 card.md 提取 AI 卡片信息
 *
 * card.md 结构（参考 docs/ai-card-template.md）：
 *   ---
 *   frontmatter（已被 import.meta.glob 跳过，因为 ?raw 读全文，这里再跳过）
 *   ---
 *   # 标题
 *   ## 视觉描述
 *   ## 关键 API（markdown 表格）
 *   ## 最小使用示例（代码块）
 *   ## 适用场景（列表）
 *
 * @param content card.md 原始字符串
 * @param meta 元数据，用于在 card.md 缺失字段时兜底
 */
function parseCardMd(content: string, meta: MetaJson): AICard {
  // 跳过 frontmatter（首个 --- ... --- 块）
  let body = content
  if (body.startsWith('---')) {
    const closeIdx = body.indexOf('---', 3)
    if (closeIdx >= 0) body = body.slice(closeIdx + 3)
  }

  /** 提取某个 ## 小节内容，遇到下一个 ## 或文件尾结束 */
  function extractSection(title: string): string {
    const re = new RegExp(`^##\\s+${title}\\s*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'm')
    const m = body.match(re)
    return m ? m[1].trim() : ''
  }

  // 视觉描述 → description
  const description = extractSection('视觉描述') || extractSection('Description') || ''

  // 关键 API 表格 → props
  const apiSection = extractSection('关键 API') || extractSection('Props') || extractSection('API')
  const props: PropDef[] = []
  for (const line of apiSection.split('\n')) {
    // 匹配 | name | type | default | desc | 形式
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/)
    if (!m) continue
    const name = m[1].trim()
    // 跳过表头与分隔行（如 "Prop" 或 "---" / ":---"）
    if (name === 'Prop' || name === '名称' || /^[-:\s]+$/.test(name)) continue
    props.push({
      name,
      type: m[2].trim(),
      defaultValue: m[3].trim() || undefined,
      description: m[4].trim(),
    })
  }

  // 最小使用示例 → usageExample（取首个代码块）
  const usageSection = extractSection('最小使用示例') || extractSection('使用示例') || extractSection('Usage')
  const codeMatch = usageSection.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
  const usageExample = codeMatch ? codeMatch[1].trim() : ''

  // 适用场景 → applicableScenes（按 - 列表提取）
  const scenesSection = extractSection('适用场景') || extractSection('场景')
  const applicableScenes = scenesSection
    .split('\n')
    .map(l => l.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1])
    .filter((x): x is string => !!x)

  return {
    description,
    props,
    usageExample,
    applicableScenes,
  }
}

/**
 * 由 techStack 推导源码文件扩展名
 * @param techStack 技术栈
 */
function sourceExt(techStack: TechStack): string {
  switch (techStack) {
    case 'react': return 'tsx'
    case 'vue': return 'vue'
    case 'html': return 'html'
    default: return 'tsx'
  }
}

/**
 * 扫描 library/ 目录下所有组件，构建 ComponentMeta 列表
 *
 * 规则：
 *   - 必须存在 meta.json，否则跳过
 *   - card.md 缺失时使用空卡片兜底（不阻断显示）
 *   - previewPath 用 Vite glob key 格式（/library/.../preview.tsx），供 ComponentPreview 查找模块
 *   - sourcePath 用相对路径格式（library/.../index.tsx），供 DetailPage 复制给 AI 使用
 */
export function scanComponents(): ComponentMeta[] {
  const list: ComponentMeta[] = []

  for (const [metaPath, mod] of Object.entries(metaModules)) {
    const meta = (mod as { default: MetaJson }).default as MetaJson
    if (!meta || !meta.id || !meta.name) {
      // 跳过不完整的 meta.json
      continue
    }

    // 由 meta.json 路径推导组件目录（如 /library/react/business/modern-login-signup/meta.json → /library/react/business/modern-login-signup）
    const dir = metaPath.replace(/\/meta\.json$/, '')
    const ext = sourceExt(meta.techStack)
    const previewPath = `${dir}/preview.${ext === 'tsx' ? 'tsx' : ext === 'vue' ? 'vue' : 'html'}`
    const sourcePath = `${dir.replace(/^\//, '')}/index.${ext}`

    // card.md 缺失时使用空卡片兜底
    const cardKey = `${dir}/card.md`
    const cardContent = cardModules[cardKey]
    const card = cardContent
      ? parseCardMd(cardContent, meta)
      : { description: '', props: [], usageExample: '', applicableScenes: [] }

    list.push({
      id: meta.id,
      name: meta.name,
      techStack: meta.techStack,
      category: meta.category as ComponentMeta['category'],
      tags: meta.tags || [],
      variants: meta.variants,
      relatedComponents: meta.relatedComponents,
      dependencies: meta.dependencies || [],
      fonts: meta.fonts,
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      author: meta.author,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      previewPath,
      sourcePath,
      card,
    })
  }

  // 按入库时间倒序排列（最新入库在前）
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return list
}
