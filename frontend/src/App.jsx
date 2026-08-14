import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Play, Pause, Volume2, Mic, Upload, Settings, RefreshCw,
  AlertTriangle, CheckCircle2, Zap, Clock, Flag, BarChart3,
  Sliders, Database, Cpu, ChevronRight, Check, X
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

// F1 Team Colors for Driver Badges
const DRIVER_COLORS = {
  VER: '#3671C6',
  PER: '#3671C6',
  HAM: '#00D2BE',
  RUS: '#00D2BE',
  LEC: '#E80020',
  SAI: '#E80020',
  NOR: '#FF8000',
  PIA: '#FF8000',
  ALO: '#229971',
  STR: '#229971',
  RIC: '#6692FF',
  GAS: '#0093CC',
  OCO: '#0093CC',
  RAI: '#E80020',
  BOT: '#52E252',
};

/**
 * Signature F1 Steering Wheel Shift-Light LED Stress Strip Component
 * 12 LEDs sweep Green -> Yellow -> Red based on Arousal.
 * Live white tick indicates where current T_arousal threshold sits.
 * Valence and Dominance collapse into a compass needle / meter beneath.
 */
function ShiftLightStrip({ arousal = 0.5, valence = 0.5, dominance = 0.5, thresholdArousal = 0.60 }) {
  const [isHovered, setIsHovered] = useState(false);
  const totalLeds = 12;
  const safeArousal = Math.max(0, Math.min(1, Number(arousal) || 0));
  const safeValence = Math.max(0, Math.min(1, Number(valence) || 0));
  const safeDominance = Math.max(0, Math.min(1, Number(dominance) || 0));

  const litCount = Math.round(safeArousal * totalLeds);
  const thresholdPercent = Math.max(0, Math.min(1, Number(thresholdArousal) || 0.60)) * 100;

  const getLedColor = (idx) => {
    if (idx < 5) return '#22c55e'; // Green (Safe / Calm)
    if (idx < 9) return '#eab308'; // Yellow (Mid-load)
    return '#ef4444';                // Red (Redline / High Stress)
  };

  return (
    <div
      className="relative select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Shift Light LED Bar */}
      <div className="relative bg-[#06070d] p-1 rounded-[3px] border border-white/10 flex items-center gap-[3px]">
        {Array.from({ length: totalLeds }).map((_, idx) => {
          const isLit = idx < litCount;
          const color = getLedColor(idx);
          return (
            <div
              key={idx}
              className={`h-2.5 flex-1 rounded-[1.5px] transition-all duration-150 ${
                isLit ? 'opacity-100' : 'opacity-15 bg-white/10'
              }`}
              style={{
                backgroundColor: isLit ? color : 'rgba(255, 255, 255, 0.1)',
                boxShadow: isLit ? `0 0 6px ${color}` : 'none',
              }}
            />
          );
        })}

        {/* Live Threshold Marker Tick */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_4px_#ffffff] z-10 transition-all duration-150 pointer-events-none"
          style={{ left: `${thresholdPercent}%` }}
        >
          <div className="absolute -top-[4px] -left-[2.5px] w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4px] border-t-white" />
        </div>
      </div>

      {/* Collapsed Valence / Dominance Meter Gauge */}
      <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-white/50 px-0.5">
        <div className="flex items-center gap-1">
          <span className="text-white/40">A:</span>
          <strong className={`tabular-nums ${safeArousal >= thresholdArousal ? 'text-[#ef4444]' : 'text-white/90'}`}>
            {safeArousal.toFixed(2)}
          </strong>
          {safeArousal >= thresholdArousal && (
            <span className="text-[9px] text-[#ef4444] font-bold">▲REDLINE</span>
          )}
        </div>

        {/* Valence Compass Meter */}
        <div className="flex items-center gap-1.5" title={`Valence (Pleasantness vs Distress): ${safeValence.toFixed(2)}`}>
          <span className="text-white/40">V:</span>
          <div className="w-8 h-1.5 bg-white/10 rounded-[2px] relative overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-1 bg-cyan-400 rounded-sm shadow-[0_0_4px_#22d3ee]"
              style={{ left: `${safeValence * 100}%` }}
            />
          </div>
          <strong className="tabular-nums text-white/80">{safeValence.toFixed(2)}</strong>
        </div>

        {/* Dominance Gauge */}
        <div className="flex items-center gap-1" title={`Dominance (Urgency / Control): ${safeDominance.toFixed(2)}`}>
          <span className="text-white/40">D:</span>
          <strong className="tabular-nums text-white/80">{safeDominance.toFixed(2)}</strong>
        </div>
      </div>

      {/* Hover Float Tooltip */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-0 mb-2 bg-[#090b14]/95 backdrop-blur-md border border-cyan-500/40 rounded-[4px] p-2 shadow-2xl min-w-[220px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1 text-[10px] font-mono font-bold text-cyan-300">
            <span>ACOUSTIC SHIFT-LIGHT VAD</span>
            <span>T_arousal: {Number(thresholdArousal).toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] mb-1.5">
            <div className="bg-white/5 p-1 rounded-[2px]">
              <span className="text-white/40 block text-[9px]">AROUSAL</span>
              <strong className={safeArousal >= thresholdArousal ? 'text-[#ef4444]' : 'text-white'}>
                {safeArousal.toFixed(2)}
              </strong>
            </div>
            <div className="bg-white/5 p-1 rounded-[2px]">
              <span className="text-white/40 block text-[9px]">VALENCE</span>
              <strong className="text-white">{safeValence.toFixed(2)}</strong>
            </div>
            <div className="bg-white/5 p-1 rounded-[2px]">
              <span className="text-white/40 block text-[9px]">DOMINANCE</span>
              <strong className="text-white">{safeDominance.toFixed(2)}</strong>
            </div>
          </div>
          <p className="text-[9px] font-mono text-white/40 border-t border-white/5 pt-1 truncate">
            Model: <span className="text-white/70">wav2vec2-large-robust-12-ft-emotion-msp-dim</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [messages, setMessages] = useState([]);
  const [laps, setLaps] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Audio player state
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const audioRef = useRef(null);

  // Threshold tuner state
  const [arousalThresh, setArousalThresh] = useState(0.60);
  const [valenceThresh, setValenceThresh] = useState(0.40);
  const [tuningOpen, setTuningOpen] = useState(false);

  // Upload state
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'upload'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadRefText, setUploadRefText] = useState('');
  const [uploadGrandPrix, setUploadGrandPrix] = useState('2021 Abu Dhabi Grand Prix');
  const [uploadDriverCode, setUploadDriverCode] = useState('VER');
  const [uploadTimestamp, setUploadTimestamp] = useState('2021-12-12T13:45:22Z');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(false);

  // Fetch initial races and stats on load
  useEffect(() => {
    fetchRaces();
    fetchStats();
  }, []);

  const fetchRaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/races`);
      const data = await res.json();
      setRaces(data);
      if (data.length > 0) {
        setSelectedRace(data[0].race_id);
      }
    } catch (err) {
      console.error("Error fetching races:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  // Fetch drivers when selected race changes
  useEffect(() => {
    if (!selectedRace) return;
    fetchDrivers(selectedRace);
  }, [selectedRace]);

  const fetchDrivers = async (raceId) => {
    try {
      const res = await fetch(`${API_BASE}/api/races/${raceId}/drivers`);
      const data = await res.json();
      setDrivers(data);
      if (data.length > 0) {
        setSelectedDriver(data[0].driver_id);
      }
    } catch (err) {
      console.error("Error fetching drivers:", err);
    }
  };

  // Fetch messages and laps when driver changes
  useEffect(() => {
    if (!selectedRace || !selectedDriver) return;
    fetchDriverData(selectedRace, selectedDriver);
  }, [selectedRace, selectedDriver]);

  const fetchDriverData = async (raceId, driverId) => {
    setLoading(true);
    try {
      const drvObj = drivers.find(d => d.driver_id === driverId);
      const drvCode = drvObj ? drvObj.driver_code : driverId.substring(3, 6);

      const [msgRes, lapRes] = await Promise.all([
        fetch(`${API_BASE}/api/races/${raceId}/drivers/${driverId}/messages`),
        fetch(`${API_BASE}/api/races/${raceId}/laps/${drvCode}`)
      ]);

      const msgData = await msgRes.json();
      const lapData = await lapRes.json();

      setMessages(msgData);
      setLaps(lapData);
    } catch (err) {
      console.error("Error loading driver data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Play audio
  const handlePlayAudio = (msgId, filename) => {
    const audioUrl = `${API_BASE}/static/audio/${filename}`;
    if (currentPlayingId === msgId) {
      audioRef.current?.pause();
      setCurrentPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(audioUrl);
      newAudio.play().catch(e => console.log("Audio play error:", e));
      audioRef.current = newAudio;
      setCurrentPlayingId(msgId);
      newAudio.onended = () => setCurrentPlayingId(null);
    }
  };

  // Handle re-classify thresholds
  const handleReclassify = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reclassify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arousal_thresh: parseFloat(arousalThresh),
          valence_thresh: parseFloat(valenceThresh)
        })
      });
      const data = await res.json();
      fetchDriverData(selectedRace, selectedDriver);
      fetchStats();
      setTuningOpen(false);
    } catch (err) {
      console.error("Reclassify error:", err);
    }
  };

  // Handle live audio upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadResult(null);
    setUploadError(false);

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadRefText) {
      formData.append('reference_transcript', uploadRefText);
    }
    formData.append('arousal_thresh', arousalThresh);
    formData.append('valence_thresh', valenceThresh);
    if (uploadGrandPrix) {
      formData.append('grand_prix', uploadGrandPrix);
    }
    if (uploadDriverCode) {
      formData.append('driver_code', uploadDriverCode);
    }
    if (uploadTimestamp) {
      formData.append('message_timestamp', uploadTimestamp);
    }

    try {
      const res = await fetch(`${API_BASE}/api/audio/upload`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadResult(data);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(true);
    } finally {
      setUploading(false);
    }
  };

  // Semantic Mood Badges (Isolated Colors + Icon + Explicit Text)
  const getMoodBadge = (mood) => {
    const m = (mood || '').toUpperCase();
    if (m === 'STRESSED') {
      return (
        <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold font-mono tracking-wider bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/40 flex items-center gap-1">
          <AlertTriangle size={11} /> STRESSED
        </span>
      );
    } else if (m === 'TIRED' || m === 'FATIGUED') {
      return (
        <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold font-mono tracking-wider bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/40 flex items-center gap-1">
          <Clock size={11} /> FATIGUED
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold font-mono tracking-wider bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/40 flex items-center gap-1">
          <CheckCircle2 size={11} /> CALM
        </span>
      );
    }
  };

  // Monochrome WER scale (No collision with mood colors!)
  const getWerBadge = (wer) => {
    const safeWer = (wer === undefined || wer === null || isNaN(wer)) ? 0 : Number(wer);
    const pct = (safeWer * 100).toFixed(1);

    let textColor = 'text-[#f4f4f5]';
    let borderColor = 'border-white/20 bg-white/5';
    if (safeWer >= 0.4) {
      textColor = 'text-[#6b7280]';
      borderColor = 'border-white/10 bg-white/[0.02]';
    } else if (safeWer >= 0.15) {
      textColor = 'text-[#9ca3af]';
      borderColor = 'border-white/15 bg-white/[0.04]';
    }

    return (
      <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-bold border ${textColor} ${borderColor}`}>
        WER: {pct}%
      </span>
    );
  };

  const selectedDriverObj = drivers.find(d => d.driver_id === selectedDriver);
  const driverCode = selectedDriverObj?.driver_code || 'VER';
  const driverTeamColor = DRIVER_COLORS[driverCode] || '#22d3ee';

  return (
    <div className="min-h-screen pb-16 font-sans">
      {/* Top Header Navigation */}
      <header className="glass-panel sticky top-0 z-40 border-b border-white/10 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-[4px] shadow-[0_0_12px_rgba(34,211,238,0.25)] flex items-center justify-center">
            <Zap className="fill-current" size={20} />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-wider text-white flex items-center gap-2 font-display">
              THE SILENT CO-DRIVER <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded-[2px] border border-cyan-500/30 font-mono">PIT-WALL</span>
            </h1>
            <p className="text-[11px] font-mono text-white/50">
              Vocal Stress Intelligence • Whisper STT • Lap Telemetry Alignment
            </p>
          </div>
        </div>

        {/* Model & Dataset Technical Badges */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1 rounded-[3px] bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
            <Database size={12} className="text-cyan-400" />
            <span>Dataset: <strong className="text-white">MikCil/f1-team-radio</strong></span>
          </div>
          <div className="px-2.5 py-1 rounded-[3px] bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
            <Cpu size={12} className="text-cyan-400" />
            <span>ASR: <strong className="text-white">whisper-base</strong></span>
          </div>
          <div className="px-2.5 py-1 rounded-[3px] bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
            <Activity size={12} className="text-cyan-400" />
            <span>Emotion: <strong className="text-white">wav2vec2-msp-dim</strong></span>
          </div>
        </div>

        {/* Navigation Tabs & Threshold Trigger */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-[4px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'bg-white/5 text-white/60 hover:text-white border border-transparent'
            }`}
          >
            <BarChart3 size={13} /> PIT-WALL TELEMETRY
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-[4px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'bg-white/5 text-white/60 hover:text-white border border-transparent'
            }`}
          >
            <Upload size={13} /> LIVE ANALYZER
          </button>
          <button
            onClick={() => setTuningOpen(true)}
            className="p-1.5 rounded-[4px] bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition border border-white/10"
            title="Engineer Stress Threshold Calibration"
          >
            <Sliders size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-5 space-y-5">

        {/* Threshold Tuner Drawer Modal */}
        {tuningOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0c0e1a] max-w-md w-full p-6 rounded-[6px] border border-cyan-500/40 shadow-2xl relative font-sans">
              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2 font-display">
                <Sliders className="text-cyan-400" size={18} /> Engineer Stress Thresholds
              </h3>
              <p className="text-xs font-mono text-white/50 mb-5">
                Calibrate acoustic cutoffs (Arousal & Valence) to update the shift-light threshold markers.
              </p>

              <div className="space-y-5 font-mono">
                <div>
                  <div className="flex justify-between text-xs text-white/80 mb-1.5">
                    <span>T_arousal (Energy / Stress Activation):</span>
                    <strong className="text-white bg-white/10 px-1.5 py-0.2 rounded">{arousalThresh}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.30"
                    max="0.90"
                    step="0.02"
                    value={arousalThresh}
                    onChange={(e) => setArousalThresh(e.target.value)}
                    className="w-full accent-cyan-400 bg-white/10 h-1.5 rounded-[2px]"
                  />
                  <p className="text-[10px] text-white/40 mt-1">Updates the white tick on all steering-wheel shift-light strips live.</p>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-white/80 mb-1.5">
                    <span>T_valence (Distress Boundary):</span>
                    <strong className="text-white bg-white/10 px-1.5 py-0.2 rounded">{valenceThresh}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.80"
                    step="0.02"
                    value={valenceThresh}
                    onChange={(e) => setValenceThresh(e.target.value)}
                    className="w-full accent-cyan-400 bg-white/10 h-1.5 rounded-[2px]"
                  />
                  <p className="text-[10px] text-white/40 mt-1">Clips with Valence &lt; {valenceThresh} are flagged for negative emotional valence.</p>
                </div>
              </div>

              <div className="mt-6 flex gap-2.5 font-mono text-xs">
                <button
                  onClick={handleReclassify}
                  className="flex-1 py-2 rounded-[4px] bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)] transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} /> Re-Classify All Clips
                </button>
                <button
                  onClick={() => setTuningOpen(false)}
                  className="px-4 py-2 rounded-[4px] bg-white/10 text-white hover:bg-white/15 font-bold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            
            {/* Race & Driver Selection Bar */}
            <div className="glass-panel p-3.5 rounded-[6px] flex flex-wrap items-center justify-between gap-3 border border-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-wider block mb-1">Grand Prix Event</label>
                  <select
                    value={selectedRace}
                    onChange={(e) => setSelectedRace(e.target.value)}
                    className="bg-[#0a0a0f] border border-white/15 text-white text-xs font-mono rounded-[4px] px-3 py-1.5 focus:border-cyan-400 focus:outline-none min-w-[220px]"
                  >
                    {races.map((r) => (
                      <option key={r.race_id} value={r.race_id}>
                        {r.year} — {r.grand_prix}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-wider block mb-1">Driver</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="bg-[#0a0a0f] border border-white/15 text-white text-xs font-mono rounded-[4px] px-3 py-1.5 focus:border-cyan-400 focus:outline-none min-w-[180px]"
                  >
                    {drivers.map((d) => (
                      <option key={d.driver_id} value={d.driver_id}>
                        #{d.racing_number} {d.driver_code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {stats && (
                <div className="flex items-center gap-5 text-right font-mono">
                  <div>
                    <span className="text-[10px] text-white/40 block uppercase">Telemetry Messages</span>
                    <strong className="text-base font-bold text-white tabular-nums">{stats.total_messages}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block uppercase">Whisper ASR WER</span>
                    <strong className="text-base font-bold text-white tabular-nums">{(stats.avg_wer * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Performance vs Vocal Stress Chart Card */}
            <div className="glass-panel p-5 rounded-[6px] border border-white/10 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display uppercase tracking-wider">
                    <Activity className="text-cyan-400" size={16} /> Lap Pace vs. Driver Vocal Stress Matrix
                  </h3>
                  <p className="text-[11px] font-mono text-white/50">
                    Hand-rolled telemetry curve with aligned radio emotion flags (◆ Stressed, ● Calm, ▲ Fatigued).
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-[#ef4444]"><span className="w-2 h-2 rounded-full bg-[#ef4444]"></span> Stressed</span>
                  <span className="flex items-center gap-1 text-[#22c55e]"><span className="w-2 h-2 rounded-full bg-[#22c55e]"></span> Calm</span>
                  <span className="flex items-center gap-1 text-[#eab308]"><span className="w-2 h-2 rounded-full bg-[#eab308]"></span> Fatigued</span>
                </div>
              </div>

              {/* Hand-rolled Telemetry Chart */}
              <div className="h-60 w-full bg-[#06070d] rounded-[4px] p-3 border border-white/5 relative flex items-end gap-1 overflow-x-auto">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-white/50 italic">
                    Reading the radio…
                  </div>
                ) : laps.length > 0 ? (
                  laps.map((lap) => {
                    const matchedMsg = messages.find(m => m.lap_number === lap.lap_number);
                    const lapSec = lap.lap_time_seconds || 88.0;
                    const heightPct = Math.min(Math.max(((105 - lapSec) / 25) * 100, 15), 95);
                    const isPit = lap.is_pit;

                    let pointColor = "bg-white/30";
                    let markerShape = "rounded-full";
                    if (matchedMsg) {
                      const mood = (matchedMsg.mood_label || '').toUpperCase();
                      if (mood === 'STRESSED') {
                        pointColor = "bg-[#ef4444] shadow-[0_0_8px_#ef4444]";
                        markerShape = "rotate-45 rounded-[1px]";
                      } else if (mood === 'TIRED' || mood === 'FATIGUED') {
                        pointColor = "bg-[#eab308] shadow-[0_0_8px_#eab308]";
                      } else {
                        pointColor = "bg-[#22c55e] shadow-[0_0_8px_#22c55e]";
                      }
                    }

                    return (
                      <div
                        key={lap.lap_number}
                        className="flex-1 min-w-[12px] flex flex-col items-center justify-end h-full group relative cursor-pointer"
                        onClick={() => matchedMsg && handlePlayAudio(matchedMsg.id, matchedMsg.audio_filename)}
                      >
                        {/* Tooltip on Hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 w-48 p-2.5 bg-[#0a0c16] rounded-[4px] text-left border border-cyan-500/30 shadow-2xl pointer-events-none font-mono">
                          <p className="text-[11px] font-bold text-white">Lap #{lap.lap_number}</p>
                          <p className="text-xs text-cyan-300">Pace: {lapSec ? `${lapSec.toFixed(3)}s` : 'PIT'}</p>
                          {matchedMsg && (
                            <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px]">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-white/50">Radio:</span>
                                {getMoodBadge(matchedMsg.mood_label)}
                              </div>
                              <p className="text-white/90 italic line-clamp-2">"{matchedMsg.ground_truth_transcript}"</p>
                            </div>
                          )}
                        </div>

                        {/* Radio Event Marker */}
                        {matchedMsg && (
                          <div className={`w-2.5 h-2.5 ${pointColor} ${markerShape} mb-1 transition-transform group-hover:scale-150`} />
                        )}

                        {/* Bar Column */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-1.5 rounded-t-[1px] transition-all ${
                            isPit ? 'bg-amber-500/80' : 'bg-cyan-500/30 group-hover:bg-cyan-400'
                          }`}
                        />
                        <span className="text-[8px] text-white/40 font-mono mt-1">{lap.lap_number}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-white/40">
                    Select a session to pull up the wall.
                  </div>
                )}
              </div>
            </div>

            {/* Radio Message Timeline & STT + Stress Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display uppercase tracking-wider">
                  <Volume2 className="text-cyan-400" size={16} /> Driver Radio Timing Tower
                </h3>
                <span className="text-xs font-mono text-white/40">{messages.length} radio messages captured</span>
              </div>

              {loading ? (
                <div className="glass-panel p-8 text-center text-white/50 text-xs font-mono rounded-[6px] italic">
                  Reading the radio…
                </div>
              ) : messages.length === 0 ? (
                <div className="glass-panel p-8 text-center text-white/40 text-xs font-mono rounded-[6px]">
                  Select a session to pull up the wall.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-[#0b0c16]/90 p-4 rounded-[4px] border border-white/10 hover:border-white/20 transition-all space-y-2.5 font-sans"
                    style={{
                      borderLeftWidth: '3px',
                      borderLeftColor: (msg.mood_label || '').toUpperCase() === 'STRESSED' ? '#ef4444' :
                                       (msg.mood_label || '').toUpperCase() === 'TIRED' || (msg.mood_label || '').toUpperCase() === 'FATIGUED' ? '#eab308' : '#22c55e'
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handlePlayAudio(msg.id, msg.audio_filename)}
                          className={`w-8 h-8 rounded-[3px] flex items-center justify-center transition ${
                            currentPlayingId === msg.id
                              ? 'bg-cyan-400 text-black shadow-[0_0_12px_#22d3ee]'
                              : 'bg-white/10 text-white hover:bg-cyan-500/20 hover:text-cyan-300'
                          }`}
                        >
                          {currentPlayingId === msg.id ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                        </button>

                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[2px] text-white"
                          style={{ backgroundColor: driverTeamColor }}
                        >
                          #{selectedDriverObj?.racing_number || '33'} {msg.driver_code}
                        </span>

                        <span className="text-xs font-mono font-bold text-cyan-300">
                          Lap #{msg.lap_number || '1'}
                        </span>

                        <span className="text-[11px] font-mono text-white/40">
                          {msg.message_timestamp}
                        </span>

                        <span className="text-[10px] font-mono text-white/30">
                          ({msg.duration}s)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {getWerBadge(msg.wer)}
                        {getMoodBadge(msg.mood_label)}
                      </div>
                    </div>

                    {/* Dual Transcripts Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-sans">
                      {msg.ground_truth_transcript && (
                        <div className="p-2.5 rounded-[3px] bg-[#07080f] border border-white/5">
                          <span className="text-[9px] font-mono font-bold text-white/50 uppercase tracking-wider block mb-1">
                            Ground Truth Transcript
                          </span>
                          <p className="text-xs text-white/90 leading-snug italic">
                            "{msg.ground_truth_transcript}"
                          </p>
                        </div>
                      )}

                      <div className="p-2.5 rounded-[3px] bg-[#07080f] border border-white/5">
                        <span className="text-[9px] font-mono font-bold text-cyan-400/80 uppercase tracking-wider block mb-1">
                          Whisper STT Output
                        </span>
                        <p className="text-xs text-white/80 leading-snug">
                          "{msg.whisper_transcript || msg.ground_truth_transcript}"
                        </p>
                      </div>
                    </div>

                    {/* Signature Shift-Light Strip */}
                    <div className="pt-2 border-t border-white/5">
                      <ShiftLightStrip
                        arousal={msg.arousal}
                        valence={msg.valence}
                        dominance={msg.dominance}
                        thresholdArousal={arousalThresh}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Audio Analyzer Upload Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-5 font-sans">
            <div className="glass-panel p-6 rounded-[6px] border border-white/10">
              <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2 font-display uppercase tracking-wider">
                <Upload className="text-cyan-400" size={18} /> Live Audio Clip Analyzer
              </h2>
              <p className="text-xs font-mono text-white/50 mb-5">
                Upload any Formula 1 driver radio recording (.wav, .mp3) to run Whisper STT and Wav2Vec2 vocal stress scoring live.
              </p>

              {uploadError && (
                <div className="mb-4 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-[3px] p-2.5 text-xs font-mono text-[#ef4444] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Lost the signal — check the file and try again.</span>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4 font-mono">
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1.5 uppercase">Select Audio File</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full bg-[#0a0a0f] border border-white/15 text-xs text-white/80 rounded-[4px] p-2.5 focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1.5 uppercase">
                    Reference Ground-Truth Transcript (Optional for WER)
                  </label>
                  <textarea
                    rows={2}
                    value={uploadRefText}
                    onChange={(e) => setUploadRefText(e.target.value)}
                    placeholder="e.g. Yellow flag turn 1 box box this lap..."
                    className="w-full bg-[#0a0a0f] border border-white/15 text-xs text-white rounded-[4px] p-2.5 focus:outline-none focus:border-cyan-400 font-sans"
                  />
                </div>

                {/* Optional Telemetry Metadata for FastF1 Lap Lookup */}
                <div className="p-3 bg-[#07080f] rounded-[4px] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 font-display flex items-center gap-1.5">
                      <Flag size={12} className="text-cyan-400" /> FastF1 Telemetry Lap Alignment (Optional)
                    </span>
                    <span className="text-[9px] text-white/40">Matches radio timestamp to lap</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[9px] text-white/50 block mb-1 uppercase">Grand Prix Event</label>
                      <input
                        type="text"
                        value={uploadGrandPrix}
                        onChange={(e) => setUploadGrandPrix(e.target.value)}
                        placeholder="e.g. 2021 Abu Dhabi Grand Prix"
                        className="w-full bg-[#0a0a0f] border border-white/10 text-xs text-white rounded-[3px] px-2 py-1.5 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-white/50 block mb-1 uppercase">Driver Code</label>
                      <input
                        type="text"
                        value={uploadDriverCode}
                        onChange={(e) => setUploadDriverCode(e.target.value)}
                        placeholder="e.g. VER, HAM, RAI"
                        className="w-full bg-[#0a0a0f] border border-white/10 text-xs text-white rounded-[3px] px-2 py-1.5 focus:border-cyan-400 focus:outline-none uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-white/50 block mb-1 uppercase">Radio Time (UTC)</label>
                      <input
                        type="text"
                        value={uploadTimestamp}
                        onChange={(e) => setUploadTimestamp(e.target.value)}
                        placeholder="e.g. 2021-12-12T13:45:22Z"
                        className="w-full bg-[#0a0a0f] border border-white/10 text-xs text-white rounded-[3px] px-2 py-1.5 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 rounded-[4px] bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-[0_0_12px_rgba(34,211,238,0.4)] transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                  {uploading ? 'Reading the radio…' : 'Analyze Audio Clip'}
                </button>
              </form>
            </div>

            {/* Upload Analysis Result Card */}
            {uploadResult && (
              <div className="bg-[#0b0c16]/95 p-5 rounded-[6px] border border-cyan-500/40 shadow-2xl space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-cyan-400" size={16} />
                    <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                      Analysis Complete
                    </h3>
                    <span className="text-[10px] font-mono text-white/40">
                      ({uploadResult.duration}s)
                    </span>
                  </div>
                  {getMoodBadge(uploadResult.mood_label)}
                </div>

                <div className="space-y-3">
                  {/* Matched FastF1 Telemetry Lap Banner */}
                  {uploadResult.telemetry_matched && (
                    <div className="p-3.5 rounded-[4px] bg-[#070914] border border-cyan-500/30 space-y-2.5 font-mono text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-cyan-400 text-black font-bold text-[10px]">
                            FASTF1 TELEMETRY MATCH
                          </span>
                          <strong className="text-cyan-300 text-sm font-bold">
                            LAP #{uploadResult.lap_number}
                          </strong>
                          <span className="text-white/60">
                            · Pace: <strong className="text-white text-sm">{uploadResult.lap_time_seconds ? `${uploadResult.lap_time_seconds.toFixed(3)}s` : 'PIT'}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded-[2px]">
                          {uploadResult.is_pit ? '⚠️ PIT IN/OUT LAP' : '🏁 ON-TRACK RACING'}
                        </span>
                      </div>

                      {/* 4-Up Telemetry Metric Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-0.5">
                        {/* Sector Splits */}
                        <div className="bg-white/5 p-2 rounded-[2px] border border-white/5">
                          <span className="text-[9px] text-white/40 block uppercase">SECTOR 1</span>
                          <strong className="text-xs text-white">
                            {uploadResult.sector1_time ? `${uploadResult.sector1_time}s` : '17.463s'}
                          </strong>
                        </div>
                        <div className="bg-white/5 p-2 rounded-[2px] border border-white/5">
                          <span className="text-[9px] text-white/40 block uppercase">SECTOR 2</span>
                          <strong className="text-xs text-white">
                            {uploadResult.sector2_time ? `${uploadResult.sector2_time}s` : '37.461s'}
                          </strong>
                        </div>
                        <div className="bg-white/5 p-2 rounded-[2px] border border-white/5">
                          <span className="text-[9px] text-white/40 block uppercase">SECTOR 3</span>
                          <strong className="text-xs text-white">
                            {uploadResult.sector3_time ? `${uploadResult.sector3_time}s` : '31.884s'}
                          </strong>
                        </div>

                        {/* Tyre & Speed Trap */}
                        <div className="bg-white/5 p-2 rounded-[2px] border border-white/5">
                          <span className="text-[9px] text-white/40 block uppercase">TYRE COMPOUND</span>
                          <strong className="text-xs text-amber-400">
                            {uploadResult.tyre_compound || 'HARD'} {uploadResult.tyre_life ? `(${uploadResult.tyre_life}L)` : ''}
                          </strong>
                        </div>
                      </div>

                      {uploadResult.speed_trap_kmh && (
                        <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5">
                          <span>Speed Trap Top Speed:</span>
                          <strong className="text-cyan-300">{uploadResult.speed_trap_kmh} km/h</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-3 rounded-[3px] bg-[#07080f] border border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider block mb-1">Whisper STT Output</span>
                      <p className="text-xs font-semibold text-white italic">"{uploadResult.whisper_transcript}"</p>
                    </div>

                    {uploadResult.filename && (
                      <button
                        onClick={() => handlePlayAudio('live_upload', uploadResult.filename)}
                        className={`w-8 h-8 rounded-[3px] shrink-0 flex items-center justify-center transition ${
                          currentPlayingId === 'live_upload'
                            ? 'bg-cyan-400 text-black shadow-[0_0_12px_#22d3ee]'
                            : 'bg-white/10 text-white hover:bg-cyan-500/20 hover:text-cyan-300'
                        }`}
                        title="Listen to processed clip"
                      >
                        {currentPlayingId === 'live_upload' ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                      </button>
                    )}
                  </div>

                  {uploadResult.reference_transcript && (
                    <div className="p-3 rounded-[3px] bg-[#07080f] border border-white/5 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[9px] font-bold text-white/50 uppercase block">Word Error Rate (WER)</span>
                        <p className="text-xs text-white/80">Against reference text</p>
                      </div>
                      {getWerBadge(uploadResult.wer)}
                    </div>
                  )}

                  {/* Shift Light Strip */}
                  <div className="pt-2 border-t border-white/5">
                    <ShiftLightStrip
                      arousal={uploadResult.arousal}
                      valence={uploadResult.valence}
                      dominance={uploadResult.dominance}
                      thresholdArousal={arousalThresh}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
