import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DetailPage from './pages/DetailPage'
import SandboxPage from './pages/SandboxPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/component/:id" element={<DetailPage />} />
      {/* 沙箱路由：供 G2 渲染校验截图，纯白背景无 chrome，路径参数为组件相对路径 */}
      <Route path="/__sandbox__/*" element={<SandboxPage />} />
    </Routes>
  )
}
