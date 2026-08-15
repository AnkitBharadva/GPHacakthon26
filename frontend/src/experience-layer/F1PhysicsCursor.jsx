import React, { useEffect, useRef, useState } from 'react';
import { raceState } from './raceStateStore';

// ── F1 Physics Cursor — Slip-Angle Car Silhouette ───────────────
// Physics: position mass, heading via slip-angle, lean on cornering,
// brake detection, tyre heat accumulation, dual tyre skid trail canvas.
// Car colour cycles through F1 team livery on stress events.

const TEAM_LIVERIES = ['#E80020', '#00D2BE', '#3671C6', '#FF8000', '#a855f7', '#229971'];

export default function F1PhysicsCursor() {
  const canvasRef    = useRef(null);
  const cursorRef    = useRef(null);
  const chassisRef   = useRef(null);
  const brakeGlowRef = useRef(null);
  const shadowRef    = useRef(null);
  const liveryRef    = useRef(0); // current team colour index

  const [active, setActive] = useState(raceState.enabled);
  const [hoverState, setHoverState] = useState('none');
  const [clickSquat, setClickSquat] = useState(false);
  const [liveryColor, setLiveryColor] = useState(TEAM_LIVERIES[0]);

  const state = useRef({
    currentPos:  { x: -200, y: -200 },
    targetPos:   { x: -200, y: -200 },
    prevPos:     { x: -200, y: -200 },
    heading:     0,
    speed:       0,
    prevSpeed:   0,
    lean:        0,
    angularVelocity: 0,
    lastMoveTime: Date.now(),
    isBraking:   false,
    tyreHeat:    0,
    trailPoints: [],
  });

  // Always enable Parc Fermé on fine-pointer devices
  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isCoarse && !isReduced) {
      raceState.enabled = true;
      setActive(true);
    }

    const unsub = raceState.subscribe((s) => {
      setActive(s.enabled && !s.reducedMotion && !s.isCoarsePointer);
    });
    return unsub;
  }, []);

  // Cycle livery on stress events
  useEffect(() => {
    const unsub = raceState.subscribe((s) => {
      if (s.thermalState === 'overheating') {
        liveryRef.current = (liveryRef.current + 1) % TEAM_LIVERIES.length;
        setLiveryColor(TEAM_LIVERIES[liveryRef.current]);
      }
    });
    return unsub;
  }, []);

  // Pointer events
  useEffect(() => {
    if (!active) {
      document.body.classList.remove('parc-ferme-active');
      return;
    }
    document.body.classList.add('parc-ferme-active');

    const onMove  = (e) => { state.current.targetPos = { x: e.clientX, y: e.clientY }; raceState.touch(); };
    const onDown  = () => { setClickSquat(true); setTimeout(() => setClickSquat(false), 220); };
    const onOver  = (e) => {
      const t = e.target.closest('button, a, input, select, textarea, [role="button"]');
      setHoverState(!t ? 'none' : (t.disabled ? 'disabled' : 'interactive'));
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('mouseover', onOver);
      document.body.classList.remove('parc-ferme-active');
    };
  }, [active]);

  // 60fps physics + canvas loop
  useEffect(() => {
    if (!active) return;
    let rafId;
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

    const resize = () => {
      if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    };
    resize();
    window.addEventListener('resize', resize);

    const grip  = 0.16;
    const ema   = 0.30;

    const loop = () => {
      const s = state.current;
      const now = Date.now();

      // 1. Position follow
      const dx = s.targetPos.x - s.currentPos.x;
      const dy = s.targetPos.y - s.currentPos.y;
      s.currentPos.x += dx * 0.42;
      s.currentPos.y += dy * 0.42;

      // 2. Velocity
      const vx = s.currentPos.x - s.prevPos.x;
      const vy = s.currentPos.y - s.prevPos.y;
      const rawSpeed = Math.sqrt(vx * vx + vy * vy);
      s.speed = s.speed * (1 - ema) + rawSpeed * ema;

      if (rawSpeed > 0.8) {
        s.lastMoveTime = now;
        let rad = Math.atan2(vy, vx);
        let deg = (rad * 180) / Math.PI + 90;
        let diff = deg - s.heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        s.angularVelocity = diff;
        s.heading += diff * grip;
        const targetLean = Math.min(Math.max(diff * 0.55, -22), 22);
        s.lean += (targetLean - s.lean) * 0.22;
        s.tyreHeat = Math.min(s.tyreHeat + rawSpeed * 0.004, 1.0);
      } else {
        s.angularVelocity *= 0.8;
        s.lean *= 0.82;
        s.tyreHeat = Math.max(s.tyreHeat - 0.012, 0);
      }

      // 3. Braking
      const dSpeed = s.speed - s.prevSpeed;
      s.isBraking = dSpeed < -1.4 && s.speed > 2.0;

      // 4. Trail
      if (s.speed > 1.6 && canvas) {
        const radH = ((s.heading - 90) * Math.PI) / 180;
        const perpX = Math.cos(radH + Math.PI / 2);
        const perpY = Math.sin(radH + Math.PI / 2);
        const hw = 10;
        const lx = s.currentPos.x - perpX * hw;
        const ly = s.currentPos.y - perpY * hw;
        const rx = s.currentPos.x + perpX * hw;
        const ry = s.currentPos.y + perpY * hw;
        // Cold cyan → hot amber interpolation
        const r = Math.round(0   + s.tyreHeat * (232 - 0));
        const g = Math.round(210 + s.tyreHeat * (128 - 210));
        const b = Math.round(190 + s.tyreHeat * (0   - 190));
        s.trailPoints.push({ lx, ly, rx, ry, alpha: 0.65, color: `rgba(${r},${g},${b},` });
      }

      // 5. Render trails
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = s.trailPoints.length - 1; i >= 0; i--) {
          const pt = s.trailPoints[i];
          pt.alpha *= 0.90;
          if (pt.alpha < 0.018) { s.trailPoints.splice(i, 1); continue; }
          ctx.fillStyle = `${pt.color}${pt.alpha})`;
          ctx.fillRect(pt.lx - 1.5, pt.ly - 1.5, 3, 3);
          ctx.fillRect(pt.rx - 1.5, pt.ry - 1.5, 3, 3);
        }
      }

      // 6. DOM transforms
      if (cursorRef.current) {
        const isIdle     = now - s.lastMoveTime > 400;
        const isLongIdle = now - s.lastMoveTime > 90000;

        let jx = 0, jy = 0;
        if (isIdle && !isLongIdle) {
          const t = now * 0.008;
          jx = Math.sin(t * 8) * 1.4;
          jy = Math.cos(t * 7) * 1.4;
        }

        const noseDip = hoverState === 'interactive' ? 5 : 0;
        const scaleV  = clickSquat ? 0.85 : (1 - Math.min(s.speed * 0.002, 0.1));

        cursorRef.current.style.transform = `translate3d(${s.currentPos.x + jx}px, ${s.currentPos.y + jy}px, 0)`;

        if (chassisRef.current) {
          chassisRef.current.style.transform = `rotate(${s.heading}deg) rotateY(${noseDip}deg) rotateZ(${s.lean}deg) scale(${scaleV})`;
        }
        if (brakeGlowRef.current) {
          brakeGlowRef.current.style.opacity = s.isBraking ? '1' : '0';
          brakeGlowRef.current.style.transform = s.isBraking ? 'scale(1.5)' : 'scale(1)';
        }
        if (shadowRef.current) {
          shadowRef.current.style.transform = s.isBraking ? 'scale(1.4, 2)' : 'scale(1, 1)';
        }
      }

      s.prevPos = { ...s.currentPos };
      s.prevSpeed = s.speed;
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, [active, hoverState, clickSquat]);

  if (!active) return null;

  const c = liveryColor;
  const cDim = liveryColor + '80';

  return (
    <>
      {/* Skid trails canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{ willChange: 'contents' }}
      />

      {/* F1 car cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform', marginLeft: '-16px', marginTop: '-20px' }}
      >
        <div
          ref={chassisRef}
          className="relative w-8 h-10 transition-transform"
          style={{ transitionDuration: '60ms' }}
        >
          {/* Ground shadow */}
          <div
            ref={shadowRef}
            className="absolute inset-x-1 inset-y-2 bg-black/50 rounded-full blur-[3px] transition-transform duration-100"
          />

          {/* F1 car SVG — top-down view */}
          <svg
            viewBox="0 0 32 42"
            width="32"
            height="42"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: `drop-shadow(0 0 6px ${c}) drop-shadow(0 0 14px ${cDim})` }}
          >
            {/* Front wing */}
            <path d="M5 9 C5 7, 27 7, 27 9 L26 11 L6 11 Z" fill={c} opacity="0.95"/>
            {/* Front left tyre */}
            <rect x="2" y="7" width="3.5" height="7" rx="1.2" fill="#111" stroke={c} strokeWidth="0.6"/>
            {/* Front right tyre */}
            <rect x="26.5" y="7" width="3.5" height="7" rx="1.2" fill="#111" stroke={c} strokeWidth="0.6"/>
            {/* Nose cone */}
            <path d="M16 4 L20 13 L21 28 L17 35 L15 35 L11 28 L12 13 Z" fill="#0a0a14" stroke={c} strokeWidth="0.9"/>
            {/* Livery stripe on chassis */}
            <path d="M15 12 L17 12 L18 28 L16 32 L14 28 Z" fill={c} opacity="0.35"/>
            {/* Cockpit / halo */}
            <path d="M14 17 C14 15, 18 15, 18 17 L17.5 22 L14.5 22 Z" fill={c} opacity="0.9"/>
            {/* Helmet */}
            <circle cx="16" cy="19.5" r="2" fill="#1a1a2e" stroke={c} strokeWidth="0.5"/>
            <circle cx="16" cy="19.5" r="1.2" fill="#fff" opacity="0.15"/>
            {/* Left sidepod */}
            <path d="M12 18 L6 22 L6 30 L12 29 Z" fill="#0a0a14" stroke={c} strokeWidth="0.5" opacity="0.9"/>
            {/* Right sidepod */}
            <path d="M20 18 L26 22 L26 30 L20 29 Z" fill="#0a0a14" stroke={c} strokeWidth="0.5" opacity="0.9"/>
            {/* Rear left tyre */}
            <rect x="1" y="28" width="5" height="9" rx="1.5" fill="#111" stroke={c} strokeWidth="0.6"/>
            {/* Rear right tyre */}
            <rect x="26" y="28" width="5" height="9" rx="1.5" fill="#111" stroke={c} strokeWidth="0.6"/>
            {/* Rear wing main */}
            <rect x="5" y="35" width="22" height="3.5" rx="0.6" fill={c} opacity="0.95"/>
            {/* Rear wing end-plates */}
            <rect x="5" y="33" width="2" height="5.5" rx="0.3" fill={c} opacity="0.7"/>
            <rect x="25" y="33" width="2" height="5.5" rx="0.3" fill={c} opacity="0.7"/>
            {/* Rear rain/brake light */}
            <rect
              ref={brakeGlowRef}
              x="13.5" y="38.5" width="5" height="2" rx="1"
              fill="#E80020" opacity="0"
              style={{ filter: 'drop-shadow(0 0 6px #E80020)', transition: 'opacity 0.08s, transform 0.08s' }}
            />
          </svg>
        </div>
      </div>
    </>
  );
}
