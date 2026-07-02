/**
 * 组件数据源入口
 *
 * 历史版本：硬编码的虚拟组件数据集（包含 15 个假组件，library/ 下无对应源码）
 * 当前版本：从 scan-components.ts 扫描 library/ 目录获取真实入库组件
 *
 * 保留此文件作为兼容入口：HomePage / DetailPage / SearchBox / FilterBar 均从此导入
 */

import { scanComponents } from './scan-components'
import { ComponentMeta } from './types'

/** 组件列表：由扫描器在构建时从 library/ 自动生成 */
export const components: ComponentMeta[] = scanComponents()

/** 标签全集（用于标签云 / 筛选下拉） */
export function getAllTags(): string[] {
  const tagSet = new Set<string>()
  components.forEach(c => c.tags.forEach(t => tagSet.add(t)))
  return Array.from(tagSet).sort()
}

/** 按分类获取筛选计数 */
export function getFilterCounts() {
  const counts: Record<string, number> = {}
  components.forEach(c => {
    counts[`cat:${c.category}`] = (counts[`cat:${c.category}`] || 0) + 1
  })
  return counts
}
