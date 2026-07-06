/**
 * MagicDust - 粒子聚合着色器动画组件
 *
 * 来源：https://21st.dev/@uithefactory/components/magic-dust-shader
 * 作者：UI Factory
 * 入库日期：2026-07-04
 *
 * 实现说明：
 *   基于 React Three Fiber 的粒子系统。大量粒子（默认 10000）在三维空间中
 *   循环切换三种状态：聚合为目标形状（文字/几何体）→ 保持 → 解构散开 → 切换下一个目标。
 *   通过 Canvas 2D 采样将文字光栅化为像素点坐标，让粒子聚合形成文字。
 *   自定义 GLSL 着色器控制粒子的位置插值（cubic ease）、点尺寸、透明度淡入。
 *   每个粒子带独立 delay，沿 X 轴有序聚合，营造"扫描式"成形动效。
 *
 * 入库适配修复（相对原始源码）：
 *   1. Canvas 添加 gl={{ alpha: false, preserveDrawingBuffer: true }}
 *      —— alpha:false 让 canvas 不透明（黑底），AdditiveBlending 粒子叠加可见；
 *         alpha:true（默认）下 AdditiveBlending 在透明背景上合成结果异常，粒子不可见。
 *      —— preserveDrawingBuffer:true 保证截图工具能捕获渲染结果（G2 校验必需）。
 *   2. uSize 计算 window.innerWidth → state.size.width
 *      —— 沙箱/iframe/卡片缩略图中 canvas 尺寸 ≠ window 视口尺寸，用 R3F 内部 size 才准确。
 *   3. <points frustumCulled={false}>
 *      —— 粒子目标位置随 sequence 切换动态变化，boundingSphere 仅按 position 属性（散开云团）计算，
 *         聚合后粒子可能汇聚到 boundingSphere 之外被视锥剔除，导致整个 Points 对象不可见。
 */

import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

/** 序列项：文字或几何体 */
export type SequenceItem =
  | { type: 'text'; text: string; offset?: [number, number, number] }
  | { type: 'shape'; shape: 'torus' | 'sphere' | 'box'; offset?: [number, number, number] };

/** MagicDust 组件 Props */
export interface MagicDustProps {
  /** 循环切换的文字与几何体序列 */
  sequence?: SequenceItem[];
  /** 粒子数量 */
  particleCount?: number;
  /** 粒子基色（HEX） */
  particleColor?: string;
  /** 粒子基础尺寸 */
  particleSize?: number;
  /** 文字字体族 */
  fontFamily?: string;
  /** 形状保持时长（秒）后开始解构 */
  holdDuration?: number;
  /** 聚合/解构动画速度倍率 */
  animationSpeed?: number;
  /** 粒子完全散开时的云团半径 */
  scatterRadius?: number;
}

/** 默认序列：文字与几何体交替 */
const DEFAULT_SEQUENCE: SequenceItem[] = [
  { type: 'text', text: 'MAGIC', offset: [0, 0, 0] },
  { type: 'shape', shape: 'torus', offset: [0, 0, 0] },
  { type: 'text', text: 'DUST', offset: [0, 0, 0] },
  { type: 'shape', shape: 'sphere', offset: [0, 0, 0] },
  { type: 'text', text: 'UI FACTORY', offset: [0, 0, 0] },
  { type: 'shape', shape: 'box', offset: [0, 0, 0] },
];

/** 单个目标的预计算数据：目标位置、延迟、是否文字 */
interface TargetData {
  dest: Float32Array;
  delays: Float32Array;
  isText: boolean;
}

/** 动画阶段 */
type Phase = 'CONSTRUCTING' | 'HOLDING' | 'DECONSTRUCTING';

/**
 * 生成球壳内均匀分布的散开位置（粒子完全解构时的云团）
 * @param count 粒子数
 * @param radius 云团半径
 * @returns Float32Array[count*3]，每 3 个元素为一个粒子的 xyz
 */
function getScatteredPositions(count: number, radius: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    // cbrt 让粒子在球体内均匀分布（体积均匀），而非聚在中心
    const r = Math.cbrt(Math.random()) * radius;

    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  return pos;
}

/**
 * 将文字光栅化为粒子目标位置：用 Canvas 2D 绘制文字，扫描像素亮度，
 * 取白色像素作为采样点，粒子随机映射到这些点上形成文字轮廓。
 * @param text 文字内容
 * @param count 粒子数
 * @param size 文字在 3D 空间的尺寸
 * @param fontFamily 字体族
 * @returns Float32Array[count*3]
 */
function getTextPositions(
  text: string,
  count: number,
  size: number,
  fontFamily: string,
): Float32Array {
  // SSR 保护：服务端无 document，返回空数组（实际渲染仅在 Canvas 内，必为客户端）
  if (typeof window === 'undefined') return new Float32Array(count * 3);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Float32Array(count * 3);

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 自适应字号：文字过宽时缩小，保证不超过画布 900px 宽
  let fontSize = 220;
  ctx.font = `900 ${fontSize}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;

  if (textWidth > 900) {
    fontSize = Math.floor(fontSize * (900 / textWidth));
    ctx.font = `900 ${fontSize}px ${fontFamily}`;
  }

  ctx.fillText(text, 512, 512);

  const imgData = ctx.getImageData(0, 0, 1024, 1024).data;
  const points: { x: number; y: number }[] = [];

  // 扫描像素，白色（r>128）的像素作为采样点
  for (let i = 0; i < 1024 * 1024; i++) {
    const r = imgData[i * 4];
    if (r > 128) {
      const x = i % 1024;
      const y = Math.floor(i / 1024);
      points.push({ x: (x / 1024 - 0.5) * size, y: -(y / 1024 - 0.5) * size });
    }
  }

  const positions = new Float32Array(count * 3);
  if (points.length === 0) return positions;

  // 粒子随机映射到采样点，并加微小抖动避免完全重合
  for (let i = 0; i < count; i++) {
    const p = points[Math.floor(Math.random() * points.length)];
    positions[i * 3] = p.x + (Math.random() - 0.5) * 0.15;
    positions[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.15;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }
  return positions;
}

/**
 * 生成圆环面（torus）表面的粒子位置
 * @param count 粒子数
 * @param scale 整体缩放
 * @returns Float32Array[count*3]
 */
function getTorusPositions(count: number, scale: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const radius = 2.5;
    const tube = 1.0;
    const x = (radius + tube * Math.cos(v)) * Math.cos(u);
    const y = (radius + tube * Math.cos(v)) * Math.sin(u);
    const z = tube * Math.sin(v);
    pos[i * 3] = x * scale + (Math.random() - 0.5) * 0.3;
    pos[i * 3 + 1] = y * scale + (Math.random() - 0.5) * 0.3;
    pos[i * 3 + 2] = z * scale + (Math.random() - 0.5) * 0.3;
  }
  return pos;
}

/**
 * 生成球面上的粒子位置
 * @param count 粒子数
 * @param radius 球半径
 * @returns Float32Array[count*3]
 */
function getSphereDestinations(count: number, radius: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta) + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 2] = radius * Math.cos(phi) + (Math.random() - 0.5) * 0.2;
  }
  return pos;
}

/**
 * 生成立方体六面表面的粒子位置
 * @param count 粒子数
 * @param size 立方体边长
 * @returns Float32Array[count*3]
 */
function getBoxPositions(count: number, size: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const face = Math.floor(Math.random() * 6);
    let x = 0,
      y = 0,
      z = 0;
    const u = (Math.random() - 0.5) * size;
    const v = (Math.random() - 0.5) * size;
    const s = size / 2;
    if (face === 0) {
      x = s;
      y = u;
      z = v;
    } else if (face === 1) {
      x = -s;
      y = u;
      z = v;
    } else if (face === 2) {
      x = u;
      y = s;
      z = v;
    } else if (face === 3) {
      x = u;
      y = -s;
      z = v;
    } else if (face === 4) {
      x = u;
      y = v;
      z = s;
    } else {
      x = u;
      y = v;
      z = -s;
    }

    pos[i * 3] = x + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
  }
  return pos;
}

/**
 * 给目标位置数组整体加偏移（支持 sequence item 的 offset 配置）
 * @param dest 原始目标位置
 * @param dx X 偏移
 * @param dy Y 偏移
 * @param dz Z 偏移（默认 0）
 * @returns 偏移后的新数组（不修改原数组）
 */
function applyOffset(dest: Float32Array, dx: number, dy: number, dz: number = 0): Float32Array {
  const out = new Float32Array(dest.length);
  for (let i = 0; i < dest.length; i += 3) {
    out[i] = dest[i] + dx;
    out[i + 1] = dest[i + 1] + dy;
    out[i + 2] = dest[i + 2] + dz;
  }
  return out;
}

/**
 * 计算每个粒子的聚合延迟：按 X 坐标归一化映射到 [0,1]，
 * 让粒子沿 X 轴有序聚合（左→右扫描式成形），叠加少量随机避免过于规整。
 * @param targetPositions 目标位置
 * @param count 粒子数
 * @returns Float32Array[count]，每个粒子的延迟值
 */
function getOrderedDelays(targetPositions: Float32Array, count: number): Float32Array {
  const delays = new Float32Array(count);
  let minX = Infinity;
  let maxX = -Infinity;

  for (let i = 0; i < count; i++) {
    const x = targetPositions[i * 3];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const range = maxX - minX === 0 ? 1 : maxX - minX;

  for (let i = 0; i < count; i++) {
    const x = targetPositions[i * 3];
    const normalizedX = (x - minX) / range;
    delays[i] = normalizedX * 0.7 + Math.random() * 0.3;
  }
  return delays;
}

/**
 * 顶点着色器：根据 uProgress 与每粒子的 aDelay 插值 position→aTarget，
 * 使用 cubic ease 缓动；gl_PointSize 随距离衰减模拟透视。
 */
const vertexShader = `
attribute vec3 aTarget;
attribute float aDelay;
attribute float aSize;
uniform float uProgress;
uniform float uSize;
varying float vAlpha;

void main() {
    float p = clamp((uProgress - aDelay) * 3.0, 0.0, 1.0);

    float ease = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;

    vec3 finalPos = mix(position, aTarget, ease);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = uSize * aSize * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vAlpha = smoothstep(0.0, 0.2, p);
}
`;

/**
 * 片元着色器：将点渲染为圆形（discard 圆外像素）+ 软边缘，
 * 叠加 vAlpha 控制聚合时的淡入；AdditiveBlending 让粒子叠加发光。
 */
const fragmentShader = `
uniform vec3 uColor;
varying float vAlpha;

void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;

    float alpha = 1.0 - smoothstep(0.7, 1.0, r);
    gl_FragColor = vec4(uColor, alpha * vAlpha * 0.5);
}
`;

/**
 * MagicDustCore - 粒子聚合动画核心（须在 Canvas 内渲染）
 *
 * 三阶段状态机：CONSTRUCTING（聚合）→ HOLDING（保持）→ DECONSTRUCTING（解构）→ 循环。
 * 解构完成后切换到下一个 target，更新 aTarget/aDelay 属性触发新一轮聚合。
 *
 * @param sequence 文字/几何体序列
 * @param particleCount 粒子数
 * @param particleColor 粒子色
 * @param particleSize 粒子尺寸
 * @param fontFamily 文字字体
 * @param holdDuration 保持时长
 * @param animationSpeed 动画速度倍率
 * @param scatterRadius 散开云团半径
 */
export function MagicDustCore({
  sequence = DEFAULT_SEQUENCE,
  particleCount = 10000,
  particleColor = '#ffffff',
  particleSize = 0.02,
  fontFamily = 'sans-serif',
  holdDuration = 3.0,
  animationSpeed = 1.0,
  scatterRadius = 12,
}: MagicDustProps) {
  // 粒子颜色对象（仅初始化时同步，运行时改 particleColor 不会更新）
  const colorObj = useState(() => new THREE.Color(particleColor))[0];

  // 预计算所有 target 的位置/延迟/类型（懒初始化，仅一次）
  const [{ origin, targets, sizes }] = useState(() => {
    const origin = getScatteredPositions(particleCount, scatterRadius);

    const sizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      sizes[i] = Math.random() * 0.8 + 0.4;
    }

    const targets: TargetData[] = [];

    for (const item of sequence) {
      let dest: Float32Array;
      let isText = false;

      if (item.type === 'text') {
        dest = getTextPositions(item.text, particleCount, 12, fontFamily);
        isText = true;
      } else {
        if (item.shape === 'torus') dest = getTorusPositions(particleCount, 2.0);
        else if (item.shape === 'sphere') dest = getSphereDestinations(particleCount, 4);
        else dest = getBoxPositions(particleCount, 5);
      }

      if (item.offset) {
        dest = applyOffset(dest, item.offset[0], item.offset[1], item.offset[2]);
      }

      targets.push({ dest, delays: getOrderedDelays(dest, particleCount), isText });
    }

    return { origin, targets, sizes };
  });

  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const pointsGroupRef = useRef<THREE.Points>(null);

  const currentProgress = useRef(0);
  const targetProgress = useRef(0);
  const currentTargetIndex = useRef(0);

  const phase = useRef<Phase>('CONSTRUCTING');
  const timer = useRef(0);

  useFrame((state, delta) => {
    if (phase.current === 'CONSTRUCTING') {
      targetProgress.current = Math.min(1.5, targetProgress.current + delta * 0.4 * animationSpeed);
      if (targetProgress.current === 1.5) {
        phase.current = 'HOLDING';
        timer.current = 0;
      }
    } else if (phase.current === 'HOLDING') {
      timer.current += delta;
      if (timer.current > holdDuration) {
        phase.current = 'DECONSTRUCTING';
      }
    } else if (phase.current === 'DECONSTRUCTING') {
      targetProgress.current = Math.max(0.0, targetProgress.current - delta * 0.6 * animationSpeed);
      if (targetProgress.current === 0.0) {
        const nextTarget = (currentTargetIndex.current + 1) % targets.length;
        currentTargetIndex.current = nextTarget;

        if (geoRef.current) {
          const targetData = targets[nextTarget];
          const targetAttr = geoRef.current.attributes.aTarget as THREE.BufferAttribute;
          const delayAttr = geoRef.current.attributes.aDelay as THREE.BufferAttribute;

          targetAttr.array.set(targetData.dest);
          targetAttr.needsUpdate = true;

          delayAttr.array.set(targetData.delays);
          delayAttr.needsUpdate = true;
        }

        phase.current = 'CONSTRUCTING';
      }
    }

    currentProgress.current += (targetProgress.current - currentProgress.current) * 0.1;

    if (matRef.current) {
      matRef.current.uniforms.uProgress.value = currentProgress.current;
      // 修复：用 R3F 的 state.size（canvas 实际尺寸）而非 window.innerWidth
      // 沙箱/iframe/卡片缩略图中 canvas 尺寸 ≠ window 视口尺寸
      const refSize = Math.min(state.size.width, state.size.height);
      matRef.current.uniforms.uSize.value = Math.max(1, refSize * particleSize);
    }

    if (pointsGroupRef.current) {
      // 响应式：保证组件不超出视口（基于 3D 单位与视口宽度的比例缩放）
      const maxComponentWidth = 15.0;
      const scale = Math.min(1.0, state.viewport.width / maxComponentWidth);
      pointsGroupRef.current.scale.set(scale, scale, scale);

      const currentTarget = targets[currentTargetIndex.current];
      const currentY = pointsGroupRef.current.rotation.y;

      if (currentTarget.isText) {
        // 文字保持正面朝向（吸附到最近的 2π 整数倍）
        const targetY = Math.round(currentY / (Math.PI * 2)) * (Math.PI * 2);
        pointsGroupRef.current.rotation.y += (targetY - currentY) * 0.08;
      } else {
        // 几何体持续旋转展示立体感
        pointsGroupRef.current.rotation.y += delta * 0.15;
      }

      pointsGroupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  if (!origin.length || !targets.length) return null;

  return (
    // frustumCulled=false：粒子目标位置随 sequence 切换动态变化，
    // boundingSphere 仅按 position 属性（散开云团）计算，
    // 聚合后粒子可能汇聚到 boundingSphere 之外被视锥剔除，导致整个 Points 对象不可见
    <points ref={pointsGroupRef} frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[origin, 3]} />
        <bufferAttribute attach="attributes-aTarget" args={[targets[0].dest, 3]} />
        <bufferAttribute attach="attributes-aDelay" args={[targets[0].delays, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uProgress: { value: 0 },
          uSize: { value: 10.0 },
          uColor: { value: colorObj },
        }}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * MagicDust - 外层封装
 *
 * 延迟一帧挂载（避免 SSR/首帧 layout 未就绪时 Canvas 尺寸为 0）。
 * Canvas 配置：
 *   - camera: [0,0,9] fov=45，正对 XY 平面观察粒子聚合
 *   - dpr: [1,2] 限制高 DPI 开销
 *   - gl: alpha=false（不透明黑底，AdditiveBlending 叠加可见）+ preserveDrawingBuffer（截图可用）
 */
export function MagicDust(props: MagicDustProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  if (!mounted) return null;

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 45 }}
      dpr={[1, 2]}
      gl={{ alpha: false, preserveDrawingBuffer: true }}
    >
      <MagicDustCore {...props} />
    </Canvas>
  );
}
