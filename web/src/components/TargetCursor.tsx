import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface TargetCursorProps {
  targetSelector?: string;
  spinDuration?: number;
  hideDefaultCursor?: boolean;
  hoverDuration?: number;
  parallaxOn?: boolean;
  cursorColor?: string;
  cursorColorOnTarget?: string;
}

const CORNER_SIZE = 12;
/** 角标边框宽度，锁定目标时向外扩出的距离 */
const CURSOR_BORDER = 3;
const RETURN_DURATION = 300;

/** 四个角标在静止方块中的偏移（角标左上角相对光标中心的坐标） */
const REST_OFFSETS = [
  { x: -CORNER_SIZE * 1.5, y: -CORNER_SIZE * 1.5 },
  { x: CORNER_SIZE * 0.5, y: -CORNER_SIZE * 1.5 },
  { x: CORNER_SIZE * 0.5, y: CORNER_SIZE * 0.5 },
  { x: -CORNER_SIZE * 1.5, y: CORNER_SIZE * 0.5 },
];

const CORNER_NAMES = ['tl', 'tr', 'br', 'bl'] as const;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** 目标锁定光标：空闲自转，悬停到命中元素时展开四角框住它，离开后收回 */
export function TargetCursor({
  targetSelector = '.cursor-target',
  spinDuration = 2,
  hideDefaultCursor = true,
  hoverDuration = 0.2,
  parallaxOn = true,
  cursorColor = '#f47c94',
  cursorColorOnTarget = '#a855f7',
}: TargetCursorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const cornerRefs = useRef<Array<HTMLDivElement | null>>([]);

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const userAgent = navigator.userAgent || navigator.vendor || '';
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    return (hasTouchScreen && isSmallScreen) || mobileRegex.test(userAgent.toLowerCase());
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const wrapper = wrapperRef.current;
    const dot = dotRef.current;
    const corners = cornerRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (!wrapper || !dot || corners.length !== REST_OFFSETS.length) return;

    const root = document.documentElement;
    if (hideDefaultCursor) root.classList.add('cursor-hidden');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let posX = mouseX;
    let posY = mouseY;
    let rotation = 0;
    let wrapperScale = 1;
    let wrapperScaleTarget = 1;
    let dotScale = 1;
    let dotScaleTarget = 1;

    let activeEl: HTMLElement | null = null;
    let leaveHandler: (() => void) | null = null;
    let strength = 0;
    let strengthStart = 0;
    let returning = false;
    let returnStart = 0;

    const cornerPos = REST_OFFSETS.map((offset) => ({ ...offset }));
    /** 每次过渡（进入 / 离开）开始时的角标位置 */
    const cornerFrom = REST_OFFSETS.map((offset) => ({ ...offset }));
    const cornerAbs = REST_OFFSETS.map((offset) => ({ ...offset }));
    /** 带滞后的目标位置，用于视差 */
    const cornerLag = REST_OFFSETS.map((offset) => ({ ...offset }));

    const paintCursor = (color: string) => {
      dot.style.backgroundColor = color;
      for (const corner of corners) corner.style.borderColor = color;
    };

    const measureTarget = () => {
      if (!activeEl) return;
      const rect = activeEl.getBoundingClientRect();
      cornerAbs[0] = { x: rect.left - CURSOR_BORDER, y: rect.top - CURSOR_BORDER };
      cornerAbs[1] = { x: rect.right + CURSOR_BORDER - CORNER_SIZE, y: rect.top - CURSOR_BORDER };
      cornerAbs[2] = {
        x: rect.right + CURSOR_BORDER - CORNER_SIZE,
        y: rect.bottom + CURSOR_BORDER - CORNER_SIZE,
      };
      cornerAbs[3] = { x: rect.left - CURSOR_BORDER, y: rect.bottom + CURSOR_BORDER - CORNER_SIZE };
    };

    const detachLeave = () => {
      if (activeEl && leaveHandler) activeEl.removeEventListener('mouseleave', leaveHandler);
      leaveHandler = null;
    };

    const snapshotCorners = () => {
      cornerPos.forEach((pos, index) => {
        cornerFrom[index].x = pos.x;
        cornerFrom[index].y = pos.y;
      });
    };

    const leave = () => {
      if (!activeEl) return;
      detachLeave();
      activeEl = null;
      strength = 0;
      returning = true;
      returnStart = performance.now();
      snapshotCorners();
      if (cursorColorOnTarget) paintCursor(cursorColor);
    };

    const enter = (event: MouseEvent) => {
      let node: HTMLElement | null = event.target instanceof HTMLElement ? event.target : null;
      let target: HTMLElement | null = null;
      while (node && node !== document.body) {
        if (node.matches(targetSelector)) {
          target = node;
          break;
        }
        node = node.parentElement;
      }
      if (!target || target === activeEl) return;

      detachLeave();
      activeEl = target;
      returning = false;
      strength = 0;
      strengthStart = performance.now();
      rotation = 0; // 停止自转，角标正对目标
      snapshotCorners();
      cornerLag.forEach((lag, index) => {
        lag.x = REST_OFFSETS[index].x;
        lag.y = REST_OFFSETS[index].y;
      });
      if (cursorColorOnTarget) paintCursor(cursorColorOnTarget);
      measureTarget();

      leaveHandler = leave;
      target.addEventListener('mouseleave', leave);
    };

    const moveHandler = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    };
    const downHandler = () => {
      wrapperScaleTarget = 0.9;
      dotScaleTarget = 0.7;
    };
    const upHandler = () => {
      wrapperScaleTarget = 1;
      dotScaleTarget = 1;
    };
    const scrollHandler = () => {
      if (!activeEl) return;
      // 滚动后鼠标可能已经不在原目标上
      const under = document.elementFromPoint(mouseX, mouseY);
      const stillOver =
        under && (under === activeEl || under.closest(targetSelector) === activeEl);
      if (!stillOver) leave();
    };

    corners.forEach((corner, index) => {
      corner.style.transform = `translate3d(${REST_OFFSETS[index].x}px, ${REST_OFFSETS[index].y}px, 0)`;
    });

    let lastFrame = performance.now();
    let rafId = 0;

    const frame = (now: number) => {
      const dt = Math.min(32, now - lastFrame) / 1000;
      lastFrame = now;

      // 光标跟随鼠标（近似 0.1s power3.out 的手感）
      const follow = easeOutCubic(Math.min(1, dt * 10));
      posX += (mouseX - posX) * follow;
      posY += (mouseY - posY) * follow;

      if (!activeEl && !reducedMotion) {
        rotation = (rotation + (360 / Math.max(0.1, spinDuration)) * dt) % 360;
      }

      // 目标位置每帧重算：元素自身的 hover 位移、滚动、窗口变化都能跟上
      if (activeEl) measureTarget();

      const scaleSmoothing = Math.min(1, dt * 10);
      wrapperScale += (wrapperScaleTarget - wrapperScale) * scaleSmoothing;
      dotScale += (dotScaleTarget - dotScale) * scaleSmoothing;

      if (activeEl) {
        const progress =
          hoverDuration <= 0 ? 1 : Math.min(1, (now - strengthStart) / (hoverDuration * 1000));
        strength = easeOutCubic(progress);
      } else {
        strength = 0;
      }

      const returnProgress = returning ? Math.min(1, (now - returnStart) / RETURN_DURATION) : 0;
      const returnEased = easeOutCubic(returnProgress);
      if (returning && returnProgress >= 1) {
        // 收尾帧直接对齐到静止位置，避免留下亚像素残差
        cornerPos.forEach((pos, index) => {
          pos.x = REST_OFFSETS[index].x;
          pos.y = REST_OFFSETS[index].y;
        });
        returning = false;
      }

      for (let index = 0; index < corners.length; index += 1) {
        if (activeEl) {
          const targetX = cornerAbs[index].x - posX;
          const targetY = cornerAbs[index].y - posY;
          if (parallaxOn && strength > 0.99) {
            cornerLag[index].x += (targetX - cornerLag[index].x) * 0.25;
            cornerLag[index].y += (targetY - cornerLag[index].y) * 0.25;
          } else {
            cornerLag[index].x = targetX;
            cornerLag[index].y = targetY;
          }
          cornerPos[index].x =
            cornerFrom[index].x + (cornerLag[index].x - cornerFrom[index].x) * strength;
          cornerPos[index].y =
            cornerFrom[index].y + (cornerLag[index].y - cornerFrom[index].y) * strength;
        } else if (returning) {
          cornerPos[index].x =
            cornerFrom[index].x + (REST_OFFSETS[index].x - cornerFrom[index].x) * returnEased;
          cornerPos[index].y =
            cornerFrom[index].y + (REST_OFFSETS[index].y - cornerFrom[index].y) * returnEased;
        }

        corners[index].style.transform = `translate3d(${cornerPos[index].x.toFixed(2)}px, ${cornerPos[
          index
        ].y.toFixed(2)}px, 0)`;
      }

      wrapper.style.transform = `translate3d(${posX.toFixed(2)}px, ${posY.toFixed(
        2,
      )}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${wrapperScale.toFixed(3)})`;
      dot.style.transform = `scale(${dotScale.toFixed(3)})`;

      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    window.addEventListener('mousemove', moveHandler, { passive: true });
    window.addEventListener('mouseover', enter, { passive: true });
    window.addEventListener('mousedown', downHandler);
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('scroll', scrollHandler, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseover', enter);
      window.removeEventListener('mousedown', downHandler);
      window.removeEventListener('mouseup', upHandler);
      window.removeEventListener('scroll', scrollHandler);
      detachLeave();
      root.classList.remove('cursor-hidden');
      paintCursor(cursorColor);
    };
  }, [
    isMobile,
    targetSelector,
    spinDuration,
    hideDefaultCursor,
    hoverDuration,
    parallaxOn,
    cursorColor,
    cursorColorOnTarget,
  ]);

  if (isMobile) return null;

  return createPortal(
    <div ref={wrapperRef} className="target-cursor-wrapper" aria-hidden>
      <div ref={dotRef} className="target-cursor-dot" style={{ backgroundColor: cursorColor }} />
      {CORNER_NAMES.map((name, index) => (
        <div
          key={name}
          ref={(el) => {
            cornerRefs.current[index] = el;
          }}
          className={`target-cursor-corner corner-${name}`}
          style={{ borderColor: cursorColor }}
        />
      ))}
    </div>,
    document.body,
  );
}
