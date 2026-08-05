import { create } from "zustand";
import type { Vector3Tuple } from "three";
import type { RoomMetrics } from "@/types";
import {
  clampCeilingHeight,
  computeRoomMetrics,
  DEFAULT_CEILING_HEIGHT_M,
  type Point2D,
} from "@/lib/measurementMath";

export type CalibrationMode = "idle" | "capturing" | "done";

interface MeasurementState {
  mode: CalibrationMode;
  corners: Vector3Tuple[];
  ceilingHeightM: number;
  estimatedCeilingHeightM: number | null;
  isHeightManuallySet: boolean;
  metrics: RoomMetrics | null;
  error: string | null;
  roomConfirmed: boolean;
}

interface MeasurementActions {
  startCalibration: () => void;
  cancelCalibration: () => void;
  finishCalibration: () => void;
  clearMeasurement: () => void;
  confirmRoom: () => void;
  addCorner: (corner: Vector3Tuple) => void;
  removeLastCorner: () => void;
  resetCorners: () => void;
  setEstimatedHeight: (heightM: number | null) => void;
  setManualHeight: (heightM: number) => void;
  adjustManualHeight: (deltaM: number) => void;
}

function toPoint2D(c: Vector3Tuple): Point2D {
  return { x: c[0], z: c[2] };
}

function recompute(
  corners: Vector3Tuple[],
  heightM: number
): { metrics: RoomMetrics | null; error: string | null } {
  return computeRoomMetrics(corners.map(toPoint2D), heightM);
}

export const useMeasurementStore = create<MeasurementState & MeasurementActions>(
  (set) => ({
    mode: "idle",
    corners: [],
    ceilingHeightM: DEFAULT_CEILING_HEIGHT_M,
    estimatedCeilingHeightM: null,
    isHeightManuallySet: false,
    metrics: null,
    error: null,
    roomConfirmed: false,

    startCalibration: () =>
      set({
        mode: "capturing",
        corners: [],
        metrics: null,
        error: null,
        isHeightManuallySet: false,
        ceilingHeightM: DEFAULT_CEILING_HEIGHT_M,
        estimatedCeilingHeightM: null,
        roomConfirmed: false,
      }),

    cancelCalibration: () =>
      set({
        mode: "idle",
        metrics: null,
        error: null,
      }),

    finishCalibration: () => set({ mode: "done" }),

    confirmRoom: () => set({ roomConfirmed: true }),

    clearMeasurement: () =>
      set({
        mode: "idle",
        corners: [],
        metrics: null,
        error: null,
        estimatedCeilingHeightM: null,
        isHeightManuallySet: false,
        ceilingHeightM: DEFAULT_CEILING_HEIGHT_M,
        roomConfirmed: false,
      }),

    addCorner: (corner) =>
      set((state) => {
        if (state.corners.length >= 4 || state.mode !== "capturing")
          return state;
        const next: Vector3Tuple[] = [
          ...state.corners,
          [corner[0], corner[1], corner[2]],
        ];
        const result = recompute(next, state.ceilingHeightM);
        const nextMode =
          next.length === 4 && !result.error ? "done" : state.mode;
        return {
          corners: next,
          metrics: result.metrics,
          error: result.error,
          mode: nextMode,
        };
      }),

    removeLastCorner: () =>
      set((state) => {
        if (state.corners.length === 0) return state;
        const next = state.corners.slice(0, -1);
        const result = recompute(next, state.ceilingHeightM);
        return {
          corners: next,
          metrics: result.metrics,
          error: result.error,
          mode: "capturing",
        };
      }),

    resetCorners: () =>
      set((state) => {
        if (state.mode !== "capturing") return state;
        const result = recompute([], state.ceilingHeightM);
        return { corners: [], metrics: result.metrics, error: result.error };
      }),

    setEstimatedHeight: (heightM) =>
      set((state) => {
        const nextEstimated = heightM ?? null;
        const nextCeiling = state.isHeightManuallySet
          ? state.ceilingHeightM
          : clampCeilingHeight(heightM ?? DEFAULT_CEILING_HEIGHT_M);
        const result = recompute(state.corners, nextCeiling);
        return {
          estimatedCeilingHeightM: nextEstimated,
          ceilingHeightM: nextCeiling,
          metrics: result.metrics,
          error: result.error,
        };
      }),

    setManualHeight: (heightM) =>
      set((state) => {
        const clamped = clampCeilingHeight(heightM);
        const result = recompute(state.corners, clamped);
        return {
          ceilingHeightM: clamped,
          isHeightManuallySet: true,
          metrics: result.metrics,
          error: result.error,
        };
      }),

    adjustManualHeight: (deltaM) =>
      set((state) => {
        const clamped = clampCeilingHeight(state.ceilingHeightM + deltaM);
        const result = recompute(state.corners, clamped);
        return {
          ceilingHeightM: clamped,
          isHeightManuallySet: true,
          metrics: result.metrics,
          error: result.error,
        };
      }),
  })
);
