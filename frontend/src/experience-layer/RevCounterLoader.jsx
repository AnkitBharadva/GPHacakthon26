import React, { useEffect, useState } from 'react';

export default function RevCounterLoader({ label = "CALIBRATING TELEMETRY…" }) {
  const [activeLed, setActiveLed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLed((prev) => (prev + 1) % 12);
    }, 65);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3 font-mono">
      {/* 12-Segment LED Shift-Light Rev Counter Arc */}
      <div className="flex items-center gap-1.5 p-2 bg-[#07080f] rounded-[4px] border border-white/10 shadow-inner">
        {Array.from({ length: 12 }).map((_, i) => {
          const isGreen = i < 4;
          const isYellow = i >= 4 && i < 8;
          const isLit = i <= activeLed;

          let color = '#374151'; // off
          let glow = 'none';

          if (isLit) {
            if (isGreen) {
              color = '#22c55e';
              glow = '0 0 8px rgba(34, 197, 94, 0.6)';
            } else if (isYellow) {
              color = '#eab308';
              glow = '0 0 8px rgba(234, 179, 8, 0.6)';
            } else {
              color = '#ef4444';
              glow = '0 0 10px rgba(239, 68, 68, 0.8)';
            }
          }

          return (
            <div
              key={i}
              className="w-2.5 h-4 rounded-[1px] transition-all duration-75"
              style={{
                backgroundColor: color,
                boxShadow: glow
              }}
            />
          );
        })}
      </div>

      <span className="text-[11px] font-bold tracking-widest text-cyan-400 font-display animate-pulse uppercase">
        {label}
      </span>
    </div>
  );
}
