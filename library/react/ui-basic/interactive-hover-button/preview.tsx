/**
 * 预览入口 - Interactive Hover Button
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局：
 *   - 居中显示一个默认 InteractiveHoverButton（与 21st.dev demoCode 一致）
 *   - 适配沙箱全屏（1280×800）和卡片缩略图（640×400）
 *
 * 还原对齐原 21st.dev demoCode：
 *   <div className="relative justify-center">
 *     <InteractiveHoverButton />
 *   </div>
 *
 * 选择纯居中布局而非多按钮演示，原因：
 *   1) demoCode 原始用法就是单按钮，保持视觉对齐便于 G2 像素对比
 *   2) 组件动画靠 hover 触发，沙箱截图（G2 起播帧）只捕获默认态，多按钮无差异
 *   3) 用户在沙箱中可手动 hover 体验动画
 */

import { InteractiveHoverButton } from './index';

export default function Preview() {
  return (
    <div
      style={{
        // 填满父级（沙箱视口 / 卡片缩略 stage），无额外留白
        width: '100%',
        height: '100%',
        // 居中显示按钮
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 浅色背景对齐原 demo（21st.dev 默认浅色主题）
        background: '#ffffff',
        boxSizing: 'border-box',
      }}
    >
      <InteractiveHoverButton />
    </div>
  );
}
