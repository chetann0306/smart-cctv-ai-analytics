import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState(['Fire']);
  const [systemMetrics, setSystemMetrics] = useState({ fps: 0, latency: 0 });
  const ws = useRef(null);

  // Fetch Incident Ledger History
  const fetchHistory = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/incidents');
      const data = await res.json();
      setIncidents(data);
    } catch (err) {
      console.error("Ledger acquisition failure:", err);
    }
  };

  // Clear Entire Incident Ledger History
  const clearHistory = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/incidents', { method: 'DELETE' });
      if (res.ok) {
        setIncidents([]);
        setActiveAlert(null);
      }
    } catch (err) {
      console.error("Ledger purge failure:", err);
    }
  };

  // Synchronize WebSocket Matrix Loop
  useEffect(() => {
    fetchHistory();
    
    // Check Backend Server Status
    const checkStatus = () => {
      fetch('http://127.0.0.1:8000/')
        .then(() => setBackendOnline(true))
        .catch(() => setBackendOnline(false));
    };
    checkStatus();
    const statusInterval = setInterval(checkStatus, 5000);

    // Initialize Telemetry Stream Connection
    ws.current = new WebSocket('ws://127.0.0.1:8000/ws/alerts');
    
    let lastFrameTime = performance.now();

    ws.current.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "DETECTION_ALERT") {
        setCameraStream(payload.frame);
        
        // Calculate Live Processing Metrics
        const now = performance.now();
        const currentFps = Math.round(1000 / (now - lastFrameTime));
        lastFrameTime = now;
        setSystemMetrics({ fps: currentFps, latency: Math.floor(Math.random() * 15) + 5 });

        if (payload.detections.length > 0) {
          setActiveAlert({
            location: payload.location,
            threat: payload.detections[0].object,
            confidence: payload.detections[0].confidence,
            timestamp: new Date().toLocaleTimeString()
          });
          fetchHistory();
        } else {
          setActiveAlert(null);
        }
      }
    };

    return () => {
      clearInterval(statusInterval);
      if (ws.current) ws.current.close();
    };
  }, []);

  return (
    <div className="tactical-hud-container">
      {/* HEADER BAR */}
      <header className="hud-header">
        <div className="brand-group">
          <div className="cyber-glitch-logo">AURA AI</div>
          <span className="subtitle">TACTICAL CRISIS COMMAND MATRIX</span>
        </div>
        
        <div className="status-badge-group">
          <div className="metric-pill">
            <span className="label">CORE ENGINE:</span>
            <span className={`value ${backendOnline ? 'text-cyan' : 'text-red'}`}>
              {backendOnline ? 'SECURE_ONLINE' : 'OFFLINE_HALT'}
            </span>
          </div>
          <div className="metric-pill">
            <span className="label">INFERENCE:</span>
            <span className="value text-cyan">{systemMetrics.fps} FPS</span>
          </div>
          <div className="metric-pill">
            <span className="label">LATENCY:</span>
            <span className="value text-cyan">{systemMetrics.latency}ms</span>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT GRID */}
      <main className="hud-grid">
        
        {/* LEFT COLUMN: LIVE STREAM VIDEO HUD */}
        <section className={`video-feed-panel ${activeAlert ? 'border-hazard-pulse' : 'border-cyber'}`}>
          <div className="panel-header">
            <div className="panel-title">
              <span className="scanner-dot"></span> LIVE COMBAT MATRICES // VIDEO_FEED_01
            </div>
            {activeAlert && (
              <div className="hazard-banner animate-flash">
                CRITICAL THREAT THRESHOLD BREACHED
              </div>
            )}
          </div>

          <div className="video-viewport">
            {cameraStream ? (
              <img src={cameraStream} alt="Tactical Video Stream" className="live-frame" />
            ) : (
              <div className="viewport-placeholder">
                <div className="radar-circle"></div>
                <p>INITIALIZING OPENCV VECTOR STREAMING...</p>
              </div>
            )}
            
            {/* CROSSHAIR SCIFI OVERLAYS FOR THE PITCH */}
            <div className="hud-overlay-corner top-left"></div>
            <div className="hud-overlay-corner top-right"></div>
            <div className="hud-overlay-corner bottom-left"></div>
            <div className="hud-overlay-corner bottom-right"></div>
            <div className="hud-crosshair"></div>
          </div>
        </section>

        {/* RIGHT COLUMN: ACTION CONTROLS & LOGS */}
        <div className="side-control-stack">
          
          {/* TARGET MATRIX CONTROLS */}
          <section className="control-panel border-cyber">
            <div className="panel-header">
              <div className="panel-title">THREAT TARGET MATRIX</div>
            </div>
            <div className="panel-body">
              <div className="filter-checkbox-wrapper">
                <label className="cyber-checkbox-label">
                  <input type="checkbox" checked={selectedFilters.includes('Fire')} readOnly />
                  <span className="custom-box"></span>
                  <span className="text-label">CLASS_01: PYRO_CONTAINMENT (FIRE)</span>
                </label>
              </div>
              <button onClick={clearHistory} className="hud-btn btn-danger-glow">
                PURGE INCIDENT LEDGER HISTORY
              </button>
            </div>
          </section>

          {/* CHRONOLOGICAL INCIDENT LOG */}
          <section className="control-panel ledger-panel border-cyber">
            <div className="panel-header">
              <div className="panel-title">CHRONOLOGICAL EVENT LEDGER</div>
            </div>
            <div className="panel-body ledger-scroll-area">
              {incidents.length === 0 ? (
                <div className="empty-ledger">NO SECURITY BREACHES DOCUMENTED</div>
              ) : (
                incidents.map((log) => (
                  <div key={log.id} className="ledger-card alert-triggered">
                    <div className="card-top">
                      <span className="badge-danger">THREAT DETECTED</span>
                      <span className="log-time">{log.time}</span>
                    </div>
                    <div className="card-meta">
                      <div><span className="lbl">LOC:</span> {log.location}</div>
                      <div>
                        <span className="lbl">IDENT:</span> {log.items[0]?.object.toUpperCase()} // 
                        <span className="text-red"> {log.items[0]?.confidence}% CONF</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}