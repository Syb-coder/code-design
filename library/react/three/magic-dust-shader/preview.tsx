/**
 * 预览入口 - MagicDust 粒子聚合着色器
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局说明：
 *   还原 21st.dev 预览舞台视觉：
 *   - 深色背景（粒子默认白色，深底对比突出发光）
 *   - 全屏 Canvas 渲染粒子动画
 *   - 复用原组件默认序列（MAGIC / DUST / UI FACTORY + 几何体）
 *
 *   组件本身是全视口响应式（Canvas 自适应父级），无需 PreviewScaler。
 */

import { MagicDust } from './index';

export default function Preview() {
  return (
    <div
      style={{
        // 填满父级（沙箱视口 / 卡片缩略 stage）
        width: '100%',
        height: '100%',
        // 深色背景：与白色粒子（AdditiveBlending）形成强对比
        background: '#050505',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* MagicDust 内部含 Canvas，自适应填充父级 */}
      <MagicDust />
    </div>
  );
}
