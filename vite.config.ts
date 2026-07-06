import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // @/ 别名指向 src/，对齐 tsconfig.json 的 paths 配置
      // 供 preview.tsx 等组件文件导入公共组件（如 PreviewScaler）使用
      '@': path.resolve(__dirname, './src'),
    },
    // dedupe：强制 React 单一实例，避免 @react-three/fiber / @heroui/react 等
    // 依赖传递引入自己的 React 副本导致 "Invalid hook call" 错误
    dedupe: ['react', 'react-dom', 'scheduler'],
  },
  server: {
    port: 5173,
    host: true,
  },
})
