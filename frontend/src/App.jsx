import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Shield, Eye, AlertTriangle, Activity, Wifi, WifiOff, Clock, Volume2, VolumeX, Filter, BarChart3, TrendingUp, ShieldAlert, Trash2 } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [activeDetections, setActiveDetections] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  
  // Custom Emergency Real Target Pools
  const availableFilters = ["fire", "smoke"];
  const [activeFilters, setActiveFilters] = useState(availableFilters);
  
  const audioRef = useRef(new Audio('/alert.ogg'));

  useEffect(() => {
    audioRef.current.loop = false;

    fetch('http://127.0.0.1:8000/api/incidents')
      .then((res) => res.json())
      .then((data) => setAlerts(data))
      .catch((err) => console.error("Error retrieving historical records:", err));
    
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
          ...prev.slice(0, 49)
        ]);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setActiveDetections([]);
    };

    return () => ws.close();
  }, [isMuted]);

  const handleFilterToggle = (filterItem) => {
    let updatedFilters;
    if (activeFilters.includes(filterItem)) {
      updatedFilters = activeFilters.filter(item => item !== filterItem);
    } else {
      updatedFilters = [...activeFilters, filterItem];
    }
    
    setActiveFilters(updatedFilters);

    fetch('http://127.0.0.1:8000/api/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFilters)
    }).catch(err => console.error("Error syncing custom filter updates:", err));
  };

  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to permanently clear out the persistent database history ledger?")) {
      fetch('http://127.0.0.1:8000/api/incidents', {
        method: 'DELETE'
      })
      .then(() => {
        setAlerts([]);
      })
      .catch(err => console.error("Error clearing backend persistent storage:", err));
    }
  };

  const sessionStats = useMemo(() => {
    if (alerts.length === 0) return { total: 0, peakConf: 0, dominant: 'None' };

    let totalItemsCount = 0;
    let maxConfidence = 0;
    const frequencyMap = {};

    alerts.forEach(alert => {
      alert.items.forEach(item => {
        totalItemsCount++;
        if (item.confidence > maxConfidence) {
          maxConfidence = item.confidence;
        }
        frequencyMap[item.object] = (frequencyMap[item.object] || 0) + 1;
      });
    });

    let topObject = 'None';
    let maxFrequency = 0;
    Object.entries(frequencyMap).forEach(([obj, freq]) => {
      if (freq > maxFrequency) {
        maxFrequency = freq;
        topObject = obj;
      }
    });

    return { total: totalItemsCount, peakConf: maxConfidence, dominant: topObject };
  }, [alerts]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-rose-500 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">AURA AI</h1>
            <p className="text-xs text-slate-400">Crisis Response & Hazard Analytics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              isMuted ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            isConnected ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/50 text-rose-400 border-rose-500/30'
          }`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isConnected ? 'CRISIS ENGINE ONLINE' : 'CRISIS ENGINE OFFLINE'}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Incidents Logged</p>
            <p className="text-2xl font-bold font-mono text-slate-100">{sessionStats.total}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Peak Hazard Confidence</p>
            <p className="text-2xl font-bold font-mono text-slate-100">{sessionStats.peakConf}%</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Primary Threat Vector</p>
            <p className="text-2xl font-bold text-slate-100 capitalize">{sessionStats.dominant}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden aspect-video flex flex-col justify-center items-center shadow-2xl">
            <div className="absolute top-4 left-4 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded text-xs font-semibold flex items-center gap-2 text-slate-300">
              <Eye className="w-3.5 h-3.5 text-rose-400" /> DISPATCH_FEED_01 (LIVE)
            </div>
            
            {activeDetections.length > 0 ? (
              <div className="text-center p-6 bg-red-500/10 border border-red-500/20 rounded-lg max-w-sm">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2 animate-bounce" />
                <h3 className="text-lg font-bold text-red-400">CRITICAL THREAT FLAGGED</h3>
                <p className="text-xs text-slate-400 mt-1">Telemetry parsing pipeline identifying active local hazard matrix...</p>
              </div>
            ) : (
              <div className="text-center text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-2 text-slate-700 animate-pulse" />
                <p className="text-sm font-medium">Monitoring active hazard matrix</p>
                <p className="text-xs text-slate-600">No telemetry anomalies flagged</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="pb-2 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-rose-400" /> Active Threat Filtering Console
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Toggle hazard fields to control live emergency tracking vectors.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              {availableFilters.map((filter) => {
                const checked = activeFilters.includes(filter);
                return (
                  <button
                    key={filter}
                    onClick={() => handleFilterToggle(filter)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs font-mono tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                      checked
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 shadow-md shadow-rose-950/20'
                        : 'bg-slate-950 border-slate-800/80 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <span>{filter}</span>
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                      checked ? 'bg-rose-500 border-rose-400' : 'border-slate-700'
                    }`}>
                      {checked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {activeDetections.length > 0 && (
              <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-2">
                {activeDetections.map((det, index) => (
                  <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3">
                    <span className="text-xs font-bold text-red-400 uppercase">{det.object}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                      {det.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[550px] lg:h-auto">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" /> Emergency Log Ledger
            </h2>
            {alerts.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="flex items-center gap-1.5 text-xs font-medium text-red-400/80 hover:text-red-400 bg-red-950/30 hover:bg-red-950/60 border border-red-900/40 px-2 py-1 rounded transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Purge Logs
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 h-[450px]">
            {alerts.length > 0 ? (
              alerts.map((alert, idx) => (
                <div key={alert.id || idx} className="bg-slate-950 border-l-2 border-l-red-500 border-y border-r border-slate-800 rounded-r-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-slate-500">{alert.time}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                      Hazard Hit
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">{alert.location}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {alert.items.map((it, i) => (
                      <span key={i} className="text-[11px] font-medium bg-slate-900 text-red-300 px-2 py-0.5 rounded border border-slate-800 uppercase">
                        {it.object} ({Math.round(it.confidence)}%)
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-4">
                <Shield className="w-8 h-8 mb-2 text-slate-800" />
                <p className="text-xs italic">No matching emergency anomalies indexed inside active storage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}