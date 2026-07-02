/**
 * 预览入口 - Shining Text
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局说明：
 *   还原 21st.dev 预览舞台视觉：
 *   - 亮色背景（白底）+ 半透明黑点阵网格（lab-bg）
 *   - 居中显示 ShiningText 组件
 *   复用原 demoCode 文案 "HextaAI is thinking..."
 *
 *   适配两种场景：
 *   1. 沙箱路由全屏渲染（G2 校验截图）：占满视口，居中显示
 *   2. 首页卡片缩略图（等比缩放）：填满缩略框，无大片留白
 */

import { ShiningText } from './index';

export default function Preview() {
  return (
    <div
      style={{
        // 填满父级（沙箱视口 / 卡片缩略 stage）
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 21st.dev 亮色舞台背景
        background: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '2rem',
      }}
    >
      {/* 点阵网格背景层（还原 21st.dev lab-bg，亮色模式半透明黑点） */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(#00000021 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* 组件：居中显示 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ShiningText text="HextaAI is thinking..." />
      </div>
    </div>
  );
}
