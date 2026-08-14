import React, { useEffect, useRef } from 'react';
import { raceState } from './raceStateStore';

export default function SpeedLineStreaks() {
  const canvasRef = useRef(null);
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const streaks = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleScroll = () => {
      if (!raceState.enabled || raceState.reducedMotion) return;
      const now = Date.now();
      const dt = Math.max(now - lastScrollTime.current, 1);
      const dy = Math.abs(window.scrollY - lastScrollY.current);
      const velocity = (dy / dt) * 10; // px/ms

      lastScrollY.current = window.scrollY;
      lastScrollTime.current = now;

      // If scrolling fast, spawn 2-4 horizontal speed streak lines
      if (velocity > 1.5 && streaks.current.length < 12) {
        const count = Math.min(Math.floor(velocity), 4);
        for (let i = 0; i < count; i++) {
          streaks.current.push({
            x: -200,
            y: Math.random() * window.innerHeight,
            length: 80 + Math.random() * 160,
            speed: 18 + Math.random() * 24 + velocity * 2,
            alpha: 0.35 + Math.random() * 0.25,
            width: 1 + Math.random() * 1.5
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    let animId;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = streaks.current.length - 1; i >= 0; i--) {
        const s = streaks.current[i];
        s.x += s.speed;
        s.alpha *= 0.96;

        if (s.x > canvas.width || s.alpha < 0.02) {
          streaks.current.splice(i, 1);
          continue;
        }

        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.length, s.y);
        grad.addColorStop(0, 'rgba(34, 211, 238, 0)');
        grad.addColorStop(0.7, `rgba(34, 211, 238, ${s.alpha})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${s.alpha * 1.2})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.length, s.y);
        ctx.stroke();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[2]"
      style={{ willChange: 'contents' }}
    />
  );
}
