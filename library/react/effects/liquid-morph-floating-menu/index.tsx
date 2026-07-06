/**
 * Liquid Morph Floating Menu
 *
 * 来源：21st.dev
 * 原作者：aayush-duhan
 * 原始 URL：https://21st.dev/@aayush-duhan/components/liquid-morph-floating-menu
 * 入库日期：2026-07-03
 *
 * 实现说明：
 *   本组件源码由用户直接粘贴（pasted-code 模式），保留原作者实现逻辑，
 *   仅做 L1/L2/L3 净化与 Props 抽取。G3 校验以 _source/original-source.tsx 为保真度基准。
 *
 * 核心技术：
 *   - Framer Motion 编排液态变形（width/height/borderRadius 联动过渡）
 *   - 圆形扩散层从底部上升覆盖黄色背景，形成"墨滴上涌"视觉
 *   - 菜单项字符级 stagger 动画（每个字符 30ms 延迟上推 50%）
 *   - animatingRef + pendingLeaveRef 防抖机制：动画进行中锁定 hover 状态，
 *     避免快速移动导致的抖动（lockDuration = 30 * chars.length + 300）
 *   - 外部点击关闭（mousedown 监听 + contains 检测）
 *
 * 改造点（相对原 21st.dev 源码）：
 *   - 移除 "use client" 指令（本项目是 Vite，非 Next.js）
 *   - Tailwind 类名全部转为 inline style（本项目未集成 Tailwind，原类名无效）
 *   - 提取魔法色值/尺寸/时长为命名常量（COLORS / DIMENSIONS / TIMINGS）
 *   - 硬编码 "Menu" 文案提取为 Prop（menuLabel）
 *   - 添加文件头注释 + JSDoc + 行注释
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';

// ============================================================
// 常量定义（命名常量替代魔法值，便于主题定制与维护）
// ============================================================

/** 统一缓动曲线（[0.22, 1, 0.36, 1] - 急停缓出） */
const EASE = [0.22, 1, 0.36, 1] as const;

/** 主题色板 */
const COLORS = {
  /** 关闭态：黄色背景 */
  bgClosed: '#FFE862',
  /** 关闭态：黄色描边（略深） */
  borderClosed: '#d1bb3b',
  /** 展开态：深色覆盖层 */
  darkLayer: '#242424',
  /** 展开态：浅色文字 */
  textLight: '#f7f1ed',
  /** 关闭态：深色文字（黄底上的深色字） */
  textDark: '#242424',
} as const;

/** 尺寸规格（px） */
const DIMENSIONS = {
  /** 关闭态宽度 */
  closedWidth: 150,
  /** 展开态宽度 */
  openWidth: 280,
  /** 关闭态高度 */
  closedHeight: 48,
  /** 展开态高度 */
  openHeight: 260,
  /** 关闭态圆角（胶囊形） */
  closedRadius: 72,
  /** 展开态圆角（圆角矩形） */
  openRadius: 32,
  /** 底部 bar 高度 */
  barHeight: 48,
} as const;

/** 动画时长（秒） */
const TIMINGS = {
  /** 主变形时长 */
  morph: 0.8,
  /** 关闭态高度回弹时长（短促） */
  closeHeight: 0.15,
  /** 缩放反馈时长 */
  scale: 0.25,
  /** 字符 hover 过渡时长（ms） */
  charHover: 800,
  /** 字符 stagger 单位延迟（ms） */
  charStagger: 30,
  /** 字符动画基础锁定时长（ms） */
  charLockBase: 300,
  /** 菜单项渐显时长 */
  itemFade: 0.4,
  /** 菜单项 stagger 单位延迟 */
  itemStagger: 0.08,
  /** 菜单项渐显基础延迟（展开时） */
  itemFadeBase: 0.4,
} as const;

/** 字体栈 */
const FONTS = {
  /** 菜单项字体（标题展示字） */
  menu: "'Trobika', 'Bebas Neue', sans-serif",
  /** 容器字体（UI 字体） */
  ui: "'Aeonik TRIAL', 'Inter', sans-serif",
} as const;

// ============================================================
// 类型定义
// ============================================================

/** 菜单项配置 */
export interface MenuItem {
  /** 菜单文案 */
  label: string;
  /** 点击回调 */
  onClick?: () => void;
}

/** FloatingMenu 组件 Props */
export interface FloatingMenuProps {
  /** 菜单项列表（缺省时使用默认三项 Home/Works/Contact） */
  items?: MenuItem[];
  /** 底部触发文案，默认 "Menu" */
  menuLabel?: string;
}

// ============================================================
// 子组件：MenuButton（菜单项按钮）
// ============================================================

interface MenuButtonProps {
  /** 菜单文案 */
  label: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 父级菜单是否展开 */
  isOpen: boolean;
  /** 在菜单中的索引（用于 stagger 延迟） */
  index: number;
}

/**
 * 菜单项按钮 - 字符级 stagger 上推动画
 *
 * 交互机制：
 *   - hover 时每个字符向上平移 50%（露出第二份字符副本），形成"上推切换"效果
 *   - 字符按索引 stagger 延迟（30ms * i），形成波浪式过渡
 *   - animatingRef 锁定动画进行中的 hover 状态，pendingLeaveRef 缓存离开事件
 *     避免快速移动鼠标导致的动画抖动
 *
 * @param props - 见 MenuButtonProps
 */
function MenuButton({ label, onClick, isOpen, index }: MenuButtonProps) {
  const [hovered, setHovered] = useState(false);
  const animatingRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const chars = label.split('');
  // 锁定时长 = 字符数 * 单字符延迟 + 基础锁定，确保动画完成后才允许状态切换
  const lockDuration = TIMINGS.charStagger * chars.length + TIMINGS.charLockBase;

  const handleEnter = useCallback(() => {
    pendingLeaveRef.current = false;
    if (hovered) return;
    setHovered(true);
    animatingRef.current = true;
    setTimeout(() => {
      animatingRef.current = false;
      // 动画完成后处理缓存的 leave 事件
      if (pendingLeaveRef.current) {
        pendingLeaveRef.current = false;
        setHovered(false);
      }
    }, lockDuration);
  }, [hovered, lockDuration]);

  const handleLeave = useCallback(() => {
    // 动画进行中：缓存 leave 事件，等动画完成后处理
    if (animatingRef.current) {
      pendingLeaveRef.current = true;
    } else {
      setHovered(false);
    }
  }, []);

  // 按钮 inline style（原 Tailwind: text-[#f7f1ed] text-[24px] uppercase leading-none overflow-hidden）
  const buttonStyle: CSSProperties = {
    color: COLORS.textLight,
    fontSize: '24px',
    textTransform: 'uppercase',
    lineHeight: 1,
    overflow: 'hidden',
    fontFamily: FONTS.menu,
    letterSpacing: '-0.03em',
    height: '1em',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
  };

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={buttonStyle}
      animate={{ opacity: isOpen ? 1 : 0 }}
      transition={{
        duration: TIMINGS.itemFade,
        delay: isOpen ? TIMINGS.itemFadeBase + TIMINGS.itemStagger * index : 0,
        ease: EASE,
      }}
    >
      {/* 原 Tailwind: flex justify-center */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {chars.map((char, i) => (
          // 原 Tailwind: inline-block overflow-hidden
          <span
            key={i}
            style={{ display: 'inline-block', overflow: 'hidden', height: '1em' }}
          >
            {/* 原 Tailwind: flex flex-col */}
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                transitionProperty: 'transform',
                transitionDuration: hovered ? `${TIMINGS.charHover}ms` : '0ms',
                transitionDelay: hovered ? `${TIMINGS.charStagger * i}ms` : '0ms',
                transform: hovered ? 'translateY(-50%)' : 'translateY(0%)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* 第一份字符：默认可见（原 Tailwind: block） */}
              <span style={{ display: 'block', height: '1em', lineHeight: '1em' }}>
                {char}
              </span>
              {/* 第二份字符：hover 时从下方上推进入（原 Tailwind: block） */}
              <span
                style={{ display: 'block', height: '1em', lineHeight: '1em' }}
                aria-hidden
              >
                {char}
              </span>
            </span>
          </span>
        ))}
      </div>
    </motion.button>
  );
}

// ============================================================
// 主组件：FloatingMenu
// ============================================================

/**
 * Liquid Morph Floating Menu - 液态变形浮动菜单
 *
 * 视觉行为：
 *   1. 关闭态：黄色胶囊（150×48, radius 72），底部显示 "Menu" + 汉堡图标
 *   2. 点击展开：变形为黄色圆角矩形（280×260, radius 32），
 *      深色圆形从底部 -200% 上升至 -20%，覆盖黄色背景
 *   3. 菜单项按 stagger 渐显（0.4s + 0.08s * index 延迟）
 *   4. 字符 hover 时上推 50%，露出副本字符，stagger 30ms/字符
 *   5. 再次点击底部 bar 或外部点击：反向变形回胶囊
 *
 * 定位说明：
 *   - 原组件使用 `position: fixed; bottom: 2.5rem; left: 50%`，相对视口底部居中
 *   - 在预览/沙箱场景下，若祖先有 transform，fixed 会相对该祖先定位
 *
 * @param props - 见 FloatingMenuProps
 * @returns 浮动菜单 JSX
 */
export default function FloatingMenu({ items, menuLabel = 'Menu' }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = items ?? [
    { label: 'Home' },
    { label: 'Works' },
    { label: 'Contact' },
  ];

  // 外部点击关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // 外层容器 inline style（原 Tailwind: fixed bottom-10 left-1/2 z-[100]）
  const outerStyle: CSSProperties = {
    position: 'fixed',
    bottom: '2.5rem',
    left: '50%',
    zIndex: 100,
    x: '-50%',
    pointerEvents: 'auto',
  };

  // 内层容器 inline style（原 Tailwind: relative overflow-hidden flex flex-col）
  const innerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONTS.ui,
    letterSpacing: '-0.02em',
    cursor: isOpen ? 'default' : 'pointer',
  };

  // 黄色背景层 inline style（原 Tailwind: absolute inset-0）
  const bgLayerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 'inherit',
  };

  // 深色圆形 inline style（原 Tailwind: absolute left-1/2 bg-[#242424]）
  const darkLayerStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    width: '200%',
    height: '200%',
    borderRadius: '50%',
    backgroundColor: COLORS.darkLayer,
    x: '-50%',
  };

  // 菜单项容器 inline style（原 Tailwind: relative z-10 flex flex-col gap-6 items-center justify-center）
  const menuListStyle: CSSProperties = {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: isOpen ? 'auto' : 'none',
    opacity: isOpen ? 1 : 0,
    flex: isOpen ? 1 : 0,
    overflow: 'hidden',
  };

  // 底部 bar inline style（原 Tailwind: relative z-10 flex items-center justify-between w-full shrink-0 cursor-pointer）
  const barStyle: CSSProperties = {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexShrink: 0,
    cursor: 'pointer',
  };

  // 汉堡图标容器 inline style（原 Tailwind: relative w-[24px] h-[24px] flex items-center justify-center）
  const hamburgerWrapStyle: CSSProperties = {
    position: 'relative',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // 汉堡线 inline style（原 Tailwind: absolute block w-[18px] h-[2px] rounded-full）
  const hamburgerLineStyle: CSSProperties = {
    position: 'absolute',
    display: 'block',
    width: '18px',
    height: '2px',
    borderRadius: '9999px',
  };

  return (
    <motion.div
      ref={containerRef}
      style={outerStyle}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <motion.div
        style={innerStyle}
        onClick={() => {
          if (!isOpen) setIsOpen(true);
        }}
        animate={{
          width: isOpen ? DIMENSIONS.openWidth : DIMENSIONS.closedWidth,
          height: isOpen ? DIMENSIONS.openHeight : DIMENSIONS.closedHeight,
          borderRadius: isOpen ? DIMENSIONS.openRadius : DIMENSIONS.closedRadius,
          scale: 1,
        }}
        whileHover={isOpen ? undefined : { scale: 1.05 }}
        transition={{
          duration: TIMINGS.morph,
          ease: EASE,
          height: { duration: isOpen ? TIMINGS.morph : TIMINGS.closeHeight },
          scale: { duration: TIMINGS.scale, ease: EASE },
        }}
      >
        {/* 黄色背景层 + 描边 */}
        <motion.div
          style={bgLayerStyle}
          animate={{
            backgroundColor: COLORS.bgClosed,
            borderColor: isOpen ? COLORS.bgClosed : COLORS.borderClosed,
          }}
          transition={{ duration: isOpen ? 0.1 : 0.3, ease: EASE }}
        />

        {/* 深色圆形从底部上升覆盖 */}
        <motion.div
          style={darkLayerStyle}
          animate={{ bottom: isOpen ? '-20%' : '-200%' }}
          transition={{
            duration: TIMINGS.morph,
            ease: EASE,
            delay: isOpen ? 0.1 : 0,
          }}
        />

        {/* 菜单项列表 */}
        <div style={menuListStyle}>
          {menuItems.map((item, idx) => (
            <MenuButton
              key={item.label}
              label={item.label}
              onClick={item.onClick}
              isOpen={isOpen}
              index={idx}
            />
          ))}
        </div>

        {/* 底部 bar：触发文案 + 汉堡/关闭图标 */}
        <motion.div
          style={barStyle}
          onClick={() => setIsOpen(!isOpen)}
          animate={{
            paddingLeft: isOpen ? 24 : 20,
            paddingRight: isOpen ? 24 : 20,
            paddingBottom: isOpen ? 24 : 0,
            height: DIMENSIONS.barHeight,
          }}
          transition={{ duration: TIMINGS.morph, ease: EASE }}
        >
          {/* 原 Tailwind: text-[14px] md:text-[20px] leading-none */}
          <motion.span
            style={{ fontSize: '20px', lineHeight: 1 }}
            animate={{ color: isOpen ? COLORS.textLight : COLORS.textDark }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {menuLabel}
          </motion.span>

          {/* 汉堡/关闭图标（两条线变形为 X） */}
          <div style={hamburgerWrapStyle}>
            <motion.span
              style={hamburgerLineStyle}
              animate={{
                rotate: isOpen ? 45 : 0,
                y: isOpen ? 0 : -3,
                backgroundColor: isOpen ? COLORS.textLight : COLORS.textDark,
              }}
              transition={{ duration: 0.4, ease: EASE }}
            />
            <motion.span
              style={hamburgerLineStyle}
              animate={{
                rotate: isOpen ? -45 : 0,
                y: isOpen ? 0 : 3,
                backgroundColor: isOpen ? COLORS.textLight : COLORS.textDark,
              }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
