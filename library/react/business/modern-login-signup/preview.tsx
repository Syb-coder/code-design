/**
 * 预览入口 - Modern Login & Signup
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 */

import ModernLoginSignup from './index';

export default function Preview() {
  return <ModernLoginSignup />;
}
