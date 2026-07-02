/**
 * Modern Login & Signup
 *
 * 来源：21st.dev
 * 原作者：Muhammad Asif
 * 原始 URL：https://21st.dev/@pulseawan/components/modern-login-signup
 * 入库日期：2026-07-02
 *
 * 实现说明：
 *   本组件源码通过 `npx shadcn@latest add` 从 21st.dev registry 获取（非 fetch-source.ts 抓取，
 *   因 21st.dev 渲染后 DOM 不含 Three.js shader 逻辑）。
 *
 * 核心技术：
 *   - Three.js ShaderMaterial + GLSL3 实现 2D 点阵呼吸/波纹扩散动画
 *   - OrthographicCamera + PlaneGeometry(2,2) 全屏覆盖，fragment shader 内做点阵布局
 *   - 点阵每个单元格根据 random() + u_time 闪烁，从中心向外波纹扩散
 *   - CustomBlending（SrcAlpha + One）实现叠加发光效果
 *   - 登录/注册双态切换（isLogin state）
 *
 * 改造点（相对原 21st.dev 源码）：
 *   - 移除 "use client" 指令（本项目是 Vite，非 Next.js）
 *   - 动态 <script> 加载 Three.js 改为 ESM import（本项目已装 three 包，更干净）
 *   - 硬编码文案提取为 Props（avatarText/title/subtitle 等）
 *   - 类型从 any 收窄为 THREE.WebGLRenderer / ShaderMaterial 等
 *   - 加文件头注释 + JSDoc
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';

// ============================================================
// Props 类型定义
// ============================================================

/** 三方登录供应商配置 */
export interface AuthProvider {
  /** 按钮文案，如 "Continue with Google" */
  label: string;
  /** SVG 图标（ReactNode，建议 16x16） */
  icon: ReactNode;
  /** 点击回调 */
  onClick?: () => void;
}

export interface ModernLoginSignupProps {
  /** 头像文字（圆形头像内的字符），默认 "JS" */
  avatarText?: string;
  /** 登录态主标题，默认 "Sign in to Account" */
  loginTitle?: string;
  /** 登录态副标题，默认 "Sign in to your Account." */
  loginSubtitle?: string;
  /** 注册态主标题，默认 "Sign up for Account" */
  signupTitle?: string;
  /** 注册态副标题，默认 "Create a new account to get started." */
  signupSubtitle?: string;
  /** 邮箱输入框占位符 */
  emailPlaceholder?: string;
  /** 注册态姓名输入框占位符，默认 "Full Name" */
  namePlaceholder?: string;
  /** 登录态继续按钮文案，默认 "Continue with Email" */
  loginButtonText?: string;
  /** 注册态提交按钮文案，默认 "Sign Up with Email" */
  signupButtonText?: string;
  /** 登录态三方供应商列表，默认 Google/GitHub/Apple + "Continue with" 前缀 */
  loginProviders?: AuthProvider[];
  /** 注册态三方供应商列表，默认 Google/GitHub/Apple + "Sign up with" 前缀 */
  signupProviders?: AuthProvider[];
  /** 登录态切换文案前半段，默认 "Don't have an account?" */
  loginSwitchPrompt?: string;
  /** 登录态切换按钮文案，默认 "Sign Up" */
  loginSwitchAction?: string;
  /** 注册态切换文案前半段，默认 "Already have an account?" */
  signupSwitchPrompt?: string;
  /** 注册态切换按钮文案，默认 "Sign In" */
  signupSwitchAction?: string;
  /** 服务条款文案 */
  termsText?: ReactNode;
  /** 登录表单提交回调 */
  onLoginSubmit?: (email: string) => void;
  /** 注册表单提交回调 */
  onSignupSubmit?: (name: string, email: string) => void;
}

// ============================================================
// 默认供应商图标（保留原 SVG path）
// ============================================================

const GoogleIcon = (
  <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GitHubIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

const AppleIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.59-.76 1.56.04 2.88.75 3.65 1.89-3.08 1.75-2.58 5.61.35 6.75-1.01 2.37-2.39 4.39-4.29 4.29zM12.03 7.25c-.15-2.23 1.66-4.07 3.72-4.25.36 2.38-1.92 4.34-3.72 4.25z" />
  </svg>
);

/** 默认登录态供应商（文案 "Continue with X"） */
const DEFAULT_LOGIN_PROVIDERS: AuthProvider[] = [
  { label: 'Continue with Google', icon: GoogleIcon },
  { label: 'Continue with GitHub', icon: GitHubIcon },
  { label: 'Continue with Apple', icon: AppleIcon },
];

/** 默认注册态供应商（文案 "Sign up with X"） */
const DEFAULT_SIGNUP_PROVIDERS: AuthProvider[] = [
  { label: 'Sign up with Google', icon: GoogleIcon },
  { label: 'Sign up with GitHub', icon: GitHubIcon },
  { label: 'Sign up with Apple', icon: AppleIcon },
];

// ============================================================
// Shader 代码（原样保留，这是组件灵魂）
// ============================================================

/**
 * Vertex shader：全屏覆盖 quad，把 position 映射到 fragCoord（像素坐标）
 */
const VERTEX_SHADER = `
  precision mediump float;
  uniform vec2 u_resolution;
  out vec2 fragCoord;
  void main() {
    gl_Position = vec4(position, 1.0);
    fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
    fragCoord.y = u_resolution.y - fragCoord.y;
  }
`;

/**
 * Fragment shader：点阵网格 + 随机闪烁 + 中心波纹扩散
 *
 * 算法要点：
 *   1. 把屏幕坐标按 u_total_size 划分为网格单元
 *   2. 每个单元用 random(st2) 算一个 [0,1) 随机数 show_offset
 *   3. 用 u_time / frequency + show_offset 决定当前显示哪个 opacity 档位
 *   4. 用 dist_from_center 计算从屏幕中心到单元的距离，作为动画起播延迟
 *   5. step(current_timing_offset, u_time * speed) 实现从中心向外的波纹扩散
 */
const FRAGMENT_SHADER = `
  precision mediump float;
  in vec2 fragCoord;

  uniform float u_time;
  uniform float u_opacities[10];
  uniform vec3 u_colors[6];
  uniform float u_total_size;
  uniform float u_dot_size;
  uniform vec2 u_resolution;
  uniform int u_reverse;

  out vec4 fragColor;

  float PHI = 1.61803398874989484820459;
  float random(vec2 xy) {
      return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
  }

  void main() {
      vec2 st = fragCoord.xy;
      st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
      st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

      float opacity = step(0.0, st.x) * step(0.0, st.y);

      vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

      float frequency = 5.0;
      float show_offset = random(st2);
      float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
      opacity *= u_opacities[int(rand * 10.0)];
      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
      opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

      vec3 color = u_colors[int(show_offset * 6.0)];

      float animation_speed_factor = 3.0;
      vec2 center_grid = u_resolution / 2.0 / u_total_size;
      float dist_from_center = distance(center_grid, st2);

      float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

      float current_timing_offset = timing_offset_intro;
      opacity *= step(current_timing_offset, u_time * animation_speed_factor);
      opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

      fragColor = vec4(color, opacity);
      fragColor.rgb *= fragColor.a;
  }
`;

// ============================================================
// Three.js 点阵动画 Hook
// ============================================================

/**
 * 在 canvas 上挂载 Three.js 点阵呼吸/波纹扩散动画。
 *
 * 实现说明：
 *   - 用 OrthographicCamera + PlaneGeometry(2,2) 全屏覆盖，shader 内做所有绘制
 *   - uniforms.u_time 每帧更新，驱动点阵闪烁与波纹扩散
 *   - 用 CustomBlending（SrcAlpha + One）实现叠加发光，点阵重叠处更亮
 *
 * @param canvasRef - canvas DOM 的 ref 对象
 */
function useDotMatrixAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // canvas 通过 CSS（position: absolute; inset: 0）填满父容器
    // 此处用父容器尺寸而非 window.innerWidth/innerHeight，使组件能适配任意尺寸容器
    // （卡片预览、详情页、沙箱校验等场景的容器尺寸各不相同）
    const parent = canvas.parentElement;
    if (!parent) return;

    const getWidth = () => parent.clientWidth;
    const getHeight = () => parent.clientHeight;

    // 渲染器：alpha 透明背景，让 CSS 黑底透出
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(getWidth(), getHeight());

    // 正交相机：full-screen quad，z 轴无意义
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // uniforms：控制点阵尺寸、颜色、透明度档位、时间
    // u_resolution 用 canvas 实际像素尺寸（clientWidth * 2 保持与原实现一致的高分辨率采样）
    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(getWidth() * 2, getHeight() * 2) },
      u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0] },
      u_colors: { value: [
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, 1),
      ] },
      u_total_size: { value: 20.0 },
      u_dot_size: { value: 6.0 },
      u_reverse: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 动画循环：每帧更新 u_time
    const startTime = performance.now();
    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      uniforms.u_time.value = (performance.now() - startTime) / 1000.0;
      renderer.render(scene, camera);
    };
    animate();

    // 父容器尺寸响应：用 ResizeObserver 监听父容器，替代原 window resize
    // 这样在卡片预览缩放、详情页 resize、沙箱截图等场景都能正确更新 canvas 尺寸
    const handleResize = () => {
      const w = getWidth();
      const h = getHeight();
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w * 2, h * 2);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);

    // 清理：停止动画、移除监听、释放 WebGL 资源
    return () => {
      cancelAnimationFrame(animationId);
      ro.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [canvasRef]);
}

// ============================================================
// 主组件
// ============================================================

export default function ModernLoginSignup({
  avatarText = 'JS',
  loginTitle = 'Sign in to Account',
  loginSubtitle = 'Sign in to your Account.',
  signupTitle = 'Sign up for Account',
  signupSubtitle = 'Create a new account to get started.',
  emailPlaceholder = 'name@work-email.com',
  namePlaceholder = 'Full Name',
  loginButtonText = 'Continue with Email',
  signupButtonText = 'Sign Up with Email',
  loginProviders = DEFAULT_LOGIN_PROVIDERS,
  signupProviders = DEFAULT_SIGNUP_PROVIDERS,
  loginSwitchPrompt = "Don't have an account?",
  loginSwitchAction = 'Sign Up',
  signupSwitchPrompt = 'Already have an account?',
  signupSwitchAction = 'Sign In',
  termsText = (
    <>
      By proceeding, you agree to creating a Vercel account
      <br />
      subject to our{' '}
      <a href="#" style={{ color: '#888' }}>
        Terms of Service
      </a>{' '}
      and{' '}
      <a href="#" style={{ color: '#888' }}>
        Privacy Policy
      </a>
      .
    </>
  ),
  onLoginSubmit,
  onSignupSubmit,
}: ModernLoginSignupProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useDotMatrixAnimation(canvasRef);

  // 共享样式
  const socialBtn: CSSProperties = {
    width: '100%',
    padding: '0.65rem',
    borderRadius: 6,
    border: '1px solid #333',
    background: 'transparent',
    color: '#fff',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '0.4rem',
  };
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#000',
    color: '#fff',
    fontSize: '0.875rem',
    outline: 'none',
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSubmit?.(email);
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignupSubmit?.(name, email);
  };

  // 头像组件（避免重复定义）
  const Logo = (
    <div
      style={{
        background: '#111',
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '1.15rem',
        marginBottom: '0.75rem',
        border: '1px solid #333',
      }}
    >
      {avatarText}
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#000',
        color: '#fff',
        fontFamily: "'Inter',-apple-system,sans-serif",
      }}
    >
      {/* WebGL 点阵 canvas（ShaderMaterial 全屏覆盖） */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* 径向渐变遮罩：聚焦中央卡片 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: 'radial-gradient(circle at center,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 登录/注册卡片 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: '#121212',
          borderRadius: 12,
          padding: '2rem',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '1px solid #222',
        }}
      >
        {isLogin ? (
          /* 登录态 */
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {Logo}
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 600,
                marginBottom: '0.25rem',
                letterSpacing: '-0.025em',
              }}
            >
              {loginTitle}
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.85rem', lineHeight: 1.5 }}>
              {loginSubtitle}
            </p>

            <form onSubmit={handleLoginSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                style={inputStyle}
                type="email"
                placeholder={emailPlaceholder}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ededed',
                  color: '#000',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {loginButtonText}
              </button>
            </form>

            <div style={{ height: 1, background: '#222', width: '100%', margin: '0.85rem 0' }} />

            {loginProviders.map((provider, idx) => (
              <button
                key={idx}
                onClick={provider.onClick}
                style={idx === loginProviders.length - 1 ? { ...socialBtn, marginBottom: 0 } : socialBtn}
              >
                {provider.icon}
                {provider.label}
              </button>
            ))}

            <div style={{ marginTop: '1.25rem', fontSize: '0.875rem', color: '#888' }}>
              {loginSwitchPrompt}{' '}
              <button
                onClick={() => setIsLogin(false)}
                style={{
                  color: '#fff',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                {loginSwitchAction}
              </button>
            </div>
            <div style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#666', lineHeight: 1.5, textAlign: 'center' }}>
              {termsText}
            </div>
          </div>
        ) : (
          /* 注册态 */
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {Logo}
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 600,
                marginBottom: '0.25rem',
                letterSpacing: '-0.025em',
              }}
            >
              {signupTitle}
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.85rem', lineHeight: 1.5 }}>
              {signupSubtitle}
            </p>

            <form onSubmit={handleSignupSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                style={inputStyle}
                type="text"
                placeholder={namePlaceholder}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                style={inputStyle}
                type="email"
                placeholder={emailPlaceholder}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ededed',
                  color: '#000',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {signupButtonText}
              </button>
            </form>

            <div style={{ height: 1, background: '#222', width: '100%', margin: '0.85rem 0' }} />

            {signupProviders.map((provider, idx) => (
              <button
                key={idx}
                onClick={provider.onClick}
                style={idx === signupProviders.length - 1 ? { ...socialBtn, marginBottom: 0 } : socialBtn}
              >
                {provider.icon}
                {provider.label}
              </button>
            ))}

            <div style={{ marginTop: '1.25rem', fontSize: '0.875rem', color: '#888' }}>
              {signupSwitchPrompt}{' '}
              <button
                onClick={() => setIsLogin(true)}
                style={{
                  color: '#fff',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                {signupSwitchAction}
              </button>
            </div>
            <div style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#666', lineHeight: 1.5, textAlign: 'center' }}>
              {termsText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
