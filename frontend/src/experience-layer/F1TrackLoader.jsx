import React, { useEffect, useState, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   F1 Track Loader
   Full-screen overlay shown while audio is being analyzed.
   • Melbourne Grand Prix Circuit (Albert Park) SVG
   • Car animated along the track with SVG <animateMotion>
   • Flickering telemetry, sector LEDs, radio chatter, lap timer
═══════════════════════════════════════════════════════════════════════════ */

// Melbourne Grand Prix Circuit (Albert Park, Australia) — 5.278 km
// Coordinates fit in a 640×420 viewBox
const TRACK_D =
  'M 460,240 ' +
  'L 460,95 ' +
  'C 460,70 445,55 420,55 ' +
  'C 395,55 375,70 360,85 ' +
  'C 340,105 310,100 285,90 ' +
  'C 260,80 240,100 230,130 ' +
  'C 220,160 235,185 245,210 ' +
  'C 255,235 230,255 195,265 ' +
  'C 165,275 145,305 140,340 ' +
  'C 135,370 160,390 195,392 ' +
  'L 330,390 ' +
  'C 365,390 400,385 425,370 ' +
  'C 450,355 460,325 460,290 ' +
  'L 460,240 Z';

// Chatter lines that scroll while analyzing
const RADIO_CHATTER = [
  '"Box this lap, box this lap."',
  '"Copy, understood. Pushing now."',
  '"Tyres are in the optimal window."',
  '"Gap to P2 is 1.4, 1.4."',
  '"DRS enabled — attack, attack."',
  '"Sector two looks very clean."',
  '"Fuel delta nominal, you\'re good."',
  '"Safety car in — box, box, box!"',
  '"Engine mode eleven, eleven."',
  '"Brake bias: front minus two."',
  '"Undercut window is opening."',
  '"We are investigating the issue."',
];

/* ── Lap timer that counts up ── */
function LapTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
  const t = Math.floor((elapsed % 1000) / 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>Analysis Time</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 700, color: '#E80020', letterSpacing: '.04em', lineHeight: 1 }}>
        {m}:{s}.<span style={{ fontSize: 20 }}>{t}</span>
      </div>
    </div>
  );
}

/* ── Flickering telemetry number ── */
function Gauge({ label, base, spread = 8, unit, color = '#00D2BE' }) {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const id = setInterval(
      () => setVal(Math.round(base + (Math.random() - 0.5) * spread)),
      280 + Math.random() * 140
    );
    return () => clearInterval(id);
  }, [base, spread]);
  return (
    <div style={{ textAlign: 'center', minWidth: 58 }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{unit}</div>
    </div>
  );
}

/* ── Sector split LEDs ── */
function SectorLEDs() {
  const [lit, setLit] = useState(-1);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setLit(i % 4 === 3 ? -1 : i % 4);
      i++;
    }, 900);
    return () => clearInterval(id);
  }, []);
  const COLORS = ['#22c55e', '#f59e0b', '#a855f7'];
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {COLORS.map((c, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: lit === i ? c : 'rgba(255,255,255,0.1)',
          boxShadow: lit === i ? `0 0 8px ${c}` : 'none',
          transition: 'all .2s ease',
        }} />
      ))}
    </div>
  );
}

/* ── Scrolling radio chatter ── */
function RadioFeed() {
  const [lines, setLines] = useState([RADIO_CHATTER[0], RADIO_CHATTER[1]]);
  useEffect(() => {
    let idx = 2;
    const id = setInterval(() => {
      setLines((prev) => [...prev.slice(-2), RADIO_CHATTER[idx % RADIO_CHATTER.length]]);
      idx++;
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10,
          color: i === lines.length - 1 ? '#00D2BE' : 'rgba(255,255,255,0.3)',
          letterSpacing: '.04em',
          transition: 'color .3s',
        }}>
          {l}
        </div>
      ))}
    </div>
  );
}

/* ── Animated speedometer ── */
function Speedo() {
  const CORNERS = [310, 290, 130, 275, 320, 240, 170, 315, 295, 90, 255, 312];
  const targetRef = useRef(310);
  const [speed, setSpeed] = useState(310);
  useEffect(() => {
    let i = 0;
    const switchId = setInterval(() => {
      targetRef.current = CORNERS[i % CORNERS.length]; i++;
    }, 1300);
    const animId = setInterval(() => {
      setSpeed(s => Math.round(s + (targetRef.current - s) * 0.2));
    }, 45);
    return () => { clearInterval(switchId); clearInterval(animId); };
  }, []);
  const c = speed > 270 ? '#E80020' : speed > 200 ? '#f59e0b' : '#00D2BE';
  return (
    <div style={{ textAlign: 'center', minWidth: 65 }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Speed</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: c, lineHeight: 1, transition: 'color .3s' }}>{speed}</div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>km/h</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Overlay Component
═══════════════════════════════════════════════════════════════════════════ */
export default function F1TrackLoader({
  visible,
  driverCode = 'VER',
  driverNumber = '33',
  onClose,
  onDismiss,
}) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(visible);

  const handleClose = onClose || onDismiss;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const id = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 300);
      return () => clearTimeout(id);
    }
  }, [visible, mounted]);

  useEffect(() => {
    if (!mounted || !handleClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, handleClose]);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 5, 12, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        animation: closing
          ? 'ftl-fade-out .28s cubic-bezier(0.4,0,1,1) forwards'
          : 'ftl-fade-in .32s cubic-bezier(0,0,0.2,1) forwards',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes ftl-fade-in  { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes ftl-fade-out { from { opacity: 1; transform: scale(1); }   to { opacity: 0; transform: scale(.96); } }
        @keyframes ftl-pulse    { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        @keyframes ftl-spin     { to { transform: rotate(360deg); } }
        @keyframes ftl-scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      {/* Close button in top-right */}
      {handleClose && (
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            zIndex: 10000,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 4,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(232, 0, 32, 0.5)';
            e.currentTarget.style.borderColor = '#E80020';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          ESC / CLOSE ✕
        </button>
      )}

      {/* CRT scanline effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
          opacity: 0.7,
        }}
      />

      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, transparent, #E80020, #00D2BE, transparent)',
        }}
      />

      {/* Corner brackets */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => {
        const [v, h] = pos.split('-');
        return (
          <div
            key={pos}
            style={{
              position: 'absolute',
              [v]: 18,
              [h]: 18,
              width: 14,
              height: 14,
              borderTop: v === 'top' ? '2px solid #E80020' : 'none',
              borderBottom: v === 'bottom' ? '2px solid #E80020' : 'none',
              borderLeft: h === 'left' ? '2px solid #E80020' : 'none',
              borderRight: h === 'right' ? '2px solid #E80020' : 'none',
              opacity: 0.6,
            }}
          />
        );
      })}

      {/* ── Main card ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          maxWidth: 640,
          width: '90vw',
          padding: '24px 32px',
          background: 'rgba(12, 12, 24, 0.85)',
          border: '1px solid rgba(232,0,32,0.25)',
          borderRadius: 6,
          boxShadow: '0 0 60px rgba(232,0,32,0.12), 0 24px 48px rgba(0,0,0,0.7)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>
            Pit-Wall Telemetry · Track Simulation
          </div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', color: '#fff' }}>
            <span style={{ color: '#E80020' }}>ALBERT PARK</span> CIRCUIT · MELBOURNE
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 5, letterSpacing: '.08em' }}>
            Formula 1 Australian Grand Prix · Live Physics Track Sim
          </div>
        </div>

        {/* Melbourne Albert Park circuit SVG */}
        <div style={{ position: 'relative' }}>
          <svg
            viewBox="80 20 480 390"
            width={520}
            height={360}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <filter id="ftl-glow-red" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="ftl-glow-soft" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="ftl-exhaust" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="6"/>
              </filter>

              <path id="ftl-car-path" d={TRACK_D} />
            </defs>

            {/* Track layers */}
            <path d={TRACK_D} fill="none" stroke="rgba(232,0,32,0.18)" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round"/>
            <path d={TRACK_D} fill="none" stroke="#1f233a" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round"/>
            <path d={TRACK_D} fill="none" stroke="rgba(0,210,190,0.4)" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 15"/>
            <path d={TRACK_D} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 10" />

            {/* ── Kerb markers at key corners ── */}
            {[
              [445, 65],   // Turn 1 Jones entry
              [360, 85],   // Turn 2 Jones exit
              [285, 90],   // Turn 3 Sports Centre
              [245, 210],  // Turn 6 Marina
              [140, 340],  // Turn 9/10 Clark Chicane
              [425, 370],  // Turn 15 Prost Hairpin
            ].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r={7} fill="none"
                  stroke="rgba(232,0,32,0.6)" strokeWidth={2}/>
                <circle cx={cx} cy={cy} r={2.5} fill="rgba(232,0,32,0.5)"/>
              </g>
            ))}

            {/* ── Sector markers ── */}
            {[
              { x: 285, y: 90,  label: 'S1', color: '#22c55e' },
              { x: 140, y: 340, label: 'S2', color: '#f59e0b' },
              { x: 365, y: 390, label: 'S3', color: '#a855f7' },
            ].map(({ x, y, label, color }) => (
              <g key={label}>
                <circle cx={x} cy={y} r={11}
                  fill={`${color}33`} stroke={color} strokeWidth={1.5}/>
                <text x={x} y={y + 3.5} fill={color} fontSize={8}
                  fontFamily="JetBrains Mono,monospace"
                  textAnchor="middle" fontWeight="700">{label}</text>
              </g>
            ))}

            {/* ── Pit lane & S/F line ── */}
            <line x1={450} y1={240} x2={470} y2={240}
              stroke="#fff" strokeWidth={3}
              strokeDasharray="3 3"/>
            <text x={478} y={243} fill="#fff"
              fontSize={8} fontFamily="JetBrains Mono,monospace"
              fontWeight="700" letterSpacing=".08em">S/F</text>
            <text x={425} y={243} fill="#E80020"
              fontSize={8} fontFamily="JetBrains Mono,monospace"
                fontWeight="700" letterSpacing=".06em">PIT ›</text>

            {/* Circuit name watermark */}
            <text x={300} y={230} fill="rgba(255,255,255,0.06)"
              fontSize={44} fontFamily="Barlow Condensed,sans-serif"
              fontWeight={900} textAnchor="middle"
              letterSpacing=".08em" transform="rotate(-12,300,230)">MELBOURNE</text>

            {/* ── Animated F1 car using animateMotion ── */}
            <g filter="url(#ftl-exhaust)" opacity={0.7}>
              <ellipse rx={10} ry={4} fill="#FF6000">
                <animateMotion dur="3.6s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#ftl-car-path"/>
                </animateMotion>
              </ellipse>
            </g>

            {/* Car body group */}
            <g filter="url(#ftl-glow-red)">
              <g opacity={0.4}>
                <ellipse cx={-5} cy={3} rx={14} ry={6} fill="rgba(0,0,0,0.8)">
                  <animateMotion dur="3.6s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#ftl-car-path"/>
                  </animateMotion>
                </ellipse>
              </g>

              {/* Main car */}
              <g>
                <rect x={-13} y={-4} width={6} height={8} rx={0.8} fill="#C80010" opacity={0.95}/>
                <rect x={-10} y={-3} width={18} height={6} rx={1.5} fill="#E80020"/>
                <ellipse rx={9} ry={3.5} fill="#E80020"/>
                <ellipse cx={1} cy={-1} rx={4} ry={2.2} fill="#0a0818"/>
                <circle cx={1} cy={-1.5} r={2.2} fill="#ff3555"/>
                <circle cx={1.5} cy={-2} r={0.8} fill="rgba(255,255,255,0.4)"/>
                <path d="M 9,-1.5 L 14,0 L 9,1.5" fill="#C80010" opacity={0.9}/>
                <rect x={10} y={-3} width={5} height={6} rx={0.6} fill="#C80010"/>
                <rect x={-2} y={-1} width={5} height={2} rx={0.5} fill="rgba(255,255,255,0.15)"/>
                <text x={0} y={0.8} fill="white" fontSize={1.8}
                  fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">hp</text>

                {/* Tyres */}
                {[[-7, -4], [-7, 4], [6, -4], [6, 4]].map(([tx, ty], i) => (
                  <g key={i}>
                    <circle cx={tx} cy={ty} r={2.8} fill="#0d0d0d" stroke="#222" strokeWidth={0.4}/>
                    <circle cx={tx} cy={ty} r={1.4} fill="#1a1a1a"/>
                    <circle cx={tx} cy={ty} r={2.2} fill="none" stroke="#f59e0b" strokeWidth={0.5} opacity={0.7}/>
                  </g>
                ))}

                <circle cx={-7} cy={-4} r={1.8} fill="rgba(255,100,0,0.85)"/>
                <circle cx={-7} cy={4}  r={1.8} fill="rgba(255,100,0,0.85)"/>

                <animateMotion dur="3.6s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#ftl-car-path"/>
                </animateMotion>
              </g>
            </g>
          </svg>

          {/* Lap counter badge */}
          <div style={{
            position: 'absolute', top: 8, right: 8,
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10, color: 'rgba(255,255,255,0.7)',
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(0,210,190,0.3)',
            padding: '4px 10px', borderRadius: 4,
            letterSpacing: '.08em',
          }}>Albert Park Circuit · Melbourne · 5.278 km</div>
        </div>

        {/* ── Telemetry strip ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '10px 20px',
          background: 'rgba(8,8,18,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 4,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <LapTimer />
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }}/>
          <Speedo />
          <Gauge label="Throttle" base={92} spread={6} unit="%" color="#22c55e"/>
          <Gauge label="Brake" base={14} spread={10} unit="%" color="#f59e0b"/>
          <Gauge label="Gear" base={7} spread={1} unit="G" color="#00D2BE"/>
          <Gauge label="RPM" base={11800} spread={400} unit="rpm" color="#a855f7"/>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }}/>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Sectors</div>
            <SectorLEDs/>
          </div>
        </div>

        {/* ── Radio chatter feed ── */}
        <RadioFeed/>

        {/* ── Pulsing dots progress ── */}
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#E80020',
              animation: `ftl-dot ${1.2}s ${i * 0.18}s ease-in-out infinite`,
            }}/>
          ))}
        </div>

      </div>

      {/* Injected keyframes */}
      <style>{`
        @keyframes ftl-dot {
          0%, 80%, 100% { opacity:.18; transform:scale(.75); }
          40%  { opacity:1; transform:scale(1.35); box-shadow:0 0 10px #E80020; }
        }
      `}</style>
    </div>
  );
}
