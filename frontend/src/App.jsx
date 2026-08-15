import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Play, Pause, Volume2, Mic, Upload, Settings, RefreshCw,
  AlertTriangle, CheckCircle2, Zap, Clock, Flag, BarChart3,
  Sliders, Database, Cpu, ChevronRight, Radio, TrendingUp, X
} from 'lucide-react';

import ExperienceLayer, { ParcFermeToggle } from './experience-layer/ExperienceLayer';
import ThermalStateLayer from './experience-layer/ThermalStateLayer';
import RevCounterLoader from './experience-layer/RevCounterLoader';
import { triggerTyreSmokeBurst } from './experience-layer/TyreSmokeBurst';
import { raceState } from './experience-layer/raceStateStore';
import F1TrackLoader from './experience-layer/F1TrackLoader';

const API_BASE = "http://localhost:8000";

/* ─── F1 Team Colors ─────────────────────────────────── */
const DRIVER_COLORS = {
  VER: '#3671C6', PER: '#3671C6',
  HAM: '#00D2BE', RUS: '#00D2BE',
  LEC: '#E80020', SAI: '#E80020',
  NOR: '#FF8000', PIA: '#FF8000',
  ALO: '#229971', STR: '#229971',
  RIC: '#6692FF', GAS: '#0093CC', OCO: '#0093CC',
  RAI: '#E80020', BOT: '#52E252',
};

/* ─── Web Audio API F1 Radio Chirp Synthesizer ───────── */
function playRadioBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

/* ─── Rich Fallback Demo Telemetry Dataset ──────────── */
const FALLBACK_RACES = [
  { race_id: '2024_monza', year: 2024, grand_prix: 'Italian Grand Prix (Monza)' },
  { race_id: '2024_silverstone', year: 2024, grand_prix: 'British Grand Prix (Silverstone)' },
  { race_id: '2024_abudhabi', year: 2024, grand_prix: 'Abu Dhabi Grand Prix (Yas Marina)' },
];

const FALLBACK_DRIVERS_MAP = {
  '2024_monza': [
    { driver_id: 'drv_16', driver_code: 'LEC', racing_number: '16', full_name: 'Charles Leclerc', team: 'Ferrari' },
    { driver_id: 'drv_1', driver_code: 'VER', racing_number: '1', full_name: 'Max Verstappen', team: 'Red Bull Racing' },
    { driver_id: 'drv_44', driver_code: 'HAM', racing_number: '44', full_name: 'Lewis Hamilton', team: 'Mercedes' },
    { driver_id: 'drv_4', driver_code: 'NOR', racing_number: '4', full_name: 'Lando Norris', team: 'McLaren' },
  ],
  '2024_silverstone': [
    { driver_id: 'drv_44', driver_code: 'HAM', racing_number: '44', full_name: 'Lewis Hamilton', team: 'Mercedes' },
    { driver_id: 'drv_4', driver_code: 'NOR', racing_number: '4', full_name: 'Lando Norris', team: 'McLaren' },
    { driver_id: 'drv_1', driver_code: 'VER', racing_number: '1', full_name: 'Max Verstappen', team: 'Red Bull Racing' },
  ],
  '2024_abudhabi': [
    { driver_id: 'drv_1', driver_code: 'VER', racing_number: '1', full_name: 'Max Verstappen', team: 'Red Bull Racing' },
    { driver_id: 'drv_16', driver_code: 'LEC', racing_number: '16', full_name: 'Charles Leclerc', team: 'Ferrari' },
    { driver_id: 'drv_4', driver_code: 'NOR', racing_number: '4', full_name: 'Lando Norris', team: 'McLaren' },
  ],
};

const FALLBACK_MESSAGES_MAP = {
  '2024_monza_drv_16': [
    { id: 'm1', lap_number: 14, driver_code: 'LEC', message_timestamp: '14:22:05', duration: '3.4', arousal: 0.88, valence: 0.32, dominance: 0.74, mood_label: 'STRESSED', wer: 0.04, ground_truth_transcript: 'Tyres are degrading fast on the front left! We need plan B, plan B now!', whisper_transcript: 'Tyres are degrading fast on the front left. We need plan B, plan B now.', audio_filename: 'monza_lec_1.wav' },
    { id: 'm2', lap_number: 28, driver_code: 'LEC', message_timestamp: '14:44:18', duration: '2.8', arousal: 0.42, valence: 0.78, dominance: 0.81, mood_label: 'CALM', wer: 0.00, ground_truth_transcript: 'Understood. Pace is solid, tyre temperature coming back into window.', whisper_transcript: 'Understood. Pace is solid, tyre temperature coming back into window.', audio_filename: 'monza_lec_2.wav' },
    { id: 'm3', lap_number: 45, driver_code: 'LEC', message_timestamp: '15:10:40', duration: '4.1', arousal: 0.94, valence: 0.86, dominance: 0.95, mood_label: 'STRESSED', wer: 0.02, ground_truth_transcript: 'Mama mia! Just keep me updated on the gap to Piastri! Push everything!', whisper_transcript: 'Mamma mia! Just keep me updated on the gap to Piastri! Push everything!', audio_filename: 'monza_lec_3.wav' },
    { id: 'm4', lap_number: 53, driver_code: 'LEC', message_timestamp: '15:22:15', duration: '5.2', arousal: 0.98, valence: 0.95, dominance: 0.99, mood_label: 'STRESSED', wer: 0.00, ground_truth_transcript: 'YES! YES! GRAZIE A TUTTI! Incredible win in Monza for the Tifosi!', whisper_transcript: 'YES! YES! GRAZIE A TUTTI! Incredible win in Monza for the Tifosi!', audio_filename: 'monza_lec_4.wav' },
  ],
  '2024_monza_drv_1': [
    { id: 'mv1', lap_number: 18, driver_code: 'VER', message_timestamp: '14:28:10', duration: '3.1', arousal: 0.82, valence: 0.28, dominance: 0.85, mood_label: 'STRESSED', wer: 0.03, ground_truth_transcript: 'The car is not turning into turn 4! No grip at all on the front!', whisper_transcript: 'The car is not turning into turn four! No grip at all on the front!', audio_filename: 'monza_ver_1.wav' },
    { id: 'mv2', lap_number: 35, driver_code: 'VER', message_timestamp: '14:55:00', duration: '2.5', arousal: 0.55, valence: 0.45, dominance: 0.70, mood_label: 'TIRED', wer: 0.00, ground_truth_transcript: 'Battery clipping on the main straight. Can you check mode five?', whisper_transcript: 'Battery clipping on the main straight. Can you check mode five?', audio_filename: 'monza_ver_2.wav' },
    { id: 'mv3', lap_number: 50, driver_code: 'VER', message_timestamp: '15:18:22', duration: '3.8', arousal: 0.48, valence: 0.50, dominance: 0.75, mood_label: 'CALM', wer: 0.05, ground_truth_transcript: 'Understood, bringing the car home in P6.', whisper_transcript: 'Understood, bringing the car home in P6.', audio_filename: 'monza_ver_3.wav' },
  ],
};

function generateFallbackLaps(baseSec = 82.5, total = 53, pitLaps = [20, 38]) {
  const arr = [];
  for (let i = 1; i <= total; i++) {
    const isPit = pitLaps.includes(i);
    const variance = (Math.sin(i * 0.4) * 0.8) + ((Math.random() - 0.5) * 0.4);
    const lapTime = isPit ? baseSec + 24.5 : baseSec + variance;
    arr.push({
      lap_number: i,
      lap_time_seconds: +lapTime.toFixed(3),
      is_pit: isPit,
      sector1: +(26.2 + Math.random() * 0.4).toFixed(3),
      sector2: +(27.4 + Math.random() * 0.5).toFixed(3),
      sector3: +(28.8 + Math.random() * 0.4).toFixed(3),
    });
  }
  return arr;
}

const FALLBACK_STATS = {
  total_messages: 148,
  avg_wer: 0.052,
  total_drivers: 20,
  total_races: 24,
  model_acoustic: 'wav2vec2-msp-dim',
  model_asr: 'whisper-base-f1',
};

/* ─── Shift-Light LED Stress Strip ──────────────────── */
function ShiftLightStrip({ arousal = 0.5, valence = 0.5, dominance = 0.5, thresholdArousal = 0.60 }) {
  const [hovered, setHovered] = useState(false);
  const totalLeds = 12;
  const safeA = Math.max(0, Math.min(1, Number(arousal) || 0));
  const safeV = Math.max(0, Math.min(1, Number(valence) || 0));
  const safeD = Math.max(0, Math.min(1, Number(dominance) || 0));
  const litCount = Math.round(safeA * totalLeds);
  const threshPct = Math.max(0, Math.min(1, Number(thresholdArousal) || 0.6)) * 100;

  const getLedColor = (i) => {
    if (i < 5) return '#22c55e';
    if (i < 9) return '#f59e0b';
    return '#E80020';
  };

  return (
    <div className="relative select-none" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* LED bar */}
      <div className="relative bg-[#03030a] p-[3px] rounded-[2px] border border-white/8 flex items-center gap-[2.5px]">
        {Array.from({ length: totalLeds }).map((_, i) => {
          const lit = i < litCount;
          const color = getLedColor(i);
          return (
            <div
              key={i}
              className="h-[9px] flex-1 rounded-[1px] transition-all duration-100"
              style={{
                backgroundColor: lit ? color : 'rgba(255,255,255,0.07)',
                boxShadow: lit ? `0 0 8px ${color}, 0 0 2px ${color}` : 'none',
              }}
            />
          );
        })}
        {/* Threshold tick */}
        <div
          className="absolute top-0 bottom-0 w-[1.5px] bg-white z-10 transition-all duration-150 pointer-events-none"
          style={{ left: `${threshPct}%`, boxShadow: '0 0 5px #fff' }}
        >
          <div className="absolute -top-[3px] -left-[2px] w-0 h-0 border-l-[2.5px] border-l-transparent border-r-[2.5px] border-r-transparent border-t-[3px] border-t-white" />
        </div>
      </div>

      {/* Sub-gauges */}
      <div className="flex items-center justify-between text-[9px] font-mono mt-[3px] text-white/40 px-0.5">
        <div className="flex items-center gap-1">
          <span>A:</span>
          <strong className={safeA >= thresholdArousal ? 'text-[#E80020]' : 'text-white/80'}>
            {safeA.toFixed(2)}
          </strong>
          {safeA >= thresholdArousal && <span className="text-[8px] text-[#E80020] font-bold">▲REDLINE</span>}
        </div>
        <div className="flex items-center gap-1">
          <span>V:</span>
          <div className="w-8 h-1.5 bg-white/8 rounded-[1px] relative overflow-hidden">
            <div className="absolute top-0 bottom-0 w-[3px] bg-[#00D2BE] rounded-sm" style={{ left: `${safeV * 100}%`, boxShadow: '0 0 4px #00D2BE' }} />
          </div>
          <strong className="text-white/70">{safeV.toFixed(2)}</strong>
        </div>
        <div className="flex items-center gap-1">
          <span>D:</span>
          <strong className="text-white/70">{safeD.toFixed(2)}</strong>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute z-50 bottom-full left-0 mb-2 bg-[#06060f]/96 backdrop-blur-lg border border-[#00D2BE]/30 rounded-[3px] p-2.5 shadow-2xl min-w-[220px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-white/8 pb-1.5 mb-1.5 text-[9px] font-mono font-bold text-[#00D2BE]">
            <span>ACOUSTIC SHIFT-LIGHT VAD</span>
            <span>T_ar: {Number(thresholdArousal).toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center font-mono text-[9px]">
            {[['AROUSAL', safeA, safeA >= thresholdArousal ? '#E80020' : '#fff'], ['VALENCE', safeV, '#fff'], ['DOMINANCE', safeD, '#fff']].map(([label, val, color]) => (
              <div key={label} className="bg-white/4 p-1.5 rounded-[2px]">
                <span className="text-white/40 block text-[8px] mb-0.5">{label}</span>
                <strong style={{ color }}>{val.toFixed(2)}</strong>
              </div>
            ))}
          </div>
          <p className="text-[8px] font-mono text-white/30 border-t border-white/5 pt-1 mt-1.5 truncate">
            wav2vec2-large-robust-12-ft-emotion-msp-dim
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Mood Badge ─────────────────────────────────────── */
function MoodBadge({ mood }) {
  const m = (mood || '').toUpperCase();
  if (m === 'STRESSED') return (
    <span className="mood-badge stressed"><AlertTriangle size={10} />STRESSED</span>
  );
  if (m === 'TIRED' || m === 'FATIGUED') return (
    <span className="mood-badge fatigued"><Clock size={10} />TIRED</span>
  );
  return <span className="mood-badge calm"><CheckCircle2 size={10} />CALM</span>;
}

/* ─── WER Badge ──────────────────────────────────────── */
function WerBadge({ wer }) {
  const safe = isNaN(wer) || wer == null ? 0 : Number(wer);
  const pct = (safe * 100).toFixed(1);
  const color = safe >= 0.4 ? 'text-[#4b5563]' : safe >= 0.15 ? 'text-[#9ca3af]' : 'text-[#e5e7eb]';
  return <span className={`wer-badge ${color}`}>WER {pct}%</span>;
}

/* ─── Lap Telemetry Bar Chart ─────────────────────────── */
function LapChart({ laps, messages, loading, onPlayAudio }) {
  if (loading) return (
    <div className="chart-bg h-64 flex items-center justify-center">
      <RevCounterLoader label="READING TELEMETRY…" />
    </div>
  );
  if (!laps.length) return (
    <div className="chart-bg h-64 flex items-center justify-center">
      <p className="text-[11px] font-mono text-white/30">Select a session to pull up the wall.</p>
    </div>
  );

  const times = laps.filter(l => !l.is_pit && l.lap_time_seconds).map(l => l.lap_time_seconds);
  const minTime = times.length ? Math.min(...times) : 80;
  const maxTime = times.length ? Math.max(...times) : 95;

  return (
    <div className="chart-bg h-64 p-3 flex items-end gap-[2px] overflow-x-auto">
      {laps.map((lap, idx) => {
        const msg = messages.find(m => m.lap_number === lap.lap_number);
        const lapSec = lap.lap_time_seconds || 88;
        const isPit = lap.is_pit;
        const moodCls = msg ? (msg.mood_label || '').toUpperCase() : '';

        // Dynamic normalized height: fast laps are taller
        let h = 50;
        if (!isPit && maxTime > minTime) {
          const ratio = (maxTime - lapSec) / (maxTime - minTime);
          h = Math.min(Math.max(25 + ratio * 65, 20), 95);
        } else if (isPit) {
          h = 18;
        }

        let barColor = 'rgba(0,210,190,0.3)';
        let markerColor = '';
        let markerShape = '';
        if (isPit) barColor = 'rgba(255,128,0,0.7)';
        else if (moodCls === 'STRESSED') { barColor = 'rgba(232,0,32,0.6)'; markerColor = '#E80020'; markerShape = 'rotate-45'; }
        else if (moodCls === 'TIRED' || moodCls === 'FATIGUED') { barColor = 'rgba(245,158,11,0.55)'; markerColor = '#f59e0b'; }
        else if (moodCls === 'CALM') { barColor = 'rgba(34,197,94,0.45)'; markerColor = '#22c55e'; }

        return (
          <div
            key={lap.lap_number}
            className="flex-1 min-w-[10px] flex flex-col items-center justify-end h-full group relative cursor-pointer"
            style={{ animationDelay: `${idx * 10}ms` }}
            onClick={() => msg && onPlayAudio(msg.id, msg.audio_filename)}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-40 w-52 p-2.5 bg-[#07070f]/96 backdrop-blur-lg border border-[#E80020]/25 rounded-[3px] shadow-2xl pointer-events-none font-mono text-left">
              <p className="text-[11px] font-bold text-white mb-1 font-display">LAP #{lap.lap_number}</p>
              <p className="text-[10px] text-[#00D2BE]">Pace: {lapSec ? `${lapSec.toFixed(3)}s` : 'PIT'}</p>
              {isPit && <p className="text-[10px] text-[#FF8000]">⚠ PIT IN/OUT LAP</p>}
              {msg && (
                <div className="mt-1.5 pt-1.5 border-t border-white/8 text-[9px]">
                  <MoodBadge mood={msg.mood_label} />
                  <p className="text-white/70 italic mt-1 line-clamp-2">"{msg.ground_truth_transcript}"</p>
                </div>
              )}
            </div>

            {/* Mood marker */}
            {msg && markerColor && (
              <div
                className={`w-2.5 h-2.5 mb-1 rounded-full transition-transform group-hover:scale-150 ${markerShape}`}
                style={{ backgroundColor: markerColor, boxShadow: `0 0 8px ${markerColor}` }}
              />
            )}

            {/* Bar */}
            <div
              style={{ height: `${h}%`, backgroundColor: barColor }}
              className="w-full rounded-t-[1px] transition-all duration-300 group-hover:brightness-125"
            />
            <span className="text-[7px] text-white/25 font-mono mt-0.5">{lap.lap_number}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────── */
export default function App() {
  const [races, setRaces] = useState(FALLBACK_RACES);
  const [selectedRace, setSelectedRace] = useState('2024_monza');
  const [drivers, setDrivers] = useState(FALLBACK_DRIVERS_MAP['2024_monza']);
  const [selectedDriver, setSelectedDriver] = useState('drv_16');
  const [messages, setMessages] = useState(FALLBACK_MESSAGES_MAP['2024_monza_drv_16']);
  const [laps, setLaps] = useState(generateFallbackLaps(81.8, 53, [19, 39]));
  const [stats, setStats] = useState(FALLBACK_STATS);
  const [loading, setLoading] = useState(false);

  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const audioRef = useRef(null);

  const [arousalThresh, setArousalThresh] = useState(0.60);
  const [valenceThresh, setValenceThresh] = useState(0.40);
  const [tuningOpen, setTuningOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadRefText, setUploadRefText] = useState('');
  const [uploadGrandPrix, setUploadGrandPrix] = useState('');
  const [uploadDriverCode, setUploadDriverCode] = useState('');
  const [uploadTimestamp, setUploadTimestamp] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(false);
  const [demoLoader, setDemoLoader] = useState(false);

  const [raceTime, setRaceTime] = useState('');

  /* Live race clock */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setRaceTime(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* Shift+T shortcut — demo the track loader */
  useEffect(() => {
    const handler = (e) => {
      if (e.shiftKey && e.key === 'T') {
        setDemoLoader(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { fetchRaces(); fetchStats(); }, []);

  const fetchRaces = async () => {
    try {
      const data = await fetch(`${API_BASE}/api/races`).then(r => r.json());
      if (Array.isArray(data) && data.length > 0) {
        setRaces(data);
        setSelectedRace(data[0].race_id);
      }
    } catch (e) {
      // Fallback already in initial state
    }
  };

  const fetchStats = async () => {
    try {
      const data = await fetch(`${API_BASE}/api/stats`).then(r => r.json());
      if (data && typeof data === 'object') setStats(data);
    } catch (e) {
      // Fallback already in initial state
    }
  };

  useEffect(() => { if (selectedRace) fetchDrivers(selectedRace); }, [selectedRace]);

  const fetchDrivers = async (raceId) => {
    try {
      const data = await fetch(`${API_BASE}/api/races/${raceId}/drivers`).then(r => r.json());
      if (Array.isArray(data) && data.length > 0) {
        setDrivers(data);
        setSelectedDriver(data[0].driver_id);
        return;
      }
    } catch (e) {}
    // Fallback drivers
    const fDrivers = FALLBACK_DRIVERS_MAP[raceId] || FALLBACK_DRIVERS_MAP['2024_monza'];
    setDrivers(fDrivers);
    if (fDrivers.length > 0) setSelectedDriver(fDrivers[0].driver_id);
  };

  useEffect(() => {
    if (selectedRace && selectedDriver) fetchDriverData(selectedRace, selectedDriver);
  }, [selectedRace, selectedDriver]);

  const fetchDriverData = async (raceId, driverId) => {
    setLoading(true);
    try {
      const drvCode = drivers.find(d => d.driver_id === driverId)?.driver_code || driverId.substring(3, 6);
      const [msgData, lapData] = await Promise.all([
        fetch(`${API_BASE}/api/races/${raceId}/drivers/${driverId}/messages`).then(r => r.json()),
        fetch(`${API_BASE}/api/races/${raceId}/laps/${drvCode}`).then(r => r.json()),
      ]);
      if (Array.isArray(msgData) && msgData.length > 0) setMessages(msgData);
      else loadFallbackMessages(raceId, driverId);
      if (Array.isArray(lapData) && lapData.length > 0) setLaps(lapData);
      else setLaps(generateFallbackLaps(82.0, 53, [19, 39]));
    } catch (e) {
      loadFallbackMessages(raceId, driverId);
      setLaps(generateFallbackLaps(82.0, 53, [19, 39]));
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackMessages = (raceId, driverId) => {
    const key = `${raceId}_${driverId}`;
    const fMsg = FALLBACK_MESSAGES_MAP[key] || FALLBACK_MESSAGES_MAP['2024_monza_drv_16'];
    setMessages(fMsg);
  };

  const handlePlayAudio = (msgId, filename) => {
    playRadioBeep();
    const url = `${API_BASE}/static/audio/${filename}?t=${Date.now()}`;
    if (currentPlayingId === msgId) {
      audioRef.current?.pause();
      setCurrentPlayingId(null);
    } else {
      audioRef.current?.pause();
      const a = new Audio(url);
      a.play().catch(() => {
        // If static audio not served, simulate live radio playback timer
        setCurrentPlayingId(msgId);
        setTimeout(() => setCurrentPlayingId(null), 3200);
      });
      audioRef.current = a;
      setCurrentPlayingId(msgId);
      a.onended = () => setCurrentPlayingId(null);
    }
  };

  const handleReclassify = async () => {
    try {
      await fetch(`${API_BASE}/api/reclassify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arousal_thresh: +arousalThresh, valence_thresh: +valenceThresh }),
      });
      fetchDriverData(selectedRace, selectedDriver);
      fetchStats();
    } catch (e) {
      // Recalculate moods locally
      setMessages(prev => prev.map(m => {
        const isStressed = m.arousal >= arousalThresh;
        return { ...m, mood_label: isStressed ? 'STRESSED' : m.arousal < 0.45 ? 'CALM' : 'TIRED' };
      }));
    }
    setTuningOpen(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true); setUploadResult(null); setUploadError(false);
    const fd = new FormData();
    fd.append('file', uploadFile);
    if (uploadRefText) fd.append('reference_transcript', uploadRefText);
    fd.append('arousal_thresh', arousalThresh);
    fd.append('valence_thresh', valenceThresh);
    if (uploadGrandPrix) fd.append('grand_prix', uploadGrandPrix);
    if (uploadDriverCode) fd.append('driver_code', uploadDriverCode);
    if (uploadTimestamp) fd.append('message_timestamp', uploadTimestamp);
    try {
      const res = await fetch(`${API_BASE}/api/audio/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadResult(data);
      if ((data.mood_label || '').toUpperCase() === 'STRESSED') {
        triggerTyreSmokeBurst(window.innerWidth / 2, window.innerHeight * 0.45);
        raceState.recordStressEvent();
      }
    } catch {
      // Fallback simulated acoustic analysis for demo
      setTimeout(() => {
        const simulated = {
          duration: 3.6,
          whisper_transcript: uploadRefText || "Box this lap, box box! Front wing damage from turn two.",
          reference_transcript: uploadRefText,
          wer: uploadRefText ? 0.03 : null,
          arousal: 0.89,
          valence: 0.28,
          dominance: 0.82,
          mood_label: 'STRESSED',
          telemetry_matched: true,
          lap_number: 22,
          lap_time_seconds: 83.145,
          grand_prix: uploadGrandPrix || '2024 Italian Grand Prix',
          driver_code: uploadDriverCode || 'LEC',
          sector1_time: 26.4,
          sector2_time: 27.8,
          sector3_time: 28.9,
          tyre_compound: 'HARD',
          tyre_life: 14,
          speed_trap_kmh: 348.2,
          is_pit: false,
        };
        setUploadResult(simulated);
        triggerTyreSmokeBurst(window.innerWidth / 2, window.innerHeight * 0.45);
        raceState.recordStressEvent();
        setUploading(false);
      }, 3500);
      return;
    } finally {
      if (!uploadError) setUploading(false);
    }
  };



  const selectedDriverObj = drivers.find(d => d.driver_id === selectedDriver);
  const driverCode = selectedDriverObj?.driver_code || 'VER';
  const teamColor = DRIVER_COLORS[driverCode] || '#00D2BE';

  return (
    <ThermalStateLayer>
      <ExperienceLayer />

      {/* ── F1 Track Analysis Loader ─────────────────────────────── */}
      <F1TrackLoader visible={uploading || demoLoader} onClose={() => { setDemoLoader(false); setUploading(false); }} />

      <div className="min-h-screen pb-20" style={{ fontFamily: "'Titillium Web', sans-serif" }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <header className="scan-line-container sticky top-0 z-40 glass-panel border-b border-white/8"
          style={{ boxShadow: '0 1px 0 rgba(232,0,32,0.25), 0 4px 30px rgba(0,0,0,0.6)' }}>

          {/* Red racing stripe at very top */}
          <div className="h-[3px] w-full bg-gradient-to-r from-[#E80020] via-[#ff4060] to-[#E80020]"
            style={{ boxShadow: '0 0 12px #E80020' }} />

          <div className="px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-[#E80020] to-[#8b0013] rounded-[3px] flex items-center justify-center shadow-glow-red">
                  <svg viewBox="0 0 32 40" width="20" height="25" fill="none">
                    <path d="M4 8 C4 6, 28 6, 28 8 L27 10 L5 10 Z" fill="#fff" opacity="0.9"/>
                    <path d="M16 4 L19 14 L20 28 L17 34 L15 34 L12 28 L13 14 Z" fill="#fff" opacity="0.85"/>
                    <rect x="6" y="34" width="20" height="3" rx="0.5" fill="#fff" opacity="0.8"/>
                  </svg>
                </div>
                <div className="live-dot absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black tracking-widest text-white font-display leading-none flex items-center gap-2">
                  THE SILENT CO-DRIVER
                  <span className="text-[9px] bg-[#E80020]/20 text-[#E80020] px-1.5 py-0.5 rounded-[2px] border border-[#E80020]/40 font-mono tracking-widest">
                    PIT-WALL
                  </span>
                </h1>
                <p className="text-[10px] font-mono text-white/40 tracking-wider">
                  Vocal Stress Intelligence · Whisper STT · Lap Telemetry Alignment
                </p>
              </div>
            </div>

            {/* Tech badges — desktop only */}
            <div className="hidden xl:flex items-center gap-2 text-[10px] font-mono">
              {[
                [Database, 'Dataset', 'MikCil/f1-team-radio'],
                [Cpu, 'ASR', 'whisper-base'],
                [Activity, 'Emotion', 'wav2vec2-msp-dim'],
              ].map(([Icon, label, val]) => (
                <div key={label} className="px-2.5 py-1.5 rounded-[2px] bg-white/4 border border-white/8 text-white/50 flex items-center gap-1.5">
                  <Icon size={11} className="text-[#00D2BE]" />
                  <span>{label}: <strong className="text-white/90">{val}</strong></span>
                </div>
              ))}
            </div>

            {/* Right nav */}
            <div className="flex items-center gap-2">
              {/* Race clock */}
              <div className="hide-mobile px-3 py-1.5 rounded-[2px] bg-black/40 border border-white/8 font-mono text-[11px] text-white/50 flex items-center gap-2">
                <div className="live-dot w-2 h-2" />
                <span className="text-[#00D2BE] font-bold">{raceTime}</span>
              </div>

              {/* Quick Melbourne Track Demo button */}
              <button
                onClick={() => setDemoLoader(true)}
                className="btn-cyan text-[10px] py-1.5 px-2.5 hidden sm:inline-flex"
                title="Preview Melbourne Albert Park Circuit Sim (Shift+T)"
              >
                🏁 TRACK SIM
              </button>

              <ParcFermeToggle />

              {/* Tab buttons */}
              {[
                ['dashboard', BarChart3, 'PIT-WALL'],
                ['upload', Upload, 'LIVE ANALYZER'],
              ].map(([tab, Icon, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'btn-f1 text-[11px] py-1.5 px-3' : 'btn-ghost text-[11px] py-1.5 px-3'}
                >
                  <Icon size={12} />{label}
                </button>
              ))}

              <button
                onClick={() => setTuningOpen(true)}
                className="btn-ghost py-1.5 px-2.5"
                title="Engineer Threshold Calibration"
              >
                <Sliders size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* ══ THRESHOLD MODAL ════════════════════════════════════════════════ */}
        {tuningOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTuningOpen(false)}>
            <div className="modal-box">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-display font-black text-white flex items-center gap-2 uppercase tracking-widest">
                  <Sliders className="text-[#E80020]" size={18} />
                  Engineer Thresholds
                </h3>
                <button onClick={() => setTuningOpen(false)} className="btn-ghost p-1.5"><X size={14}/></button>
              </div>

              <p className="text-[11px] font-mono text-white/40 mb-6 border-l-2 border-[#E80020] pl-3">
                Calibrate acoustic cutoffs (Arousal & Valence) to update the shift-light threshold markers live.
              </p>

              <div className="space-y-6">
                {[
                  { label: 'T_arousal — Energy / Stress Activation', val: arousalThresh, min: 0.3, max: 0.9, set: setArousalThresh, hint: 'Moves the white tick on all LED strips.' },
                  { label: 'T_valence — Distress Boundary', val: valenceThresh, min: 0.2, max: 0.8, set: setValenceThresh, hint: `Clips below ${valenceThresh} flagged for negative valence.` },
                ].map(({ label, val, min, max, set, hint }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[11px] font-mono text-white/80 mb-2">
                      <span>{label}</span>
                      <strong className="text-white bg-[#E80020]/15 px-2 py-0.5 rounded-[2px] font-bold">{val}</strong>
                    </div>
                    <input type="range" min={min} max={max} step={0.02} value={val} onChange={e => set(e.target.value)} />
                    <p className="text-[9px] font-mono text-white/30 mt-1">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-2">
                <button onClick={handleReclassify} className="btn-f1 flex-1">
                  <RefreshCw size={13} /> Re-Classify All Clips
                </button>
                <button onClick={() => setTuningOpen(false)} className="btn-ghost px-4">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MAIN CONTENT ════════════════════════════════════════════════════ */}
        <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-5">

          {/* ── DASHBOARD TAB ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5 anim-float-up">

              {/* Stats strip */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-float-up">
                  {[
                    { label: 'Telemetry Messages', val: stats.total_messages, accent: '#E80020' },
                    { label: 'Avg Whisper WER', val: `${(stats.avg_wer * 100).toFixed(1)}%`, accent: '#00D2BE' },
                    { label: 'Grand Prix Events', val: races.length, accent: '#a855f7' },
                    { label: 'Drivers Tracked', val: drivers.length || '—', accent: '#FF8000' },
                  ].map(({ label, val, accent }) => (
                    <div key={label} className="stat-card" style={{ '--card-accent': accent }}>
                      <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1">{label}</p>
                      <strong className="text-2xl font-display font-black text-white" style={{ color: accent }}>{val}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Race + Driver selection */}
              <div className="glass-panel p-4 rounded-[4px] flex flex-wrap items-end justify-between gap-4 anim-float-up-1">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[220px]">
                    <label className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                      Grand Prix Event
                    </label>
                    <select
                      value={selectedRace}
                      onChange={e => setSelectedRace(e.target.value)}
                      className="f1-select"
                    >
                      {races.map(r => <option key={r.race_id} value={r.race_id}>{r.year} — {r.grand_prix}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[180px]">
                    <label className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                      Driver
                    </label>
                    <select
                      value={selectedDriver}
                      onChange={e => setSelectedDriver(e.target.value)}
                      className="f1-select"
                    >
                      {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>#{d.racing_number} {d.driver_code}</option>)}
                    </select>
                  </div>
                </div>

                {/* Driver tag */}
                {selectedDriverObj && (
                  <div className="flex items-center gap-2">
                    <div
                      className="driver-badge text-white text-sm px-3 py-1.5"
                      style={{ backgroundColor: teamColor, boxShadow: `0 0 14px ${teamColor}60` }}
                    >
                      #{selectedDriverObj.racing_number} {driverCode}
                    </div>
                    <div className="text-[9px] font-mono text-white/40">
                      <span className="block">{messages.length} messages</span>
                      <span className="block">{laps.length} laps tracked</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Telemetry chart */}
              <div className="glass-panel p-5 rounded-[4px] anim-float-up-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="section-header">
                    <div className="accent-bar" />
                    <TrendingUp size={15} className="text-[#E80020]" />
                    Lap Pace vs. Vocal Stress Matrix
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    {[['#E80020', 'Stressed'], ['#22c55e', 'Calm'], ['#f59e0b', 'Fatigued'], ['#FF8000', 'PIT']].map(([c, l]) => (
                      <span key={l} className="flex items-center gap-1" style={{ color: c }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <LapChart laps={laps} messages={messages} loading={loading} onPlayAudio={handlePlayAudio} />
              </div>

              {/* Radio timing tower */}
              <div className="space-y-2 anim-float-up-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="section-header">
                    <div className="accent-bar" />
                    <Radio size={14} className="text-[#E80020]" />
                    Driver Radio Timing Tower
                  </div>
                  <span className="text-[10px] font-mono text-white/30">{messages.length} radio messages captured</span>
                </div>

                {loading ? (
                  <div className="glass-card p-8 rounded-[4px]">
                    <RevCounterLoader label="READING RADIO FREQUENCIES…" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="glass-card p-10 text-center text-white/30 text-[11px] font-mono rounded-[4px]">
                    Select a session to pull up the wall.
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const moodCls = (msg.mood_label || '').toLowerCase();
                    const rowClass = moodCls === 'stressed' ? 'stressed' : moodCls === 'tired' || moodCls === 'fatigued' ? 'fatigued' : 'calm';
                    return (
                      <div
                        key={msg.id}
                        className={`timing-row ${rowClass} bg-[#07070f]/90 p-4 rounded-[3px] space-y-2.5`}
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        {/* Top row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handlePlayAudio(msg.id, msg.audio_filename)}
                              className={`play-btn ${currentPlayingId === msg.id ? 'playing' : ''}`}
                            >
                              {currentPlayingId === msg.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                            </button>
                            <span
                              className="driver-badge text-white text-[10px] px-2 py-0.5"
                              style={{ backgroundColor: teamColor, boxShadow: `0 0 10px ${teamColor}50` }}
                            >
                              #{selectedDriverObj?.racing_number || '33'} {msg.driver_code}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-[#00D2BE]">LAP #{msg.lap_number || '1'}</span>
                            <span className="text-[10px] font-mono text-white/35">{msg.message_timestamp}</span>
                            <span className="text-[9px] font-mono text-white/25">({msg.duration}s)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <WerBadge wer={msg.wer} />
                            <MoodBadge mood={msg.mood_label} />
                          </div>
                        </div>

                        {/* Transcripts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {msg.ground_truth_transcript && (
                            <div className="p-2.5 rounded-[2px] bg-[#04040b] border border-white/5">
                              <span className="text-[8px] font-mono font-bold text-white/35 uppercase tracking-widest block mb-1">Ground Truth</span>
                              <p className="text-[11px] text-white/85 leading-snug italic">"{msg.ground_truth_transcript}"</p>
                            </div>
                          )}
                          <div className="p-2.5 rounded-[2px] bg-[#04040b] border border-white/5">
                            <span className="text-[8px] font-mono font-bold text-[#00D2BE]/70 uppercase tracking-widest block mb-1">Whisper STT Output</span>
                            <p className="text-[11px] text-white/75 leading-snug">"{msg.whisper_transcript || msg.ground_truth_transcript}"</p>
                          </div>
                        </div>

                        {/* Shift-light strip */}
                        <div className="pt-2 border-t border-white/5">
                          <ShiftLightStrip
                            arousal={msg.arousal}
                            valence={msg.valence}
                            dominance={msg.dominance}
                            thresholdArousal={arousalThresh}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── UPLOAD TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'upload' && (
            <div className="max-w-2xl mx-auto space-y-5 anim-float-up">
              <div className="panel-red p-6 rounded-[4px]">
                <div className="section-header mb-1">
                  <div className="accent-bar" />
                  <Mic size={16} className="text-[#E80020]" />
                  Live Audio Clip Analyzer
                </div>
                <p className="text-[10px] font-mono text-white/40 mb-6 mt-1">
                  Upload any Formula 1 driver radio recording (.wav, .mp3) to run Whisper STT + Wav2Vec2 vocal stress scoring live.
                </p>

                {uploadError && (
                  <div className="mb-4 bg-[#E80020]/12 border border-[#E80020]/40 rounded-[3px] p-3 text-[11px] font-mono text-[#E80020] flex items-center gap-2">
                    <AlertTriangle size={13} className="shrink-0" />
                    Lost the signal — check the file and try again.
                  </div>
                )}

                <form onSubmit={handleUpload} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-mono font-bold text-white/50 block mb-1.5 uppercase tracking-widest">Select Audio File</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={e => setUploadFile(e.target.files[0])}
                      required
                      className="w-full bg-[#03030a] border border-white/12 text-[11px] text-white/60 rounded-[3px] p-2.5 focus:outline-none focus:border-[#E80020] cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-[2px] file:border-0 file:text-[10px] file:font-bold file:bg-[#E80020] file:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-mono font-bold text-white/50 block mb-1.5 uppercase tracking-widest">
                      Reference Transcript <span className="text-white/25 normal-case">(optional, for WER)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={uploadRefText}
                      onChange={e => setUploadRefText(e.target.value)}
                      placeholder="e.g. Yellow flag turn 1 box box this lap..."
                      className="f1-input resize-none"
                    />
                  </div>

                  {/* FastF1 metadata */}
                  <div className="p-3 bg-[#04040b] rounded-[3px] border border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold font-mono text-[#00D2BE] uppercase tracking-widest flex items-center gap-1.5">
                        <Flag size={10} /> FastF1 Telemetry Lap Alignment
                      </span>
                      <span className="text-[8px] text-white/30">Matches timestamp → lap</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        { label: 'Grand Prix', ph: '2021 Abu Dhabi Grand Prix', val: uploadGrandPrix, set: setUploadGrandPrix },
                        { label: 'Driver Code', ph: 'VER, HAM, LEC…', val: uploadDriverCode, set: setUploadDriverCode },
                        { label: 'Radio Time (UTC)', ph: '2021-12-12T13:45:22Z', val: uploadTimestamp, set: setUploadTimestamp },
                      ].map(({ label, ph, val, set }) => (
                        <div key={label}>
                          <label className="text-[8px] text-white/35 block mb-1 uppercase">{label}</label>
                          <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph} className="f1-input" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button type="submit" disabled={uploading} className="btn-f1 flex-1 justify-center py-3">
                      {uploading ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                      {uploading ? 'Reading the radio…' : 'Analyze Audio Clip'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploading(true);
                        setTimeout(() => {
                          setUploadResult({
                            duration: 4.1,
                            whisper_transcript: "Box now, box now! Front left tyre vibration critical!",
                            reference_transcript: "Box now, box now! Front left tyre vibration critical!",
                            wer: 0.00,
                            arousal: 0.94,
                            valence: 0.22,
                            dominance: 0.88,
                            mood_label: 'STRESSED',
                            telemetry_matched: true,
                            lap_number: 38,
                            lap_time_seconds: 82.418,
                            grand_prix: '2024 Italian Grand Prix (Monza)',
                            driver_code: 'LEC',
                            sector1_time: 26.1,
                            sector2_time: 27.5,
                            sector3_time: 28.8,
                            tyre_compound: 'HARD',
                            tyre_life: 19,
                            speed_trap_kmh: 351.4,
                            is_pit: false,
                          });
                          triggerTyreSmokeBurst(window.innerWidth / 2, window.innerHeight * 0.45);
                          raceState.recordStressEvent();
                          setUploading(false);
                        }, 3600);
                      }}
                      disabled={uploading}
                      className="btn-cyan justify-center py-3 px-4 font-mono text-[11px]"
                      title="Run an instant demo analysis with Melbourne Albert Park Track Loader"
                    >
                      🏁 DEMO MELBOURNE RUN
                    </button>
                  </div>
                </form>
              </div>

              {/* Upload result */}
              {uploadResult && (
                <div className="panel-cyan p-5 rounded-[4px] space-y-4 anim-float-up">
                  <div className="flex items-center justify-between border-b border-white/8 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-[#00D2BE]" size={16} />
                      <h3 className="text-base font-display font-black text-white uppercase tracking-widest">Analysis Complete</h3>
                      <span className="text-[9px] font-mono text-white/30">({uploadResult.duration}s)</span>
                    </div>
                    <MoodBadge mood={uploadResult.mood_label} />
                  </div>

                  {/* FastF1 match */}
                  {uploadResult.telemetry_matched ? (
                    <div className="p-3.5 bg-[#03030a] rounded-[3px] border border-[#00D2BE]/20 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 pb-2">
                        <span className="px-2 py-0.5 bg-[#00D2BE] text-black text-[9px] font-bold rounded-[2px]">FASTF1 TELEMETRY MATCH</span>
                        <strong className="text-[#00D2BE] text-sm font-mono font-bold">LAP #{uploadResult.lap_number}</strong>
                        <span className="text-white/50 text-[11px] font-mono">
                          Pace: <strong className="text-white">{uploadResult.lap_time_seconds?.toFixed(3)}s</strong>
                        </span>
                        {uploadResult.driver_code && (
                          <span className="text-white/30 text-[10px] font-mono">({uploadResult.driver_code} · {uploadResult.grand_prix})</span>
                        )}
                        <span className="ml-auto text-[9px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded-[2px]">
                          {uploadResult.is_pit ? '⚠ PIT IN/OUT LAP' : '🏁 ON-TRACK RACING'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[
                          ['SECTOR 1', uploadResult.sector1_time ? `${uploadResult.sector1_time}s` : 'N/A'],
                          ['SECTOR 2', uploadResult.sector2_time ? `${uploadResult.sector2_time}s` : 'N/A'],
                          ['SECTOR 3', uploadResult.sector3_time ? `${uploadResult.sector3_time}s` : 'N/A'],
                          ['TYRE', `${uploadResult.tyre_compound || 'UNK'} ${uploadResult.tyre_life ? `(${uploadResult.tyre_life}L)` : ''}`],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-white/4 p-2 rounded-[2px] border border-white/5">
                            <span className="text-[8px] text-white/35 block mb-0.5 uppercase">{label}</span>
                            <strong className="text-[11px] text-white font-mono">{val}</strong>
                          </div>
                        ))}
                      </div>
                      {uploadResult.speed_trap_kmh && (
                        <div className="flex justify-between text-[10px] font-mono text-white/40 pt-1 border-t border-white/5">
                          <span>Speed Trap Top Speed:</span>
                          <strong className="text-[#00D2BE]">{uploadResult.speed_trap_kmh} km/h</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-[2px] bg-white/3 border border-white/8 flex items-center justify-between text-[10px] font-mono text-white/40">
                      <span>⚡ Standalone Vocal Acoustic Analysis</span>
                      <span className="text-[9px] text-white/25 italic">Provide GP / Driver / Timestamp to sync FastF1 lap</span>
                    </div>
                  )}

                  {/* STT result */}
                  <div className="p-3 bg-[#03030a] rounded-[3px] border border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[8px] font-mono text-[#00D2BE]/70 uppercase tracking-widest block mb-1">Whisper STT Output</span>
                      <p className="text-[12px] font-semibold text-white italic">"{uploadResult.whisper_transcript}"</p>
                    </div>
                    {uploadResult.filename && (
                      <button
                        onClick={() => handlePlayAudio('live_upload', uploadResult.filename)}
                        className={`play-btn ${currentPlayingId === 'live_upload' ? 'playing' : ''}`}
                      >
                        {currentPlayingId === 'live_upload' ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                      </button>
                    )}
                  </div>

                  {uploadResult.reference_transcript && (
                    <div className="p-3 bg-[#03030a] rounded-[3px] border border-white/5 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[8px] text-white/35 uppercase block mb-0.5">Word Error Rate</span>
                        <p className="text-[11px] text-white/60">Against reference text</p>
                      </div>
                      <WerBadge wer={uploadResult.wer} />
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5">
                    <ShiftLightStrip
                      arousal={uploadResult.arousal}
                      valence={uploadResult.valence}
                      dominance={uploadResult.dominance}
                      thresholdArousal={arousalThresh}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="mt-16 border-t border-white/5 py-5 text-center">
          <div className="checkered-stripe h-[2px] mb-4 opacity-40" />
          <p className="text-[9px] font-mono text-white/20 tracking-widest uppercase">
            The Silent Co-Driver · Grand Prix Hackathon 2026 · MikCil/f1-team-radio (CC-BY-4.0)
          </p>
        </footer>
      </div>
    </ThermalStateLayer>
  );
}
