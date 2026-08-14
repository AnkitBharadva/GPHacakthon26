import React, { useEffect, useState } from 'react';
import { raceState } from './raceStateStore';

export default function GhostCarEntrance() {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = sessionStorage.getItem('f1_ghost_car_seen');
    if (!seen && raceState.enabled && !raceState.reducedMotion) {
      setShouldAnimate(true);
      sessionStorage.setItem('f1_ghost_car_seen', 'true');
      const timer = setTimeout(() => {
        setShouldAnimate(false);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!shouldAnimate) return null;

  return (
    <div className="fixed top-12 left-0 right-0 h-24 pointer-events-none z-[9990] overflow-hidden">
      <div
        className="w-48 h-12 flex items-center gap-2 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]"
        style={{
          animation: 'ghostCarFlyby 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <svg
          viewBox="0 0 120 30"
          className="w-36 h-8 text-cyan-400 opacity-60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Side-view F1 silhouette */}
          <path
            d="M5 22 L20 22 L25 15 L55 12 L75 12 L85 18 L115 18 L118 22 L5 22 Z"
            fill="currentColor"
          />
          {/* Halo / Cockpit */}
          <path d="M45 12 C45 7, 58 7, 60 12 Z" fill="#ffffff" opacity="0.8" />
          {/* Wheels */}
          <circle cx="22" cy="22" r="6" fill="#0a0a0f" stroke="#22d3ee" strokeWidth="1.5" />
          <circle cx="96" cy="22" r="6" fill="#0a0a0f" stroke="#22d3ee" strokeWidth="1.5" />
          {/* Rear wing */}
          <path d="M2 12 L12 12 L14 20 L4 20 Z" fill="currentColor" />
        </svg>

        {/* Speed streak vapor */}
        <div className="h-0.5 w-24 bg-gradient-to-r from-transparent to-cyan-400/80 rounded-full blur-[1px]" />
      </div>

      <style>{`
        @keyframes ghostCarFlyby {
          0% {
            transform: translateX(-120%) scale(0.9);
            opacity: 0;
          }
          20% {
            opacity: 0.65;
          }
          70% {
            opacity: 0.5;
          }
          100% {
            transform: translateX(110vw) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
