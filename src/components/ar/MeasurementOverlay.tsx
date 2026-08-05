"use client";

import type { ReactNode } from "react";
import { useMeasurementStore } from "@/store";
import { formatM2, formatLinearM } from "@/lib/measurementMath";

export function MeasurementOverlay(): ReactNode {
  const {
    mode,
    corners,
    metrics,
    error,
    ceilingHeightM,
    roomConfirmed,
    startCalibration,
    cancelCalibration,
    clearMeasurement,
    confirmRoom,
    removeLastCorner,
    resetCorners,
    adjustManualHeight,
  } = useMeasurementStore();

  if (mode === "idle" && corners.length === 0) return null;

  const edgeCount =
    corners.length < 2 ? 0 : corners.length === 4 ? 4 : corners.length - 1;

  const pillBase =
    "px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-colors";
  const btnBase =
    "px-3 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-colors";
  const btnPrimary = `${btnBase} bg-emerald-500 hover:bg-emerald-600 text-white`;
  const btnSecondary = `${btnBase} bg-slate-800 hover:bg-slate-700 text-white`;
  const btnDanger = `${btnBase} bg-red-500/90 hover:bg-red-500 text-white`;

  return (
    <>
      {/* LAYER 1: HTML Badges — projected by page.tsx render loop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-25">
        {corners.map((_, i) => (
          <div
            key={`c-${i}`}
            id={`measure-corner-${i}`}
            className="absolute hidden -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-500 text-white text-[11px] font-bold items-center justify-center shadow"
            style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
          >
            {i + 1}
          </div>
        ))}
        {Array.from({ length: edgeCount }).map((_, i) => (
          <div
            key={`e-${i}`}
            id={`measure-edge-${i}`}
            className="absolute hidden -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 shadow"
            style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
          />
        ))}
      </div>

      {/* LAYER 2: Metrics Banner / Confirmation Card */}
      <div className="absolute top-36 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[90%] max-w-sm flex justify-center">
        {error ? (
          <div
            className={`${pillBase} bg-red-500/90 text-white flex items-center gap-3 text-center`}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={resetCorners}
              className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[10px] font-bold"
            >
              Retap
            </button>
          </div>
        ) : mode === "done" && !roomConfirmed && metrics ? (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl w-full">
            <h3 className="text-white font-bold text-base mb-3">Room Measured</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-400 uppercase">Floor</div>
                <div className="text-emerald-400 text-xs font-bold">{formatM2(metrics.floorAreaM2, 1)}</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-400 uppercase">Walls</div>
                <div className="text-emerald-400 text-xs font-bold">{formatM2(metrics.wallAreaM2, 1)}</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-400 uppercase">Perimeter</div>
                <div className="text-emerald-400 text-xs font-bold">{formatLinearM(metrics.perimeterM, 1)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 mb-4">
              <span className="text-[10px] text-slate-400 uppercase">Ceiling Height</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustManualHeight(-0.1)}
                  className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold flex items-center justify-center"
                  aria-label="Decrease ceiling height"
                >
                  −
                </button>
                <span className="text-white text-xs font-bold min-w-[3rem] text-center">
                  {ceilingHeightM.toFixed(1)} m
                </span>
                <button
                  type="button"
                  onClick={() => adjustManualHeight(0.1)}
                  className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold flex items-center justify-center"
                  aria-label="Increase ceiling height"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={confirmRoom}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-all"
            >
              Confirm Room ✓
            </button>
          </div>
        ) : metrics && roomConfirmed ? (
          null
        ) : mode === "capturing" ? (
          <div
            className={`${pillBase} bg-slate-900/85 text-white border border-white/10`}
          >
            Tap corner {corners.length + 1}/4
          </div>
        ) : null}
      </div>

      {/* LAYER 3: Controls Row */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-2">
        {mode === "capturing" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={removeLastCorner}
              disabled={corners.length === 0}
              className={`${btnSecondary} disabled:opacity-40 disabled:active:scale-100`}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={resetCorners}
              disabled={corners.length === 0}
              className={`${btnSecondary} disabled:opacity-40 disabled:active:scale-100`}
            >
              Reset
            </button>
            <button type="button" onClick={cancelCalibration} className={btnDanger}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
