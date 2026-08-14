import React, { useEffect, useState } from 'react';
import { raceState } from './raceStateStore';

export default function ThermalStateLayer({ children }) {
  const [thermalState, setThermalState] = useState(raceState.thermalState);
  const [enabled, setEnabled] = useState(raceState.enabled);

  useEffect(() => {
    const unsubscribe = raceState.subscribe((s) => {
      setThermalState(s.thermalState);
      setEnabled(s.enabled);
    });
    return unsubscribe;
  }, []);

  const thermalClass = !enabled ? '' :
    thermalState === 'cold' ? 'thermal-cold' :
    thermalState === 'overheating' ? 'thermal-overheating' : 'thermal-optimal';

  return (
    <div className={`min-h-screen transition-all duration-700 ${thermalClass}`}>
      {/* Peripheral Thermal Warning Vignette (Overheating State Only) */}
      {enabled && thermalState === 'overheating' && (
        <div className="fixed inset-0 pointer-events-none z-[9990] shadow-[inset_0_0_80px_rgba(239,68,68,0.3)] animate-pulse" />
      )}
      {children}
    </div>
  );
}
