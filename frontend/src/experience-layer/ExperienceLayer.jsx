import React, { useEffect, useState } from 'react';
import { raceState } from './raceStateStore';
import F1PhysicsCursor from './F1PhysicsCursor';
import AmbientCircuitTrace from './AmbientCircuitTrace';
import GhostCarEntrance from './GhostCarEntrance';
import SpeedLineStreaks from './SpeedLineStreaks';
import TyreSmokeBurst from './TyreSmokeBurst';

export default function ExperienceLayer() {
  const [enabled, setEnabled] = useState(raceState.enabled);
  const [thermalState, setThermalState] = useState(raceState.thermalState);

  useEffect(() => {
    const unsubscribe = raceState.subscribe((s) => {
      setEnabled(s.enabled);
      setThermalState(s.thermalState);
    });
    return unsubscribe;
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* 1. Slip-Angle Physics F1 Cursor & Tyre Skid Canvas */}
      <F1PhysicsCursor />

      {/* 2. Ambient Viewport Circuit Outline & Travelling Lap Dot */}
      <AmbientCircuitTrace />

      {/* 3. One-Shot Hero Ghost Car Pass */}
      <GhostCarEntrance />

      {/* 4. Scroll Velocity Speed-Line Streaks */}
      <SpeedLineStreaks />

      {/* 5. Stress Event Tyre Smoke Particle Burst */}
      <TyreSmokeBurst />
    </>
  );
}

// Toggle Button for Top Navigation Bar
export function ParcFermeToggle() {
  const [enabled, setEnabled] = useState(raceState.enabled);
  const [thermalState, setThermalState] = useState(raceState.thermalState);

  useEffect(() => {
    const unsubscribe = raceState.subscribe((s) => {
      setEnabled(s.enabled);
      setThermalState(s.thermalState);
    });
    return unsubscribe;
  }, []);

  const getThermalBadge = () => {
    if (!enabled) return null;
    if (thermalState === 'cold') {
      return (
        <span className="text-[9px] font-mono text-cyan-300/60 bg-cyan-500/10 px-1.5 py-0.5 rounded-[2px] border border-cyan-500/20">
          ❄️ COLD (IDLE)
        </span>
      );
    }
    if (thermalState === 'overheating') {
      return (
        <span className="text-[9px] font-mono text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded-[2px] border border-red-500/40 animate-pulse">
          🔥 OVERHEAT
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded-[2px] border border-green-500/20">
        ⚡ OPTIMAL
      </span>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {getThermalBadge()}
      <button
        onClick={() => raceState.toggleEnabled()}
        className={`px-2.5 py-1 rounded-[3px] font-mono text-[10px] font-bold tracking-wider uppercase border transition flex items-center gap-1.5 ${
          enabled
            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]'
            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
        }`}
        title="Toggle Parc Fermé F1 Physics Cursor & Ambient Experience Layer"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-white/20'}`} />
        Parc Fermé FX {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
