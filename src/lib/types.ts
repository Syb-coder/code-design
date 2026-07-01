/** 组件元数据 */
export interface ComponentMeta {
  id: string
  name: string
  techStack: TechStack
  category: Category
  tags: string[]
  variants?: Variant[]
  relatedComponents?: string[]
  dependencies: string[]
  fonts?: string[]
  source: string
  sourceUrl?: string
  author?: string
  createdAt: string
  updatedAt: string
  /** card.md 内容 */
  card: AICard
  /** 预览组件路径（实际动态 import 用） */
  previewPath: string
  /** 源码路径（用于复制） */
  sourcePath: string
}

export type TechStack = 'react' | 'html' | 'vue'

export type Category =
  | 'layout'       // 布局（网格、容器、分割）
  | 'navigation'   // 导航（侧边栏、顶栏、面包屑）
  | 'form'         // 表单（输入框、选择器、开关）
  | 'data-display' // 数据展示（统计卡片、表格、图表）
  | 'feedback'     // 反馈（消息通知、对话框、加载）
  | 'button'       // 按钮（各种风格按钮）
  | 'effects'      // 动效交互（悬停、滚动、磁吸）
  | '3d'           // 3D 场景

export interface Variant {
  name: string
  file: string
  description: string
}

export interface AICard {
  description: string
  props: PropDef[]
  usageExample: string
  applicableScenes: string[]
}

export interface PropDef {
  name: string
  type: string
  defaultValue?: string
  description: string
}
