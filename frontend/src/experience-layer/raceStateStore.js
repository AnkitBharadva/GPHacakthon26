// Parc Fermé Visual System — Shared Race State Store
// Lightweight event pub/sub with zero external dependencies

class RaceStateStore {
  constructor() {
    const saved = localStorage.getItem('parc_ferme_enabled');
    this.enabled = saved !== null ? saved === 'true' : true;
    
    this.cursorPos = { x: -100, y: -100 };
    this.cursorSpeed = 0;
    this.cursorHeading = 0;
    this.cursorLean = 0;
    
    this.thermalState = 'optimal'; // 'cold' | 'optimal' | 'overheating'
    this.lastInteraction = Date.now();
    this.stressEvents = []; // timestamps within last 12s
    
    this.reducedMotion = typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;
      
    this.isCoarsePointer = typeof window !== 'undefined'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
      
    this.listeners = new Set();
    this.initWatchers();
  }

  initWatchers() {
    if (typeof window === 'undefined') return;

    // Media query change listeners
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      this.notify();
    });

    window.matchMedia('(pointer: coarse)').addEventListener('change', (e) => {
      this.isCoarsePointer = e.matches;
      this.notify();
    });

    // Thermal State Heartbeat: check idle time (90s) & stress overheating (10s)
    setInterval(() => {
      const now = Date.now();
      
      // Filter stress events older than 10s
      this.stressEvents = this.stressEvents.filter(t => now - t < 10000);
      
      let nextThermal = 'optimal';
      if (this.stressEvents.length >= 3) {
        nextThermal = 'overheating';
      } else if (now - this.lastInteraction > 90000) {
        nextThermal = 'cold';
      }

      if (nextThermal !== this.thermalState) {
        this.thermalState = nextThermal;
        this.notify();
      }
    }, 1000);
  }

  touch() {
    this.lastInteraction = Date.now();
    if (this.thermalState === 'cold') {
      this.thermalState = 'optimal';
      this.notify();
    }
  }

  recordStressEvent() {
    this.stressEvents.push(Date.now());
    if (this.stressEvents.length >= 3 && this.thermalState !== 'overheating') {
      this.thermalState = 'overheating';
      this.notify();
    }
  }

  toggleEnabled() {
    this.enabled = !this.enabled;
    localStorage.setItem('parc_ferme_enabled', this.enabled ? 'true' : 'false');
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }
}

export const raceState = new RaceStateStore();
