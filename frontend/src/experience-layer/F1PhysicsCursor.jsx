import React, { useEffect, useRef, useState } from 'react';
import { raceState } from './raceStateStore';

export default function F1PhysicsCursor() {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const chassisRef = useRef(null);
  const brakeGlowRef = useRef(null);
  const shadowRef = useRef(null);

  const [active, setActive] = useState(raceState.enabled);
  const [hoverState, setHoverState] = useState('none'); // 'none' | 'interactive' | 'disabled'
  const [clickSquat, setClickSquat] = useState(false);

  // Physics simulation state (mutable for 60fps rAF loop)
  const state = useRef({
    currentPos: { x: -100, y: -100 },
    targetPos: { x: -100, y: -100 },
    prevPos: { x: -100, y: -100 },
    heading: 0,
    targetHeading: 0,
    speed: 0,
    prevSpeed: 0,
    lean: 0,
    angularVelocity: 0,
    lastMoveTime: Date.now(),
    isBraking: false,
    tyreHeat: 0, // 0.0 (cold cyan) to 1.0 (hot amber)
    trailPoints: [] // Array of { lx, ly, rx, ry, alpha, color }
  });

  useEffect(() => {
    const unsubscribe = raceState.subscribe((s) => {
      setActive(s.enabled && !s.reducedMotion && !s.isCoarsePointer);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!active) {
      document.body.classList.remove('parc-ferme-active');
      return;
    }

    document.body.classList.add('parc-ferme-active');

    const handlePointerMove = (e) => {
      state.current.targetPos = { x: e.clientX, y: e.clientY };
      raceState.touch();
    };

    const handlePointerDown = () => {
      setClickSquat(true);
      setTimeout(() => setClickSquat(false), 220);
    };

    const handleMouseOver = (e) => {
      const target = e.target.closest('button, a, input, select, textarea, [role="button"], .interactive-element');
      if (target) {
        if (target.disabled || target.getAttribute('aria-disabled') === 'true') {
          setHoverState('disabled');
        } else {
          setHoverState('interactive');
        }
      } else {
        setHoverState('none');
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('mouseover', handleMouseOver, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('mouseover', handleMouseOver);
      document.body.classList.remove('parc-ferme-active');
    };
  }, [active]);

  // Main 60fps Physics & Canvas Animation Loop
  useEffect(() => {
    if (!active) return;

    let animId;
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gripFactor = 0.16; // F1 tight chassis slip-angle response
    const alphaEma = 0.3; // Speed smoothing factor

    const loop = () => {
      const s = state.current;
      const now = Date.now();

      // 1. Position follow with slight mass
      const dx = s.targetPos.x - s.currentPos.x;
      const dy = s.targetPos.y - s.currentPos.y;
      s.currentPos.x += dx * 0.45;
      s.currentPos.y += dy * 0.45;

      // 2. Velocity & Raw Speed
      const vx = s.currentPos.x - s.prevPos.x;
      const vy = s.currentPos.y - s.prevPos.y;
      const rawSpeed = Math.sqrt(vx * vx + vy * vy);
      
      // Exponential moving average for speed
      s.speed = s.speed * (1 - alphaEma) + rawSpeed * alphaEma;

      if (rawSpeed > 0.8) {
        s.lastMoveTime = now;
        
        // 3. Slip-Angle Heading Calculation
        let rad = Math.atan2(vy, vx);
        let deg = (rad * 180) / Math.PI + 90; // Align car nose forward

        // Handle 360 wrap-around for shortest rotation path
        let diff = deg - s.heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        s.angularVelocity = diff;
        s.heading += diff * gripFactor;

        // 4. Cornering Lean (body roll into turns)
        const targetLean = Math.min(Math.max(diff * 0.55, -18), 18);
        s.lean += (targetLean - s.lean) * 0.25;

        // 5. Tyre Temperature Heat Accumulation
        s.tyreHeat = Math.min(s.tyreHeat + rawSpeed * 0.003, 1.0);
      } else {
        s.angularVelocity *= 0.8;
        s.lean *= 0.8;
        s.tyreHeat = Math.max(s.tyreHeat - 0.015, 0.0);
      }

      // 6. Braking Detection (sharp deceleration)
      const dSpeed = s.speed - s.prevSpeed;
      s.isBraking = dSpeed < -1.2 && s.speed > 2.0;

      // 7. Tyre Trail Points (Left & Right Tyre Contact Arcs)
      if (s.speed > 1.8 && canvas) {
        const radHeading = ((s.heading - 90) * Math.PI) / 180;
        const perpX = Math.cos(radHeading + Math.PI / 2);
        const perpY = Math.sin(radHeading + Math.PI / 2);
        const halfTrack = 9; // Half axle width in px

        const lx = s.currentPos.x - perpX * halfTrack;
        const ly = s.currentPos.y - perpY * halfTrack;
        const rx = s.currentPos.x + perpX * halfTrack;
        const ry = s.currentPos.y + perpY * halfTrack;

        // Tyre trail color interpolates from Cold Cyan (#22d3ee) to Hot Amber (#eab308)
        const r = Math.round(34 + s.tyreHeat * (234 - 34));
        const g = Math.round(211 + s.tyreHeat * (179 - 211));
        const b = Math.round(238 + s.tyreHeat * (8 - 238));
        const color = `rgba(${r}, ${g}, ${b},`;

        s.trailPoints.push({ lx, ly, rx, ry, alpha: 0.6, color });
      }

      // 8. Render Canvas Tyre Trails with Alpha Decay
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = s.trailPoints.length - 1; i >= 0; i--) {
          const pt = s.trailPoints[i];
          pt.alpha *= 0.92; // Natural speed-dependent fade

          if (pt.alpha < 0.02) {
            s.trailPoints.splice(i, 1);
            continue;
          }

          ctx.fillStyle = `${pt.color} ${pt.alpha})`;
          ctx.fillRect(pt.lx - 1, pt.ly - 1, 2, 2);
          ctx.fillRect(pt.rx - 1, pt.ry - 1, 2, 2);
        }
      }

      // 9. Update DOM Cursor Transforms
      if (cursorRef.current) {
        const isIdle = now - s.lastMoveTime > 400;
        const isLongIdle = now - s.lastMoveTime > 90000;

        // Idle engine jitter (8Hz)
        let jitterX = 0;
        let jitterY = 0;
        if (isIdle && !isLongIdle) {
          const t = now * 0.008;
          jitterX = Math.sin(t * 8) * 1.2;
          jitterY = Math.cos(t * 7) * 1.2;
        }

        // Hover deceleration / dip
        const noseDip = hoverState === 'interactive' ? 4 : 0;
        const scaleVal = clickSquat ? 0.88 : (1 - Math.min(s.speed * 0.002, 0.08));

        cursorRef.current.style.transform = `translate3d(${s.currentPos.x + jitterX}px, ${s.currentPos.y + jitterY}px, 0)`;

        if (chassisRef.current) {
          chassisRef.current.style.transform = `rotate(${s.heading}deg) rotateY(${noseDip}deg) rotateZ(${s.lean}deg) scale(${scaleVal})`;
        }

        // Rear brake glow flare
        if (brakeGlowRef.current) {
          brakeGlowRef.current.style.opacity = s.isBraking ? '0.85' : '0.0';
          brakeGlowRef.current.style.transform = s.isBraking ? 'scale(1.4)' : 'scale(1)';
        }

        // Contact-patch shadow stretching under braking
        if (shadowRef.current) {
          shadowRef.current.style.transform = s.isBraking ? 'scale(1.3, 1.8)' : 'scale(1, 1)';
        }
      }

      s.prevPos = { ...s.currentPos };
      s.prevSpeed = s.speed;

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [active, hoverState, clickSquat]);

  if (!active) return null;

  return (
    <>
      {/* 2D Canvas for Dual Tyre Contact Skid Arcs */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{ willChange: 'contents' }}
      />

      {/* Slip-Angle F1 Chassis Silhouette Cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] -ml-4 -mt-5"
        style={{ willChange: 'transform' }}
      >
        <div ref={chassisRef} className="relative w-8 h-10 transition-transform duration-75">
          {/* Contact-Patch Shadow beneath car (weight transfer) */}
          <div
            ref={shadowRef}
            className="absolute inset-x-1 inset-y-1 bg-black/60 rounded-full blur-[2px] transition-transform duration-100"
          />

          {/* Top-Down F1 Car Silhouette SVG */}
          <svg
            viewBox="0 0 32 40"
            className="w-8 h-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Front Wing */}
            <path
              d="M4 8 C4 6, 28 6, 28 8 L27 10 L5 10 Z"
              fill="#22d3ee"
              stroke="#0a0a0f"
              strokeWidth="0.5"
            />
            {/* Front Left / Right Tyres */}
            <rect x="2" y="6" width="3.5" height="7" rx="1" fill="#181824" stroke="#22d3ee" strokeWidth="0.5" />
            <rect x="26.5" y="6" width="3.5" height="7" rx="1" fill="#181824" stroke="#22d3ee" strokeWidth="0.5" />

            {/* Nose Cone & Monocoque Chassis */}
            <path
              d="M16 4 L19 14 L20 28 L17 34 L15 34 L12 28 L13 14 Z"
              fill="#0f172a"
              stroke="#22d3ee"
              strokeWidth="0.8"
            />

            {/* Cockpit Halo & Driver Helmet */}
            <path d="M14 18 C14 16, 18 16, 18 18 L17.5 22 L14.5 22 Z" fill="#22d3ee" />
            <circle cx="16" cy="20" r="1.8" fill="#f43f5e" />

            {/* Sidepods */}
            <path d="M12 18 L7 22 L7 29 L12 28 Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="0.5" />
            <path d="M20 18 L25 22 L25 29 L20 28 Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="0.5" />

            {/* Rear Left / Right Tyres */}
            <rect x="1" y="27" width="4.5" height="8" rx="1.2" fill="#181824" stroke="#22d3ee" strokeWidth="0.5" />
            <rect x="26.5" y="27" width="4.5" height="8" rx="1.2" fill="#181824" stroke="#22d3ee" strokeWidth="0.5" />

            {/* Rear Wing Base */}
            <rect x="6" y="34" width="20" height="3" rx="0.5" fill="#22d3ee" />

            {/* Rear Rain Light / Brake Flare (Layer 2) */}
            <rect
              ref={brakeGlowRef}
              x="14"
              y="37"
              width="4"
              height="2"
              rx="1"
              fill="#ef4444"
              className="transition-all duration-100 opacity-0"
              style={{ filter: 'drop-shadow(0 0 6px #ef4444)' }}
            />
          </svg>
        </div>
      </div>
    </>
  );
}
