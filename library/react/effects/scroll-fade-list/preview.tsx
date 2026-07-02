/**
 * 预览入口 - Scroll Fade List
 *
 * 供校验 Skill 沙箱路由渲染 + 预览应用展示。
 * 沙箱路由通过 import.meta.glob 扫描 library 下所有 preview.tsx 加载。
 *
 * 预览布局说明：
 *   预览需同时适配两种场景：
 *   1. 沙箱路由全屏渲染（G2 校验截图）：需占满视口，居中显示
 *   2. 首页卡片缩略图（等比缩放到 330×206）：需填满缩略框，不能有大片留白
 *
 *   采用方案：外层用 100% 宽高 + flex 居中 + padding，列表用固定宽度。
 *   - 全屏时：列表居中，周围留白合理
 *   - 缩略图时：列表占缩略框大部分面积，留白少
 *
 * demo 数据复用原 21st.dev demoCode 的国家队列表，确保预览与原组件视觉一致。
 */

import { ScrollFadeList } from './index';

/** 队伍数据（code/flag/name），与原 21st.dev demoCode 一致 */
interface Team {
  code: string;
  flag: string;
  name: string;
}

const teams: Team[] = [
  { code: 'za', flag: '🇿🇦', name: 'South Africa' },
  { code: 'ca', flag: '🇨🇦', name: 'Canada' },
  { code: 'br', flag: '🇧🇷', name: 'Brazil' },
  { code: 'jp', flag: '🇯🇵', name: 'Japan' },
  { code: 'de', flag: '🇩🇪', name: 'Germany' },
  { code: 'py', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'nl', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'ma', flag: '🇲🇦', name: 'Morocco' },
  { code: 'ci', flag: '🇨🇮', name: 'Ivory Coast' },
  { code: 'no', flag: '🇳🇴', name: 'Norway' },
  { code: 'fr', flag: '🇫🇷', name: 'France' },
  { code: 'se', flag: '🇸🇪', name: 'Sweden' },
  { code: 'mx', flag: '🇲🇽', name: 'Mexico' },
  { code: 'ec', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'en', flag: '🏴', name: 'England' },
  { code: 'cd', flag: '🇨🇩', name: 'DR Congo' },
  { code: 'be', flag: '🇧🇪', name: 'Belgium' },
  { code: 'sn', flag: '🇸🇳', name: 'Senegal' },
  { code: 'us', flag: '🇺🇸', name: 'United States' },
  { code: 'ba', flag: '🇧🇦', name: 'Bosnia and Herzegovina' },
  { code: 'es', flag: '🇪🇸', name: 'Spain' },
  { code: 'at', flag: '🇦🇹', name: 'Austria' },
  { code: 'pt', flag: '🇵🇹', name: 'Portugal' },
  { code: 'hr', flag: '🇭🇷', name: 'Croatia' },
  { code: 'ch', flag: '🇨🇭', name: 'Switzerland' },
  { code: 'dz', flag: '🇩🇿', name: 'Algeria' },
  { code: 'au', flag: '🇦🇺', name: 'Australia' },
  { code: 'eg', flag: '🇪🇬', name: 'Egypt' },
  { code: 'ar', flag: '🇦🇷', name: 'Argentina' },
  { code: 'cv', flag: '🇨🇻', name: 'Cabo Verde' },
  { code: 'co', flag: '🇨🇴', name: 'Colombia' },
  { code: 'gh', flag: '🇬🇭', name: 'Ghana' },
];

export default function Preview() {
  return (
    <div
      style={{
        // 填满父级（沙箱视口 / 卡片缩略 stage），无额外留白
        width: '100%',
        height: '100%',
        // 列表居中显示
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 背景与列表容器同色（白），避免灰色背景在暗色首页突兀
        background: 'white',
        boxSizing: 'border-box',
        // 给一点 padding，让列表不贴边，但不要太多（scale 后会压缩）
        padding: '1rem',
      }}
    >
      {/* 列表固定宽度 24rem（384px），在 640px stage 里占 60%，scale 后视觉占比合理
          沙箱全屏时也居中显示，不会过宽 */}
      <div style={{ width: '24rem' }}>
        <ScrollFadeList
          getKey={(team) => team.code}
          items={teams}
          renderItem={(team) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span aria-hidden="true">{team.flag}</span>
              <span>{team.name}</span>
            </span>
          )}
        />
      </div>
    </div>
  );
}
