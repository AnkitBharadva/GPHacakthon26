import React, { useEffect, useRef } from 'react';
import { raceState } from './raceStateStore';

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.2; // slight upward drift
    this.radius = 2 + Math.random() * 4;
    this.alpha = 0.7 + Math.random() * 0.3;
    this.decay = 0.02 + Math.random() * 0.02;
    this.growth = 0.25;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.94; // air resistance drag
    this.vy *= 0.94;
    this.vy += 0.04; // gravity
    this.radius += this.growth;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${this.alpha * 0.4})`; // tyre smoke with stress red tint
    ctx.fill();
    ctx.restore();
  }
}

export default function TyreSmokeBurst() {
  const canvasRef = useRef(null);
  const particles = useRef([]);

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

    const handleStressBurst = (e) => {
      if (!raceState.enabled || raceState.reducedMotion) return;
      const x = e.detail?.x || window.innerWidth / 2;
      const y = e.detail?.y || window.innerHeight / 2;

      // Spawn 8-12 smoke particles
      for (let i = 0; i < 10; i++) {
        particles.current.push(new Particle(x, y));
      }
    };

    window.addEventListener('f1-stress-burst', handleStressBurst);

    let animId;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        p.draw(ctx);

        if (p.alpha <= 0) {
          particles.current.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('f1-stress-burst', handleStressBurst);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9995]"
      style={{ willChange: 'contents' }}
    />
  );
}

// Utility to dispatch burst from anywhere in the app
export function triggerTyreSmokeBurst(x, y) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('f1-stress-burst', { detail: { x, y } }));
  }
}
