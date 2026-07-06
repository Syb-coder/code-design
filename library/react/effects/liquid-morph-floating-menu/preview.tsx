/**
 * 预览入口 - Liquid Morph Floating Menu
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局说明：
 *   原组件使用 `fixed bottom-10 left-1/2` 定位到视口底部居中。
 *   预览容器通过 `transform: translateZ(0)` 创建包含块（containing block），
 *   让 fixed 定位相对本容器而非视口，确保在沙箱/卡片/详情页中菜单始终在容器内可见。
 *
 *   背景采用中性深灰（#2a2a2a），比纯黑更柔和，同时让黄色胶囊高对比突出。
 *   底部预留 bottom-10（40px）空间，让菜单自然落在容器底部居中。
 *
 *   不使用 PreviewScaler：组件设计宽 280px（展开态）< 640，无需缩放
 */

import FloatingMenu from './index';

export default function Preview() {
  return (
    <div
      style={{
        // 填满父级（沙箱视口 / 卡片缩略 stage）
        width: '100%',
        height: '100%',
        // 中性深灰背景，让黄色胶囊高对比突出
        background: '#2a2a2a',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        // 创建包含块：让子元素的 fixed 定位相对本容器而非视口
        // 根据 CSS Containment 规范，transform 不为 none 时元素成为 fixed 后代的包含块
        transform: 'translateZ(0)',
      }}
    >
      <FloatingMenu />
    </div>
  );
}
