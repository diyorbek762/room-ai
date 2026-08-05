/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";

interface BeforeAfterSliderProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function BeforeAfterSlider({ isOpen, onClose, canvasRef }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      try {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        setSnapshotUrl(dataUrl);
      } catch {
        // Ignore canvas read error if WebGL context is preserved
      }
    }
  }, [isOpen, canvasRef]);

  if (!isOpen) return null;

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleDownload = () => {
    if (!snapshotUrl) return;
    const a = document.createElement("a");
    a.href = snapshotUrl;
    a.download = `roomai-transformation-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <GlassPanel className="w-full max-w-xl p-5 rounded-3xl border border-white/20 shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>✨</span> Before / After Transformation
            </h2>
            <p className="text-xs text-white/60">
              Drag slider to compare camera view with AR design
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg transition-all"
          >
            ✕
          </button>
        </div>

        {/* Interactive Comparison Canvas Area */}
        <div
          ref={containerRef}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-white/15 select-none touch-none bg-slate-900 flex items-center justify-center"
        >
          {snapshotUrl ? (
            <>
              {/* After AR Image (Full background) */}
              <img
                src={snapshotUrl}
                alt="AR Redesigned Room"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Before Overlay (Clipped to slider width) */}
              <div
                className="absolute inset-0 overflow-hidden border-r-2 border-emerald-400 shadow-xl"
                style={{ width: `${sliderPosition}%` }}
              >
                <div className="w-full h-full bg-slate-800/90 backdrop-contrast-125 flex items-center justify-center">
                  <span className="text-xs font-mono tracking-widest text-white/40 uppercase">Original View</span>
                </div>
              </div>

              {/* Slider Handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-emerald-400 cursor-ew-resize flex items-center justify-center z-10"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border-2 border-white text-xs">
                  ↔
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-white/60">Capturing live AR transformation view...</div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleDownload}
            disabled={!snapshotUrl}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-50"
          >
            <span>📥</span> Export Transformation Snapshot
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-white/10 hover:bg-white/20 font-semibold rounded-xl active:scale-95 transition-all text-sm"
          >
            Close
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
