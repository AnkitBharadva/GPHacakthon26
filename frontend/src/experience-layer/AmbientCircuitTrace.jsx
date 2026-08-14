import React, { useEffect, useState } from 'react';
import { raceState } from './raceStateStore';

export default function AmbientCircuitTrace() {
  const [active, setActive] = useState(raceState.enabled);

  useEffect(() => {
    const unsubscribe = raceState.subscribe((s) => {
      setActive(s.enabled && !s.reducedMotion);
    });
    return unsubscribe;
  }, []);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="circuitGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Abstract Viewport Circuit Boundary Path */}
        <rect
          x="12"
          y="12"
          width="calc(100% - 24px)"
          height="calc(100% - 24px)"
          rx="8"
          fill="none"
          stroke="url(#circuitGlow)"
          strokeWidth="1"
          strokeDasharray="6 14"
        />
      </svg>

      {/* Traveling Ambient Lap Telemetry Pulse (Completes lap every 45s) */}
      <div
        className="absolute w-2 h-2 rounded-full bg-cyan-400/50 shadow-[0_0_8px_#22d3ee] pointer-events-none"
        style={{
          offsetPath: "rect(12px calc(100% - 12px) calc(100% - 12px) 12px round 8px)",
          animation: "ambientLapDrive 45s linear infinite",
          willChange: "offset-distance, transform"
        }}
      />

      <style>{`
        @keyframes ambientLapDrive {
          0% { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }
      `}</style>
    </div>
  );
}
