/**
 * Pricing Glass
 *
 * 来源：21st.dev
 * 原作者：uithefactory
 * 原始 URL：https://21st.dev/@uithefactory/components/pricing-glass
 * 入库日期：2026-07-02
 *
 * 实现说明：
 *   ⚠️ 还原实现，非原始源码。因 21st.dev registry 需认证（shadcn add 403），
 *   未能获取真实源码。本实现基于 fetch-source.ts 抓取的渲染后 DOM +
 *   JSON-LD 描述（"deep glassmorphism, animated light beams, and
 *   interactive mouse-tracking physics"）+ demoCode 使用示例还原。
 *
 *   核心机制忠实还原原组件：
 *   - 深玻璃拟态：backdrop-blur + backdrop-saturate + backdrop-brightness 多重滤镜
 *   - 鼠标跟踪光束：onMouseMove + rAF 批处理 + CSS 变量驱动 radial-gradient
 *   - Pro 卡片旋转光边框：conic-gradient + CSS spin 动画 + mask 镂空只显示边框
 *   - Monthly/Annually 切换：滑块 CSS transition + 价格数字 key 切换上滑动画
 *   - 入场动画：CSS keyframes + animation-delay 交错（Pro 卡片终态带上偏移）
 *   - 中心大光晕：blur(120px) 营造氛围
 *
 * 改造点（相对原 21st.dev 渲染 DOM）：
 *   - Tailwind 类转为 inline style + <style>（本项目未引入 Tailwind）
 *   - check 图标用内联 SVG（本项目未装 lucide-react）
 *   - framer-motion 动画转为 CSS keyframes（本项目未装 framer-motion）
 *   - 加文件头注释 + JSDoc + Props 类型
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

// ============================================================
// 类型定义
// ============================================================

/** 单个定价档位 */
export interface PricingTier {
  /** 档位名称，如 "Basic" / "Pro" / "Ultra" */
  name: string;
  /** 月付价格（数字字符串，如 "9"） */
  priceMonthly: string;
  /** 年付价格（数字字符串，如 "7"，切换到 Annual 时显示） */
  priceAnnual: string;
  /** 档位描述文案 */
  description: string;
  /** 是否标记为"最受欢迎"（Pro 档，触发旋转光边框 + 上偏移 + Most Popular 标签） */
  isPopular?: boolean;
  /** 功能特性列表 */
  features: string[];
}

/** PricingGlass 组件 Props */
export interface PricingGlassProps {
  /** 定价档位数组（建议 3 个，其中一个设 isPopular=true） */
  tiers: PricingTier[];
  /** 容器额外 inline style */
  style?: CSSProperties;
}

// ============================================================
// 常量
// ============================================================

/**
 * 噪点纹理 SVG（fractalNoise），用于卡片背景增加玻璃质感
 * 对齐原 DOM 中的 data:image/svg+xml 内联噪点
 */
const NOISE_BG_IMAGE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")";

/** check 图标 SVG path（lucide check 图标，stroke-width=3） */
const CHECK_ICON_PATH = 'M20 6 9 17l-5-5';

/**
 * 全局样式：keyframes + Pro 旋转光边框 + 按钮 hover + 切换器 hover
 * 仅注入一次（React 会复用同一 <style>），多实例共享安全
 */
const GLOBAL_CSS = `
/* 卡片容器：仅 opacity 淡入（内部元素各自级联，见 pg-fade-in-up） */
@keyframes pg-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* 卡片内部元素级联入场：translateY(20px) scale(0.8) → none
   对齐原 framer-motion spring 初始态，cubic-bezier 近似 spring 物理感 */
@keyframes pg-fade-in-up {
  from { opacity: 0; transform: translateY(20px) scale(0.8); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pg-price-slide {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes pg-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* Pro 旋转光边框：1px padding + mask 镂空 content 区，只显示边框 */
.pg-popular-border {
  position: absolute;
  inset: 0;
  border-radius: 32px;
  pointer-events: none;
  padding: 1px;
  -webkit-mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  overflow: hidden;
}
.pg-popular-border::before {
  content: '';
  position: absolute;
  inset: -100%;
  animation: pg-spin 4s linear infinite;
  background: conic-gradient(transparent 70%, rgba(255, 255, 255, 0.8) 100%);
}
/* CTA 按钮 hover（用 class 避免内联 onMouseEnter 繁琐） */
.pg-btn {
  width: 100%;
  padding: 1rem 0;
  border-radius: 16px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 300ms;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25);
}
.pg-btn:hover {
  transform: scale(1.02);
}
.pg-btn-normal {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.pg-btn-normal:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
.pg-btn-popular {
  background-color: white;
  color: black;
  border: none;
}
.pg-btn-popular:hover {
  background-color: rgba(255, 255, 255, 0.9);
}
/* 切换器按钮 hover（非激活态） */
.pg-toggle-btn {
  position: relative;
  padding: 0.75rem clamp(1.5rem, 4vw, 2rem);
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  transition: color 300ms;
  z-index: 10;
  background: none;
  border: none;
  cursor: pointer;
}
.pg-toggle-btn-active {
  color: white;
}
.pg-toggle-btn-inactive {
  color: rgba(255, 255, 255, 0.5);
}
.pg-toggle-btn-inactive:hover {
  color: rgba(255, 255, 255, 0.8);
}
`;

// ============================================================
// 子组件：PricingCard
// ============================================================

/**
 * 单个定价卡片
 *
 * 含鼠标跟踪光束、Pro 旋转光边框、噪点纹理、入场动画。
 * 鼠标跟踪用 ref + CSS 变量驱动 radial-gradient，避免高频 mousemove 引发 re-render。
 *
 * @param tier 档位数据
 * @param isAnnual 是否年付（决定显示 priceMonthly / priceAnnual）
 * @param index 序号（用于入场动画 delay 交错）
 */
function PricingCard({
  tier,
  isAnnual,
  index,
}: {
  tier: PricingTier;
  isAnnual: boolean;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // rAF 句柄，批处理 mousemove + 卸载时取消，避免内存泄漏
  const rafRef = useRef<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Pro 档位差异：旋转光边框 + 上偏移 + Most Popular 标签 + 实心按钮
  const isPopular = tier.isPopular === true;

  // 当前价格（月付/年付切换，key 变化触发上滑动画）
  const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;

  /**
   * 鼠标移动 → 更新 CSS 变量驱动 radial-gradient 光束位置
   * 通过 rAF 批处理，同帧多次 mousemove 只写一次 DOM，避免高频 reflow
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    const cardEl = cardRef.current;
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 已有 rAF 在队列中则跳过，本帧只处理第一次
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      cardEl.style.setProperty('--mouse-x', `${x}px`);
      cardEl.style.setProperty('--mouse-y', `${y}px`);
    });
  };

  // 卸载时清理未执行的 rAF，避免卸载后回调操作已销毁 DOM
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // 卡片间级联基准延迟（Basic=0, Pro=120, Ultra=240），内部元素在此基础上再叠加
  const baseDelay = index * 120;

  // 卡片容器样式：玻璃拟态核心 + opacity 淡入
  const cardStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderRadius: '32px',
    // 深玻璃拟态：极低透明度白底 + 多重 backdrop 滤镜（blur + saturate + brightness）
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(64px) saturate(180%) brightness(1.1)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 500ms',
    border: isPopular
      ? '1px solid rgba(255, 255, 255, 0.2)'
      : '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: isPopular
      ? 'inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(255,255,255,0.05), 0 32px 64px -12px rgba(0,0,0,0.6), 0 0 80px rgba(255,255,255,0.05)'
      : 'inset 0 1px 1px rgba(255,255,255,0.15), 0 32px 64px -12px rgba(0,0,0,0.6)',
    // Pro 卡片静态上偏移（对齐原 md:-translate-y-4），非动画属性
    transform: isPopular ? 'translateY(-1rem)' : 'none',
    // 卡片容器仅 opacity 淡入，内部元素各自 pg-fade-in-up 级联（见下方各元素）
    animation: `pg-fade-in 500ms ${baseDelay}ms ease-out both`,
  };

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 鼠标跟踪光束：radial-gradient 跟随鼠标位置，hover 时显现 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          borderRadius: '32px',
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 500ms',
          // CSS 变量由 mousemove 事件更新，未触发前用 0px fallback（不可见因 opacity:0）
          background:
            'radial-gradient(600px at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(255, 255, 255, 0.15), transparent)',
        }}
      />

      {/* Pro 卡片旋转光边框：conic-gradient 旋转 + mask 镂空只显示 1px 边框 */}
      {isPopular && <div className="pg-popular-border" />}

      {/* 噪点纹理：极低透明度 + overlay 混合模式，增加玻璃质感 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          opacity: 0.03,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          backgroundImage: NOISE_BG_IMAGE,
        }}
      />

      {/* Most Popular 标签（仅 Pro 卡片，顶部居中） */}
      {isPopular && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.25rem 1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0 0 0.75rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            zIndex: 20,
          }}
        >
          Most Popular
        </div>
      )}

      {/* 内容区：pointer-events:none 让鼠标透传到卡片触发 mousemove，按钮单独开启 */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          padding: 'clamp(2rem, 4vw, 2.5rem)',
          flex: 1,
          pointerEvents: 'none',
        }}
      >
        {/* 档位名称（级联第 1 步） */}
        <h3
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.8)',
            letterSpacing: '0.025em',
            animation: `pg-fade-in-up 600ms ${baseDelay}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        >
          {tier.name}
        </h3>

        {/* 价格区：$ + 数字 + /mo（级联第 2 步，整体 block 入场） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.25rem',
            marginTop: '1rem',
            marginBottom: '0.5rem',
            animation: `pg-fade-in-up 600ms ${baseDelay + 80}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        >
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '1.5rem',
              fontWeight: 500,
              letterSpacing: '-0.025em',
            }}
          >
            $
          </span>
          {/* 数字容器：固定高度 + overflow hidden，配合 key 切换做上滑动画 */}
          <div
            style={{
              height: '60px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              key={price}
              style={{
                display: 'block',
                fontSize: '60px',
                fontWeight: 700,
                color: 'white',
                letterSpacing: '-0.05em',
                lineHeight: 1,
                // 价格切换时上滑入场（key 变化触发重新挂载）
                animation: 'pg-price-slide 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {price}
            </span>
          </div>
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '1.125rem',
              fontWeight: 500,
              marginLeft: '0.25rem',
            }}
          >
            /mo
          </span>
        </div>

        {/* 描述文案（级联第 3 步） */}
        <p
          style={{
            margin: 0,
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            marginBottom: '2rem',
            minHeight: '40px',
            animation: `pg-fade-in-up 600ms ${baseDelay + 160}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        >
          {tier.description}
        </p>

        {/* 分隔线（级联第 4 步） */}
        <div
          style={{
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            marginBottom: '2rem',
            animation: `pg-fade-in-up 600ms ${baseDelay + 240}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        />

        {/* 功能特性列表（级联第 5 步，每个 feature 再错开 60ms） */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '2.5rem',
            flex: 1,
          }}
        >
          {tier.features.map((feature, i) => (
            <div
              key={`${feature}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                animation: `pg-fade-in-up 600ms ${baseDelay + 320 + i * 60}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
              }}
            >
              {/* check 圆形图标容器 */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.25rem',
                  height: '1.25rem',
                  marginTop: '0.125rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2)',
                }}
              >
                {/* 内联 check SVG（避免依赖 lucide-react） */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                  aria-hidden="true"
                >
                  <path d={CHECK_ICON_PATH} />
                </svg>
              </div>
              <span
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: 1.25,
                }}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* CTA 按钮：pointer-events:auto 恢复点击（级联第 6 步） */}
        <div
          style={{
            pointerEvents: 'auto',
            animation: `pg-fade-in-up 600ms ${baseDelay + 400}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        >
          <button className={`pg-btn ${isPopular ? 'pg-btn-popular' : 'pg-btn-normal'}`}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 主组件：PricingGlass
// ============================================================

/**
 * PricingGlass - 玻璃拟态三档定价表
 *
 * 深色背景下的高端定价卡片组，核心特性：
 * - 深玻璃拟态：backdrop-blur + saturate + brightness 多重滤镜
 * - 鼠标跟踪光束：每张卡片 hover 时有跟随鼠标的 radial 光晕
 * - Pro 卡片旋转光边框：conic-gradient 旋转 + mask 镂空
 * - Monthly/Annual 切换：滑块滑动 + 价格数字上滑切换
 * - 中心大光晕：blur(120px) 营造氛围
 *
 * 需放置在深色背景上才能显出玻璃效果（背景色由父容器/preview 提供）。
 *
 * @example
 * <PricingGlass tiers={[
 *   { name: 'Basic', priceMonthly: '9', priceAnnual: '7', description: '...', features: ['...'] },
 *   { name: 'Pro', priceMonthly: '29', priceAnnual: '24', description: '...', isPopular: true, features: ['...'] },
 *   { name: 'Ultra', priceMonthly: '99', priceAnnual: '79', description: '...', features: ['...'] },
 * ]} />
 */
export function PricingGlass({ tiers, style }: PricingGlassProps) {
  // 月付/年付切换状态
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          gap: '4rem',
          position: 'relative',
          ...style,
        }}
      >
        {/* 中心大光晕：blur(120px) 营造氛围 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '800px',
            height: '600px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            filter: 'blur(120px)',
            borderRadius: '9999px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* 标题区 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2rem',
            position: 'relative',
            zIndex: 20,
            width: '100%',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '0 1rem',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(2.25rem, 5vw, 3rem)',
                fontWeight: 700,
                color: 'white',
                letterSpacing: '-0.025em',
                animation: 'pg-fade-in-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              Simple, transparent pricing.
            </h2>
            <p
              style={{
                margin: 0,
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 'clamp(1.125rem, 3vw, 1.25rem)',
                maxWidth: '42rem',
                marginLeft: 'auto',
                marginRight: 'auto',
                animation:
                  'pg-fade-in-up 600ms 100ms cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              Choose the perfect plan for your needs. Switch to annual billing and save up to 20%.
            </p>
          </div>

          {/* Monthly / Annually 切换器 */}
          <div
            style={{
              position: 'relative',
              padding: '0.375rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(64px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              animation: 'pg-fade-in-up 600ms 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            {/* Monthly 按钮 */}
            <button
              onClick={() => setIsAnnual(false)}
              className={`pg-toggle-btn ${
                !isAnnual ? 'pg-toggle-btn-active' : 'pg-toggle-btn-inactive'
              }`}
            >
              Monthly
            </button>

            {/* Annually 按钮（带 SAVE 20% 标签） */}
            <button
              onClick={() => setIsAnnual(true)}
              className={`pg-toggle-btn ${
                isAnnual ? 'pg-toggle-btn-active' : 'pg-toggle-btn-inactive'
              }`}
            >
              Annually
              <span
                style={{
                  position: 'absolute',
                  top: '-0.75rem',
                  right: 'clamp(-0.75rem, -1.5vw, -1.5rem)',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  color: 'black',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                SAVE 20%
              </span>
            </button>

            {/* 滑块：CSS transition 平滑移动 */}
            <div
              style={{
                position: 'absolute',
                left: '0.375rem',
                top: '0.375rem',
                bottom: '0.375rem',
                width: 'calc(50% - 0.375rem)',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                // 月付→年付：滑块右移自身宽度（50%-6px），刚好落在 Annually 按钮位置
                transform: isAnnual ? 'translateX(100%)' : 'translateX(0)',
                transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>

        {/* 卡片网格：响应式 auto-fit，宽屏 3 列 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 'clamp(1.5rem, 3vw, 2rem)',
            alignItems: 'stretch',
            zIndex: 20,
          }}
        >
          {tiers.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual} index={i} />
          ))}
        </div>
      </div>
    </>
  );
}

export default PricingGlass;
