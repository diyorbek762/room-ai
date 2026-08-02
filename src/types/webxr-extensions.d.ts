/**
 * WebXR extensions not yet in @types/webxr.
 * Covers Lighting Estimation and Plane Detection APIs.
 */

// ─── Lighting Estimation ────────────────────────────────────────────────────

/** Light probe returned by XRSession.requestLightProbe(). */
interface XRLightProbe extends EventTarget {
  readonly probeSpace: XRSpace;
  onreflectionchange: ((this: XRLightProbe, ev: Event) => void) | null;
}

/** Per-frame lighting estimate from the device camera. */
interface XRLightEstimate {
  /** 27 floats: 9 SH coefficients × 3 (RGB). */
  readonly sphericalHarmonicsCoefficients: Float32Array;
  /** Primary (dominant) light direction in probe space. May be absent. */
  readonly primaryLightDirection: DOMPointReadOnly;
  /** Primary light intensity as (R, G, B, 1). May be absent. */
  readonly primaryLightIntensity: DOMPointReadOnly;
}

interface XRLightProbeInit {
  reflectionFormat?: "srgba8" | "rgba16f";
}

// ─── Plane Detection ────────────────────────────────────────────────────────

/** A detected real-world surface (floor, wall, table, etc.). */
interface XRPlane {
  readonly planeSpace: XRSpace;
  readonly polygon: ReadonlyArray<DOMPointReadOnly>;
  readonly orientation?: "horizontal" | "vertical";
  readonly lastChangedTime: DOMHighResTimeStamp;
}

// ─── Session / Frame augmentations ──────────────────────────────────────────

interface XRSession {
  requestLightProbe(options?: XRLightProbeInit): Promise<XRLightProbe>;
}

interface XRFrame {
  getLightEstimate(probe: XRLightProbe): XRLightEstimate | null;
  readonly detectedPlanes?: ReadonlySet<XRPlane>;
}
