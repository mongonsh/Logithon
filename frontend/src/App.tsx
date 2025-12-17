import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

type Box = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  confidence?: number;
};

import { Buffer } from "buffer";

// @ts-ignore
window.Buffer = Buffer;

const theme = {
  bg: "#0a0a0b",
  panel: "#141416",
  text: "#e8e8ea",
  accent: "#4a7c9e",
  success: "#4a9e6a",
  warning: "#d4a24a",
  error: "#c85a5a",
};

const Header: React.FC<{
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  language: string;
  setLanguage: (l: string) => void;
}> = ({ isConnected, onConnect, onDisconnect, language, setLanguage }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        background: theme.panel,
        borderBottom: `1px solid ${theme.accent}`,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: "bold", fontSize: 18 }}>
        <span style={{ color: theme.accent }}>LOGI</span>THON
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>Language</span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{ background: "#1b1c1e", color: theme.text, borderRadius: 6 }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </div>
  );
};

const LeftPanel: React.FC<{
  onImageSelected: (file: File) => void;
  vehicle: string;
  setVehicle: (v: string) => void;
  route: string;
  setRoute: (r: string) => void;
  imagePreview: string | null;
  detections: Box[];
  pixelBoxes?: { id: string; x: number; y: number; w: number; h: number; label?: string; confidence?: number }[];
  imageSize?: { w: number; h: number } | null;
}> = ({ onImageSelected, vehicle, setVehicle, route, setRoute, imagePreview, detections, pixelBoxes = [], imageSize }) => {
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode === "camera" && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      });
    } else {
      // Stop camera stream if not in camera mode
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
    }
  }, [mode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          onImageSelected(file);
          setMode("upload"); // Switch back to view result
        }
      }, "image/jpeg");
    }
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "1px solid #333", paddingBottom: 8 }}>
        <button
          onClick={() => setMode("upload")}
          style={{
            flex: 1,
            background: mode === "upload" ? theme.accent : "transparent",
            color: mode === "upload" ? "#fff" : "#888",
            border: "none",
            padding: 8,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Upload
        </button>
        <button
          onClick={() => setMode("camera")}
          style={{
            flex: 1,
            background: mode === "camera" ? theme.accent : "transparent",
            color: mode === "camera" ? "#fff" : "#888",
            border: "none",
            padding: 8,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Camera
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {mode === "upload" ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImageSelected(file);
                }}
                style={{ color: theme.text, width: "100%" }}
              />
            </div>
            {imagePreview && (
              <div style={{ 
                position: "relative", 
                flex: 1, 
                overflow: "hidden", 
                border: "1px solid #333", 
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000"
              }}>
                 {imageSize ? (
                   <div style={{
                     position: "relative",
                     aspectRatio: `${imageSize.w} / ${imageSize.h}`,
                     maxWidth: "100%",
                     maxHeight: "100%"
                   }}>
                      <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", display: "block" }} />
                      {pixelBoxes.length > 0 && (
                        <div style={{ position: "absolute", inset: 0 }}>
                          {pixelBoxes.map((b) => {
                            const leftPct = (b.x / imageSize.w) * 100;
                            const topPct = (b.y / imageSize.h) * 100;
                            const widthPct = (b.w / imageSize.w) * 100;
                            const heightPct = (b.h / imageSize.h) * 100;
                            return (
                              <div
                                key={b.id}
                                style={{
                                  position: "absolute",
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  height: `${heightPct}%`,
                                  border: "2px solid #8a6232",
                                  boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                                  background: "rgba(192, 143, 79, 0.15)"
                                }}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: -35,
                                    left: 0,
                                    background: "#C08F4F",
                                    color: "#2a1d10",
                                    fontSize: 11,
                                    padding: "3px 6px",
                                    borderRadius: 4,
                                    border: "1px solid #8a6232",
                                    whiteSpace: "nowrap",
                                    zIndex: 10,
                                    maxWidth: "200px"
                                  }}
                                >
                                  <div style={{ fontWeight: "bold" }}>{b.id}</div>
                                  <div style={{ fontSize: 10 }}>
                                    {b.w}×{b.h}px
                                    {b.label ? ` • ${b.label}` : ""}
                                    {typeof b.confidence === "number" ? ` • ${(b.confidence * 100).toFixed(0)}%` : ""}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              background: "#2a2b2d",
                              color: "#e8e8ea",
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              border: "1px solid #444",
                              zIndex: 20
                            }}
                          >
                            {pixelBoxes.length} detected
                          </div>
                        </div>
                       )}
                   </div>
                 ) : (
                   <img src={imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                 )}
              </div>
            )}
          </>
        ) : (
          <div style={{ position: "relative", flex: 1, background: "#000", borderRadius: 8, overflow: "hidden" }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <button
              onClick={capturePhoto}
              style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "#fff",
                border: "4px solid #ccc",
                cursor: "pointer",
              }}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>Vehicle</div>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            style={{ background: "#1b1c1e", color: theme.text, borderRadius: 6, width: "100%", padding: 8 }}
          >
            <option value="van">Van</option>
            <option value="truck">Truck</option>
            <option value="trailer">Trailer</option>
          </select>
        </div>
        <div>
          <div style={{ marginBottom: 6 }}>Route Planning</div>
          <input
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder="Enter route"
            style={{
              background: "#1b1c1e",
              color: theme.text,
              borderRadius: 6,
              border: "1px solid #333",
              padding: 8,
              width: "100%",
              boxSizing: "border-box"
            }}
          />
        </div>
        
        {/* Box Detection Summary */}
        {pixelBoxes.length > 0 && (
          <div style={{ marginTop: 12, padding: 8, background: "rgba(192, 143, 79, 0.1)", borderRadius: 6, border: "1px solid rgba(192, 143, 79, 0.3)" }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#C08F4F", marginBottom: 6 }}>
              DETECTED BOXES ({pixelBoxes.length})
            </div>
            <div style={{ maxHeight: 120, overflowY: "auto" }}>
              {pixelBoxes.map((box, i) => (
                <div key={box.id} style={{ fontSize: 11, marginBottom: 4, color: "#ccc" }}>
                  <span style={{ color: "#C08F4F", fontWeight: "bold" }}>{box.id}:</span> {box.w}×{box.h}px
                  {box.label && <span style={{ color: "#888" }}> • {box.label}</span>}
                  {typeof box.confidence === "number" && (
                    <span style={{ color: "#888" }}> • {(box.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 6, fontStyle: "italic" }}>
              Estimated total area: {pixelBoxes.reduce((sum, box) => sum + (box.w * box.h), 0).toLocaleString()} px²
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const GridPanel: React.FC<{
  boxes: Box[];
  setBoxes: (b: Box[]) => void;
  show3D: boolean;
  setShow3D: (v: boolean) => void;
  showPath: boolean;
  setShowPath: (v: boolean) => void;
}> = ({ boxes, setBoxes, show3D, setShow3D, showPath, setShowPath }) => {
  const gridW = 20;
  const gridH = 15;
  const cellSize = 24;

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  };
  const onDrop = (e: React.DragEvent, gx: number, gy: number) => {
    const id = e.dataTransfer.getData("text/plain");
    setBoxes(
      boxes.map((b) => (b.id === id ? { ...b, x: gx, y: gy } : b))
    );
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div style={{ padding: 12, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={show3D} onChange={(e) => setShow3D(e.target.checked)} />
          3D View
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={showPath} onChange={(e) => setShowPath(e.target.checked)} />
          Path Visualization
        </label>
      </div>
      <div
        style={{
          position: "relative",
          background: "#1b1c1e",
          border: `1px solid ${theme.accent}`,
          width: gridW * cellSize,
          height: gridH * cellSize,
        }}
        onDragOver={onDragOver}
        onDrop={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          const gx = Math.floor((e.clientX - rect.left) / cellSize);
          const gy = Math.floor((e.clientY - rect.top) / cellSize);
          onDrop(e, gx, gy);
        }}
      >
        {Array.from({ length: gridH }).map((_, gy) =>
          Array.from({ length: gridW }).map((_, gx) => (
            <div
              key={`${gx}-${gy}`}
              style={{
                position: "absolute",
                left: gx * cellSize,
                top: gy * cellSize,
                width: cellSize,
                height: cellSize,
                border: "1px solid #2a2b2d",
                boxSizing: "border-box",
              }}
            />
          ))
        )}
        {boxes.map((b) => (
          <div
            key={b.id}
            draggable
            onDragStart={(e) => onDragStart(e, b.id)}
            title={`${b.id} (${b.w}x${b.h})`}
            style={{
              position: "absolute",
              left: b.x * cellSize,
              top: b.y * cellSize,
              width: b.w * cellSize,
              height: b.h * cellSize,
              background: "#C08F4F",
              border: `2px solid #8a6232`,
              color: "#2a1d10",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            {b.id}
          </div>
        ))}
      </div>
    </div>
  );
};

const VoiceVisualizer: React.FC<{ analyser: AnalyserNode | null }> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 50;

      // Draw pulsating glow
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const scale = 1 + average / 256;

      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 3 * scale);
      gradient.addColorStop(0, "rgba(74, 124, 158, 0.8)");
      gradient.addColorStop(0.5, "rgba(74, 124, 158, 0.3)");
      gradient.addColorStop(1, "rgba(74, 124, 158, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 3 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw circular waveform
      ctx.beginPath();
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const angle = (i / bufferLength) * 2 * Math.PI;
        const r = radius + (v * 30);
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = "#4a7c9e";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyser]);

  return <canvas ref={canvasRef} width={300} height={200} style={{ width: "100%", height: 200 }} />;
};

const ModernVoicePanel: React.FC<{
  history: string[];
  warnings: string[];
  sequence: string[];
  onAsk: (text: string) => void;
  count: number;
  setCount: (n: number) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  analyser: AnalyserNode | null;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  updateLoadPlan: (count: number) => void;
  originalDetectedCount: number;
}> = ({ history, warnings, sequence, onAsk, count, setCount, isConnected, onConnect, onDisconnect, analyser, audioEnabled, setAudioEnabled, updateLoadPlan, originalDetectedCount }) => {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div style={{ 
      padding: 16, 
      display: "flex", 
      flexDirection: "column", 
      gap: 16, 
      height: "100%",
      background: "linear-gradient(180deg, rgba(20,20,22,1) 0%, rgba(10,10,11,1) 100%)",
      borderRadius: 12
    }}>
      {/* Voice Status / Visualizer */}
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center",
        minHeight: 220,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 16,
        position: "relative",
        overflow: "hidden"
      }}>
        {isConnected ? (
          <>
            <VoiceVisualizer analyser={analyser} />
            <button
              onClick={onDisconnect}
              style={{
                position: "absolute",
                bottom: 16,
                background: "rgba(200, 90, 90, 0.2)",
                color: "#ff6b6b",
                border: "1px solid rgba(200, 90, 90, 0.4)",
                padding: "8px 24px",
                borderRadius: 20,
                backdropFilter: "blur(4px)",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.2s"
              }}
            >
              End Call
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4a7c9e 0%, #2a4c6e 100%)",
              border: "none",
              boxShadow: "0 8px 32px rgba(74, 124, 158, 0.3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.2s"
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.66 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        )}
        <div style={{ marginTop: isConnected ? 0 : 16, color: isConnected ? theme.accent : "#888", fontSize: 14 }}>
          {isConnected ? "🎤 Listening... Speak now!" : "Tap to Speak"}
        </div>
        {!audioEnabled && (
          <div style={{ marginTop: 8, color: theme.warning, fontSize: 12, textAlign: "center" }}>
            Audio responses disabled - click 🔊 below to enable
          </div>
        )}
        {audioEnabled && (
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <button
              onClick={() => {
                const testAudio = new Audio('/audio/04480ff0-c1ab-4ad6-bad5-2273f8688385.mp3');
                testAudio.play().then(() => {
                  console.log('Test audio played successfully');
                }).catch(e => {
                  console.error('Test audio failed:', e);
                });
              }}
              style={{
                background: "rgba(74, 124, 158, 0.2)",
                color: theme.accent,
                border: "1px solid rgba(74, 124, 158, 0.4)",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 10,
                cursor: "pointer"
              }}
            >
              Test Audio
            </button>
            <button
              onClick={() => {
                console.log('Testing onAsk function');
                onAsk("Hello, this is a test message");
              }}
              style={{
                background: "rgba(74, 158, 74, 0.2)",
                color: "#4a9e4a",
                border: "1px solid rgba(74, 158, 74, 0.4)",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 10,
                cursor: "pointer"
              }}
            >
              Test Chat
            </button>
          </div>
        )}
      </div>

      {/* Manual Count Correction */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: 8, border: "1px solid rgba(74, 124, 158, 0.3)" }}>
        <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Box Count Correction</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "#ccc" }}>Count:</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setCount(Math.max(0, count - 1))}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: theme.accent,
                width: 24,
                height: 24,
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              −
            </button>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 0)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: theme.accent,
                fontSize: 16,
                fontWeight: "bold",
                width: 60,
                padding: "4px 8px",
                borderRadius: 4,
                outline: "none",
                textAlign: "center"
              }}
            />
            <button
              onClick={() => setCount(count + 1)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: theme.accent,
                width: 24,
                height: 24,
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              +
            </button>
          </div>
          <span style={{ fontSize: 11, color: "#888" }}>boxes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", flex: 1 }}>
            {count !== originalDetectedCount 
              ? `Corrected from ${originalDetectedCount} to ${count} boxes`
              : "Edit this if the AI counted incorrectly"
            }
          </div>
          <button
            onClick={() => updateLoadPlan(count)}
            style={{
              background: theme.accent,
              color: "#fff",
              border: "none",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 10,
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Update Plan
          </button>
        </div>
      </div>

      {/* Modern Chat History */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ marginBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#666" }}>
          Live Transcript
        </div>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingRight: 4
          }}
        >
          {history.length === 0 && (
            <div style={{ textAlign: "center", color: "#444", marginTop: 40, fontSize: 14 }}>
              Start voice or type below<br/>to begin logistics planning.
            </div>
          )}
          {history.map((h, i) => {
            const isUser = h.startsWith("You:");
            const text = h.replace(/^(You:|AI:)\s*/, "");
            return (
              <div key={i} style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: isUser ? "#4a7c9e" : "#2a2b2d",
                color: isUser ? "#fff" : "#eee",
                padding: "10px 14px",
                borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                fontSize: 14,
                lineHeight: 1.4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
              }}>
                {text}
              </div>
            );
          })}
        </div>
      </div>

      {/* Input Area */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && message.trim() && (onAsk(message), setMessage(""))}
          placeholder="Type a message..."
          style={{
            background: "rgba(255,255,255,0.05)",
            color: theme.text,
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "12px 16px",
            flex: 1,
            outline: "none",
            fontSize: 14
          }}
        />
        <button
          onClick={() => {
            if (message.trim()) {
              onAsk(message);
              setMessage("");
            }
          }}
          style={{
            background: "rgba(255,255,255,0.1)",
            color: theme.text,
            border: "none",
            width: 42,
            height: 42,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          style={{
            background: audioEnabled ? "rgba(74, 158, 74, 0.2)" : "rgba(200, 90, 90, 0.2)",
            color: audioEnabled ? "#4a9e4a" : "#c85a5a",
            border: `1px solid ${audioEnabled ? "rgba(74, 158, 74, 0.4)" : "rgba(200, 90, 90, 0.4)"}`,
            width: 42,
            height: 42,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12
          }}
          title={audioEnabled ? "Audio enabled" : "Audio disabled - click to enable"}
        >
          🔊
        </button>
      </div>

      {/* Info Cards (Compact) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ 
          background: count !== originalDetectedCount ? "rgba(212, 162, 74, 0.1)" : "rgba(74, 124, 158, 0.1)", 
          padding: 10, 
          borderRadius: 8,
          border: `1px solid ${count !== originalDetectedCount ? "rgba(212, 162, 74, 0.3)" : "rgba(74, 124, 158, 0.3)"}`
        }}>
          <div style={{ 
            fontSize: 11, 
            color: count !== originalDetectedCount ? theme.warning : theme.accent, 
            marginBottom: 4, 
            fontWeight: "bold" 
          }}>
            {count !== originalDetectedCount ? "MANUALLY CORRECTED" : "DETECTED COUNT"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value || "0", 10))}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: count !== originalDetectedCount ? theme.warning : theme.accent,
                fontSize: 16,
                fontWeight: "bold",
                width: 50,
                padding: "2px 4px",
                borderRadius: 3,
                textAlign: "center"
              }}
            />
            <span style={{ fontSize: 12, color: "#ccc" }}>boxes</span>
            {count !== originalDetectedCount && (
              <button
                onClick={() => setCount(originalDetectedCount)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#888",
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 3,
                  cursor: "pointer"
                }}
                title="Reset to detected count"
              >
                ↺
              </button>
            )}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>STATUS</div>
          <div style={{ fontSize: 13, color: warnings.length ? theme.warning : theme.success }}>
            {warnings.length ? `${warnings.length} Warnings` : "Optimal"}
          </div>
        </div>
      </div>
    </div>
  );
};

const RightPanel: React.FC<{
  history: string[];
  warnings: string[];
  sequence: string[];
  onAsk: (text: string) => void;
  count: number;
  setCount: (n: number) => void;
}> = ({ history, warnings, sequence, onAsk, count, setCount }) => {
  const [message, setMessage] = useState("");

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ marginBottom: 6 }}>Conversation</div>
        <div
          style={{
            background: "#1b1c1e",
            border: "1px solid #333",
            padding: 8,
            height: 200,
            overflow: "auto",
          }}
        >
          {history.map((h, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              {h}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask logistics advice..."
            style={{
              background: "#1b1c1e",
              color: theme.text,
              borderRadius: 6,
              border: "1px solid #333",
              padding: 8,
              flex: 1,
            }}
          />
          <button
            onClick={() => {
              onAsk(message);
              setMessage("");
            }}
            style={{
              background: theme.accent,
              color: theme.text,
              border: "none",
              padding: "8px 12px",
              borderRadius: 6,
            }}
          >
            Send
          </button>
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 6 }}>Manual Count Correction</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value || "0", 10))}
            style={{
              background: "#1b1c1e",
              color: theme.text,
              borderRadius: 6,
              border: "1px solid #333",
              padding: 8,
              width: 120,
            }}
          />
          <span>boxes</span>
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 6 }}>Warnings</div>
        {warnings.length === 0 ? (
          <div style={{ color: "#888" }}>None</div>
        ) : (
          warnings.map((w, i) => (
            <div key={i} style={{ color: theme.warning }}>
              {w}
            </div>
          ))
        )}
      </div>
      <div>
        <div style={{ marginBottom: 6 }}>Loading Sequence</div>
        <div
          style={{
            background: "#1b1c1e",
            border: "1px solid #333",
            padding: 8,
            minHeight: 80,
          }}
        >
          {sequence.join(" → ")}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [language, setLanguage] = useState("en");
  const [vehicle, setVehicle] = useState("van");
  const [route, setRoute] = useState("");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [pixelBoxes, setPixelBoxes] = useState<
    { id: string; x: number; y: number; w: number; h: number; label?: string; confidence?: number }[]
  >([]);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sequence, setSequence] = useState<string[]>([]);
  const [manualCount, setManualCount] = useState<number>(0);
  const [originalDetectedCount, setOriginalDetectedCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const onAsk = useCallback(async (text: string) => {
    console.log('onAsk called with text:', text);
    if (!text.trim()) return;
    setHistory((h) => [...h, `You: ${text}`]);
    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: text },
            { role: "user", content: `Current box count: ${manualCount}` },
            { role: "user", content: `Detected boxes details: ${pixelBoxes.map(b => `${b.id} (${b.w}×${b.h}px, ${b.label || 'box'}, ${typeof b.confidence === 'number' ? (b.confidence * 100).toFixed(0) + '%' : 'unknown'} confidence)`).join(', ')}` },
          ],
          context: { boxes, route, vehicle, pixelBoxes, imageSize },
        }),
      });
      const data = await res.json();
      setHistory((h) => [...h, `AI: ${data.reply}`]);

      // Play audio response if available and audio is enabled
      if (data.audio_url && audioEnabled) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(data.audio_url);
        audioRef.current = audio;
        
        // Add event listeners for better debugging
        audio.addEventListener('loadstart', () => console.log('Audio loading started'));
        audio.addEventListener('canplay', () => console.log('Audio can play'));
        audio.addEventListener('error', (e) => console.error('Audio error event:', e));
        
        audio.play().catch(e => {
          console.error("Audio playback error:", e);
          // Try to enable audio context if it's suspended
          if (e.name === 'NotAllowedError') {
            console.log('Audio playback blocked - user interaction required');
          }
        });
      }
    } catch (e) {
      console.error("Chat error:", e);
      setHistory((h) => [...h, "AI: Sorry, I encountered an error."]);
    }
  }, [manualCount, boxes, route, vehicle, audioEnabled, pixelBoxes, imageSize]);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    console.log('Initializing speech recognition, support:', !!SpeechRecognition);
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsConnected(true);
      };
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsConnected(false);
      };
      recognition.onresult = (event: any) => {
        console.log('Speech recognition event:', event);
        
        // Check for final results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          
          if (result.isFinal) {
            console.log('Final speech recognition result:', transcript);
            if (transcript && transcript.trim()) {
              console.log('Calling onAsk with transcript:', transcript);
              onAsk(transcript);
            }
          } else {
            console.log('Interim speech recognition result:', transcript);
          }
        }
      };
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error, event);
        setIsConnected(false);
      };
      
      recognitionRef.current = recognition;
      console.log('Speech recognition initialized and stored in ref');
    } else {
      console.error('Speech recognition not supported in this browser');
    }
  }, [onAsk]);

  const connectVoice = async () => {
    console.log('connectVoice called, isConnected:', isConnected);
    if (isConnected) return;
    
    // Check microphone permissions first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
    } catch (e) {
      console.error('Microphone permission denied:', e);
      alert('Microphone permission is required for voice input. Please allow microphone access and try again.');
      return;
    }
    
    // Enable audio on first user interaction
    if (!audioEnabled) {
      setAudioEnabled(true);
      console.log('Audio enabled');
    }
    
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Start recognition
    if (recognitionRef.current) {
      console.log('Starting speech recognition');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);
      }
    } else {
      console.error('Speech recognition not available');
    }
  };

  const disconnectVoice = () => {
    console.log('disconnectVoice called');
    recognitionRef.current?.stop();
  };


  const onImageSelected = async (file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/detect", { method: "POST", body: form });
    const data = await res.json();
    const imageW = data.image_width;
    const imageH = data.image_height;
    setImageSize({ w: imageW, h: imageH });
    setPixelBoxes(data.boxes || []);
    // Map detected pixel boxes to grid cells by simple scaling
    const scaleX = 20 / imageW;
    const scaleY = 15 / imageH;
    const mapped: Box[] = data.boxes.map((b: any, i: number) => ({
      id: b.id || `box-${i + 1}`,
      x: Math.max(0, Math.min(19, Math.floor(b.x * scaleX))),
      y: Math.max(0, Math.min(14, Math.floor(b.y * scaleY))),
      w: Math.max(1, Math.min(20, Math.ceil(b.w * scaleX))),
      h: Math.max(1, Math.min(15, Math.ceil(b.h * scaleY))),
      label: b.label,
      confidence: b.confidence,
    }));
    setBoxes(mapped);
    setManualCount(mapped.length);
    setOriginalDetectedCount(mapped.length);
    const planRes = await fetch("/load-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid_width: 20, grid_height: 15, boxes: mapped }),
    });
    const plan = await planRes.json();
    setBoxes(plan.placements);
    setWarnings(plan.warnings || []);
    setSequence(plan.sequence || []);
  };

  const updateLoadPlan = async (newCount: number) => {
    // Update boxes array to match the new count
    const updatedBoxes = [...boxes];
    
    if (newCount > boxes.length) {
      // Add more boxes if count increased
      for (let i = boxes.length; i < newCount; i++) {
        updatedBoxes.push({
          id: `box-${i + 1}`,
          x: Math.floor(Math.random() * 18),
          y: Math.floor(Math.random() * 13),
          w: 1,
          h: 1,
        });
      }
    } else if (newCount < boxes.length) {
      // Remove boxes if count decreased
      updatedBoxes.splice(newCount);
    }
    
    setBoxes(updatedBoxes);
    
    // Re-run load planning with updated boxes
    try {
      const planRes = await fetch("/load-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid_width: 20, grid_height: 15, boxes: updatedBoxes }),
      });
      const plan = await planRes.json();
      setBoxes(plan.placements);
      setWarnings(plan.warnings || []);
      setSequence(plan.sequence || []);
    } catch (e) {
      console.error("Load plan update error:", e);
    }
  };

  return (
    <div style={{ height: "100vh", background: theme.bg, color: theme.text }}>
      <Header
        isConnected={isConnected}
        onConnect={connectVoice}
        onDisconnect={disconnectVoice}
        language={language}
        setLanguage={setLanguage}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          height: "calc(100vh - 52px)",
          gap: 8,
        }}
      >
        <div style={{ background: theme.panel }}>
          <LeftPanel
            onImageSelected={onImageSelected}
            vehicle={vehicle}
            setVehicle={setVehicle}
            route={route}
            setRoute={setRoute}
            imagePreview={imagePreview}
            detections={boxes}
            // @ts-ignore add pixelBoxes and imageSize through props extension
            pixelBoxes={pixelBoxes}
            imageSize={imageSize}
          />
        </div>
        <div style={{ background: theme.panel }}>
          <GridPanel
            boxes={boxes}
            setBoxes={setBoxes}
            show3D={false}
            setShow3D={() => {}}
            showPath={false}
            setShowPath={() => {}}
          />
        </div>
        <div style={{ background: theme.panel }}>
          <ModernVoicePanel
            history={history}
            warnings={warnings}
            sequence={sequence}
            onAsk={onAsk}
            count={manualCount}
            setCount={(n) => setManualCount(n)}
            isConnected={isConnected}
            onConnect={connectVoice}
            onDisconnect={disconnectVoice}
            analyser={null}
            audioEnabled={audioEnabled}
            setAudioEnabled={setAudioEnabled}
            updateLoadPlan={updateLoadPlan}
            originalDetectedCount={originalDetectedCount}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
