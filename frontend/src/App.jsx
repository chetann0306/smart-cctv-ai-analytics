import React, { useState, useEffect, useRef } from 'react';
import { Shield, Eye, AlertTriangle, Activity, Wifi, WifiOff, Clock, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [activeDetections, setActiveDetections] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef(new Audio('/alert.ogg'));

  useEffect(() => {
    audioRef.current.loop = false;

    // Fetch previous logs from backend SQLite history endpoint
    fetch('http://127.0.0.1:8000/api/incidents')
      .then((res) => res.json())
      .then((data) => setAlerts(data))
      .catch((err) => console.error("Error retrieving historical log records:", err));
    
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/alerts');

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.event === 'DETECTION_ALERT') {
        setActiveDetections(data.detections);
        
        if (data.detections.length > 0 && !isMuted) {
          audioRef.current.play().catch((e) => {});
        }
        
        setAlerts((prev) => [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            location: data.location,
            items: data.detections
          },
          ...prev.slice(0, 49) // Keep an extended ledger list size
        ]);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setActiveDetections([]);
    };

    return () => ws.close();
  }, [isMuted]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-500 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">AURA AI</h1>
            <p className="text-xs text-slate-400">Smart CCTV Analytics SaaS</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              isMuted 
                ? 'bg-slate-900 text-slate-400 border-slate-800' 
                : 'bg-indigo-950/40 text-indigo-400 border-indigo-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            isConnected ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/50 text-rose-400 border-rose-500/30'
          }`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isConnected ? 'AI ENGINE ONLINE' : 'AI ENGINE OFFLINE'}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden aspect-video flex flex-col justify-center items-center shadow-2xl">
            <div className="absolute top-4 left-4 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded text-xs font-semibold flex items-center gap-2 text-slate-300">
              <Eye className="w-3.5 h-3.5 text-indigo-400" /> CAMERA_FEED_01 (LIVE)
            </div>
            
            {activeDetections.length > 0 ? (
              <div className="text-center p-6 bg-rose-500/10 border border-rose-500/20 rounded-lg max-w-sm">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-2 animate-bounce" />
                <h3 className="text-lg font-bold text-rose-400">Threat Flags Flagged</h3>
                <p className="text-xs text-slate-400 mt-1">YOLO processing pipeline broadcasting dynamic coordinates...</p>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-2 text-slate-700 animate-pulse" />
                <p className="text-sm font-medium">Monitoring active stream infrastructure</p>
                <p className="text-xs text-slate-600">No telemetry anomalies flagged</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Object Telemetry</h2>
            {activeDetections.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {activeDetections.map((det, index) => (
                  <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 flex items-center gap-4">
                    <span className="text-sm font-bold text-indigo-400 capitalize">{det.object}</span>
                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                      {det.confidence}% Conf
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Awaiting computer vision analysis parameters...</p>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[550px] lg:h-auto">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Persistent Incident Ledger
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 h-[450px]">
            {alerts.length > 0 ? (
              alerts.map((alert, idx) => (
                <div key={alert.id || idx} className="bg-slate-950 border-l-2 border-l-rose-500 border-y border-r border-slate-800 rounded-r-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-slate-500">{alert.time}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded">
                      Archived Log
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">{alert.location}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {alert.items.map((it, i) => (
                      <span key={i} className="text-[11px] font-medium bg-slate-900 text-indigo-300 px-2 py-0.5 rounded border border-slate-800">
                        {it.object} ({Math.round(it.confidence)}%)
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-4">
                <Shield className="w-8 h-8 mb-2 text-slate-800" />
                <p className="text-xs italic">No database events indexed inside historical storage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}