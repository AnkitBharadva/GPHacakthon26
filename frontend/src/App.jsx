import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Play, Pause, Volume2, Mic, Upload, Settings, RefreshCw,
  Award, AlertTriangle, CheckCircle2, Zap, Clock, ShieldAlert, BarChart3,
  ExternalLink, ChevronRight, Info, Music, Cpu, Database
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

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
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'upload' | 'about'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadRefText, setUploadRefText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

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
      alert(`Successfully re-classified ${data.updated_messages} radio clips!`);
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

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadRefText) {
      formData.append('reference_transcript', uploadRefText);
    }
    formData.append('arousal_thresh', arousalThresh);
    formData.append('valence_thresh', valenceThresh);

    try {
      const res = await fetch(`${API_BASE}/api/audio/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadResult(data);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Audio upload processing failed.");
    } finally {
      setUploading(false);
    }
  };

  // Helpers for mood styling
  const getMoodBadge = (mood) => {
    switch (mood) {
      case 'Stressed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 glow-red flex items-center gap-1.5"><AlertTriangle size={12} /> STRESSED</span>;
      case 'Tired':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5"><Clock size={12} /> FATIGUED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 glow-green flex items-center gap-1.5"><CheckCircle2 size={12} /> CALM</span>;
    }
  };

  const getWerBadge = (wer) => {
    const pct = (wer * 100).toFixed(1);
    const color = wer < 0.1 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                  wer < 0.25 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                  'text-red-400 bg-red-500/10 border-red-500/30';
    return <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${color}`}>WER: {pct}%</span>;
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Top Header Navigation */}
      <header className="glass-panel sticky top-0 z-40 border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wider text-white flex items-center gap-2">
              THE SILENT CO-DRIVER <span className="text-xs bg-red-600/30 text-red-400 px-2 py-0.5 rounded-full border border-red-500/40 font-mono">F1 TELEMETRY</span>
            </h1>
            <p className="text-xs text-slate-400">Driver Radio STT Transcription • Vocal Stress Scoring • Lap Performance Alignment</p>
          </div>
        </div>

        {/* Model & Dataset Badges */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-slate-300 flex items-center gap-1.5">
            <Database size={13} className="text-red-400" />
            <span>Dataset: <strong className="text-white">MikCil/f1-team-radio</strong></span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-slate-300 flex items-center gap-1.5">
            <Cpu size={13} className="text-cyan-400" />
            <span>STT: <strong className="text-white">whisper-base</strong></span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-slate-300 flex items-center gap-1.5">
            <Activity size={13} className="text-emerald-400" />
            <span>Stress: <strong className="text-white">wav2vec2-msp-dim</strong></span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
              activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 size={14} /> Telemetry Dashboard
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${
              activeTab === 'upload' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Upload size={14} /> Audio Analyzer
          </button>
          <button
            onClick={() => setTuningOpen(true)}
            className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white transition border border-white/10"
            title="Engineer Stress Thresholds"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 pt-6">

        {/* Threshold Tuner Drawer Modal */}
        {tuningOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-red-500/30 shadow-2xl relative">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Settings className="text-red-500" size={20} /> Engineer Stress Thresholds
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Adjust dimensional emotion cutoffs (Arousal & Valence) to calibrate vocal stress sensitivity.
              </p>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-2">
                    <span>Arousal Cutoff (Energy / Tension):</span>
                    <strong className="text-red-400">{arousalThresh}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.30"
                    max="0.90"
                    step="0.05"
                    value={arousalThresh}
                    onChange={(e) => setArousalThresh(e.target.value)}
                    className="w-full accent-red-600 bg-slate-800 h-2 rounded-lg"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Clips with Arousal &gt; {arousalThresh} are flagged for high vocal activation.</p>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-2">
                    <span>Valence Cutoff (Pleasantness / Calm):</span>
                    <strong className="text-cyan-400">{valenceThresh}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.20"
                    max="0.80"
                    step="0.05"
                    value={valenceThresh}
                    onChange={(e) => setValenceThresh(e.target.value)}
                    className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Clips with Valence &lt; {valenceThresh} are flagged for negative distress.</p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={handleReclassify}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} /> Re-Classify All Clips
                </button>
                <button
                  onClick={() => setTuningOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Race & Driver Selection Bar */}
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-white/10">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Grand Prix</label>
                  <select
                    value={selectedRace}
                    onChange={(e) => setSelectedRace(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-4 py-2.5 focus:border-red-500 focus:outline-none min-w-[240px]"
                  >
                    {races.map((r) => (
                      <option key={r.race_id} value={r.race_id}>
                        {r.grand_prix} ({r.year})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Driver</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-4 py-2.5 focus:border-red-500 focus:outline-none min-w-[200px]"
                  >
                    {drivers.map((d) => (
                      <option key={d.driver_id} value={d.driver_id}>
                        #{d.racing_number} - {d.driver_code} ({d.driver_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {stats && (
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <span className="text-xs text-slate-400 block">System Total Messages</span>
                    <strong className="text-lg font-mono text-white">{stats.total_messages}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Avg Whisper WER</span>
                    <strong className="text-lg font-mono text-emerald-400">{(stats.avg_wer * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Performance vs Vocal Stress Chart Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="text-red-500" size={18} /> Lap Time Performance vs. Driver Vocal Stress
                  </h3>
                  <p className="text-xs text-slate-400">
                    Lap pace timeline with aligned radio messages color-coded by vocal emotion score.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500 glow-red"></span> Stressed Radio</span>
                  <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 glow-green"></span> Calm Radio</span>
                  <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Fatigued Radio</span>
                </div>
              </div>

              {/* Custom Interactive Telemetry Chart */}
              <div className="h-64 w-full bg-slate-950/60 rounded-xl p-4 border border-white/5 relative flex items-end gap-1 overflow-x-auto">
                {laps.length > 0 ? (
                  laps.map((lap) => {
                    const matchedMsg = messages.find(m => m.lap_number === lap.lap_number);
                    const lapSec = lap.lap_time_seconds || 88.0;
                    // Scale height between min and max lap times
                    const heightPct = Math.min(Math.max(((105 - lapSec) / 25) * 100, 15), 95);
                    const isPit = lap.is_pit;

                    let pointColor = "bg-slate-600";
                    let glowClass = "";
                    if (matchedMsg) {
                      if (matchedMsg.mood_label === 'Stressed') {
                        pointColor = "bg-red-500";
                        glowClass = "glow-red ring-4 ring-red-500/30 animate-pulse";
                      } else if (matchedMsg.mood_label === 'Tired') {
                        pointColor = "bg-amber-500";
                        glowClass = "ring-2 ring-amber-500/30";
                      } else {
                        pointColor = "bg-emerald-500";
                        glowClass = "glow-green ring-2 ring-emerald-500/30";
                      }
                    }

                    return (
                      <div
                        key={lap.lap_number}
                        className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full group relative cursor-pointer"
                      >
                        {/* Tooltip on Hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 w-48 p-2.5 glass-panel rounded-xl text-left border border-white/20 shadow-xl pointer-events-none">
                          <p className="text-[11px] font-bold text-white">Lap #{lap.lap_number}</p>
                          <p className="text-xs font-mono text-cyan-400">Pace: {lapSec ? `${lapSec.toFixed(3)}s` : 'PIT'}</p>
                          {matchedMsg && (
                            <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[11px]">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-400 font-semibold">Radio:</span>
                                {getMoodBadge(matchedMsg.mood_label)}
                              </div>
                              <p className="text-slate-200 italic line-clamp-2">"{matchedMsg.ground_truth_transcript}"</p>
                            </div>
                          )}
                        </div>

                        {/* Radio Event Pulse Marker */}
                        {matchedMsg && (
                          <div className={`w-3 h-3 rounded-full ${pointColor} ${glowClass} mb-1 transition-transform group-hover:scale-150`} />
                        )}

                        {/* Bar / Line Column */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-1.5 rounded-t transition-all ${
                            isPit ? 'bg-slate-700 border-t border-amber-400' : 'bg-slate-800 group-hover:bg-slate-600'
                          }`}
                        />
                        <span className="text-[9px] text-slate-500 font-mono mt-1">{lap.lap_number}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                    Loading lap timing telemetry...
                  </div>
                )}
              </div>
            </div>

            {/* Radio Message Timeline & STT + Stress Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Volume2 className="text-cyan-400" size={18} /> Driver Radio Timeline & Audio Analysis
                </h3>
                <span className="text-xs text-slate-400">{messages.length} radio messages captured</span>
              </div>

              {messages.length === 0 ? (
                <div className="glass-panel p-8 text-center text-slate-400 text-sm rounded-2xl">
                  No radio messages available for this driver.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePlayAudio(msg.id, msg.audio_filename)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition shadow-lg ${
                            currentPlayingId === msg.id
                              ? 'bg-red-600 text-white animate-pulse shadow-red-600/40'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {currentPlayingId === msg.id ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-white font-mono">{msg.driver_code}</strong>
                            <span className="text-xs font-mono text-slate-400">Lap #{msg.lap_number || 'N/A'}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{msg.message_timestamp}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block">Duration: {msg.duration}s</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getWerBadge(msg.wer)}
                        {getMoodBadge(msg.mood_label)}
                      </div>
                    </div>

                    {/* Transcripts Comparison Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-400" /> Ground Truth Transcript
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed font-sans">
                          "{msg.ground_truth_transcript}"
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                          <Cpu size={11} className="text-cyan-400" /> Whisper STT Inference
                        </span>
                        <p className="text-xs text-cyan-200 leading-relaxed font-sans">
                          "{msg.whisper_transcript}"
                        </p>
                      </div>
                    </div>

                    {/* Dimensional Emotion Scores Gauge Bar */}
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4 font-mono">
                      <div className="flex items-center gap-6">
                        <div>
                          <span>Arousal: </span>
                          <strong className="text-white">{(msg.arousal * 100).toFixed(0)}%</strong>
                        </div>
                        <div>
                          <span>Valence: </span>
                          <strong className="text-white">{(msg.valence * 100).toFixed(0)}%</strong>
                        </div>
                        <div>
                          <span>Dominance: </span>
                          <strong className="text-white">{(msg.dominance * 100).toFixed(0)}%</strong>
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-500 italic">
                        Model: audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Audio Analyzer Upload Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Upload className="text-red-500" size={20} /> Live Audio Clip Analyzer
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Upload any Formula 1 driver radio recording (.wav, .mp3) to run Whisper STT transcription and Wav2Vec2 vocal stress scoring live on stage.
              </p>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Select Audio File</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl p-3 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    Reference Ground-Truth Transcript (Optional for WER computation)
                  </label>
                  <textarea
                    rows={2}
                    value={uploadRefText}
                    onChange={(e) => setUploadRefText(e.target.value)}
                    placeholder="e.g. Yellow flag turn 1 box box this lap..."
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl p-3 focus:outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                  {uploading ? 'Running Models...' : 'Analyze Audio Clip'}
                </button>
              </form>
            </div>

            {/* Upload Analysis Result Card */}
            {uploadResult && (
              <div className="glass-panel p-6 rounded-2xl border border-emerald-500/40 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-400" size={18} /> Analysis Complete
                  </h3>
                  {getMoodBadge(uploadResult.mood_label)}
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Whisper STT Output</span>
                    <p className="text-sm font-semibold text-white">"{uploadResult.whisper_transcript}"</p>
                  </div>

                  {uploadResult.reference_transcript && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Word Error Rate (WER)</span>
                        <p className="text-xs text-slate-300">Measured against provided ground truth</p>
                      </div>
                      {getWerBadge(uploadResult.wer)}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-center pt-2">
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block mb-1">AROUSAL</span>
                      <strong className="text-base font-mono text-red-400">{(uploadResult.arousal * 100).toFixed(0)}%</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block mb-1">VALENCE</span>
                      <strong className="text-base font-mono text-cyan-400">{(uploadResult.valence * 100).toFixed(0)}%</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block mb-1">DOMINANCE</span>
                      <strong className="text-base font-mono text-emerald-400">{(uploadResult.dominance * 100).toFixed(0)}%</strong>
                    </div>
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
