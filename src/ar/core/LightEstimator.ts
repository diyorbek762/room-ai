import * as THREE from "three";

/**
 * Adapts the scene's three-light rig to match real-world lighting using
 * WebXR's Lighting Estimation API (Spherical Harmonics).
 *
 * Requested as an optional WebXR feature. If the device doesn't support it,
 * the fixed lights remain unchanged — zero visual regression.
 */
export class LightEstimator {
  private probe: XRLightProbe | null = null;
  private supported = false;

  // References to lights owned by ARRenderer — we mutate them in place
  private ambientLight: THREE.AmbientLight;
  private hemisphereLight: THREE.HemisphereLight;
  private directionalLight: THREE.DirectionalLight;

  // Snapshot of the original (fixed) light values for fallback
  private origAmbientColor: THREE.Color;
  private origAmbientIntensity: number;
  private origHemiColor: THREE.Color;
  private origHemiGroundColor: THREE.Color;
  private origHemiIntensity: number;
  private origDirColor: THREE.Color;
  private origDirIntensity: number;
  private origDirPosition: THREE.Vector3;

  // Smoothing: lerp toward target values each frame to avoid flicker
  private readonly LERP_FACTOR = 0.15;
  private targetAmbientColor = new THREE.Color();
  private targetAmbientIntensity = 0;
  private targetDirColor = new THREE.Color();
  private targetDirIntensity = 0;
  private targetDirPosition = new THREE.Vector3();
  private targetHemiColor = new THREE.Color();

  constructor(
    ambientLight: THREE.AmbientLight,
    hemisphereLight: THREE.HemisphereLight,
    directionalLight: THREE.DirectionalLight
  ) {
    this.ambientLight = ambientLight;
    this.hemisphereLight = hemisphereLight;
    this.directionalLight = directionalLight;

    // Snapshot originals so we can restore on dispose / fallback
    this.origAmbientColor = ambientLight.color.clone();
    this.origAmbientIntensity = ambientLight.intensity;
    this.origHemiColor = hemisphereLight.color.clone();
    this.origHemiGroundColor = hemisphereLight.groundColor.clone();
    this.origHemiIntensity = hemisphereLight.intensity;
    this.origDirColor = directionalLight.color.clone();
    this.origDirIntensity = directionalLight.intensity;
    this.origDirPosition = directionalLight.position.clone();

    // Start targets at current values
    this.targetAmbientColor.copy(this.origAmbientColor);
    this.targetAmbientIntensity = this.origAmbientIntensity;
    this.targetDirColor.copy(this.origDirColor);
    this.targetDirIntensity = this.origDirIntensity;
    this.targetDirPosition.copy(this.origDirPosition);
    this.targetHemiColor.copy(this.origHemiColor);
  }

  /**
   * Request a light probe from the session.
   * Call once after `session.requestSession()` resolves.
   * Returns true if the device supports lighting estimation.
   */
  async init(session: XRSession): Promise<boolean> {
    try {
      this.probe = await session.requestLightProbe();
      this.supported = true;
    } catch {
      // Device doesn't support light estimation — fixed lights remain
      this.supported = false;
    }
    return this.supported;
  }

  /**
   * Sample the current light estimate and update scene lights.
   * Call every frame from the XR animation loop.
   * No-op if lighting estimation is unsupported or unavailable this frame.
   */
  update(frame: XRFrame): void {
    if (!this.probe || !this.supported) return;

    const estimate = frame.getLightEstimate(this.probe);
    if (!estimate) return;

    const sh = estimate.sphericalHarmonicsCoefficients;
    if (!sh || sh.length < 9) return;

    // ── Ambient from SH band 0 (DC term) ──
    // SH coefficients [0..2] = average scene illumination RGB
    const ambR = Math.max(sh[0] * 0.5, 0.05);
    const ambG = Math.max(sh[1] * 0.5, 0.05);
    const ambB = Math.max(sh[2] * 0.5, 0.05);
    this.targetAmbientColor.setRGB(ambR, ambG, ambB);
    this.targetAmbientIntensity = THREE.MathUtils.clamp(
      (ambR + ambG + ambB) / 3,
      0.15,
      0.8
    );

    // ── Hemisphere sky color from SH band 0 ──
    this.targetHemiColor.setRGB(
      Math.max(sh[0], 0.1),
      Math.max(sh[1], 0.1),
      Math.max(sh[2], 0.1)
    );

    // ── Directional from primary light (if available) ──
    const dir = estimate.primaryLightDirection;
    if (dir && (dir.x !== 0 || dir.y !== 0 || dir.z !== 0)) {
      this.targetDirPosition
        .set(dir.x, dir.y, dir.z)
        .normalize()
        .multiplyScalar(10);
    }

    const intensity = estimate.primaryLightIntensity;
    if (intensity) {
      this.targetDirColor.setRGB(intensity.x, intensity.y, intensity.z);
      this.targetDirIntensity = THREE.MathUtils.clamp(
        (intensity.x + intensity.y + intensity.z) / 3,
        0.3,
        1.5
      );
    }

    // ── Smooth lerp toward targets ──
    const t = this.LERP_FACTOR;

    this.ambientLight.color.lerp(this.targetAmbientColor, t);
    this.ambientLight.intensity = THREE.MathUtils.lerp(
      this.ambientLight.intensity,
      this.targetAmbientIntensity,
      t
    );

    this.hemisphereLight.color.lerp(this.targetHemiColor, t);

    this.directionalLight.color.lerp(this.targetDirColor, t);
    this.directionalLight.intensity = THREE.MathUtils.lerp(
      this.directionalLight.intensity,
      this.targetDirIntensity,
      t
    );
    this.directionalLight.position.lerp(this.targetDirPosition, t);
  }

  /** Whether the device supports lighting estimation. */
  isSupported(): boolean {
    return this.supported;
  }

  /** Restore original light values and release the probe. */
  dispose(): void {
    this.ambientLight.color.copy(this.origAmbientColor);
    this.ambientLight.intensity = this.origAmbientIntensity;
    this.hemisphereLight.color.copy(this.origHemiColor);
    this.hemisphereLight.groundColor.copy(this.origHemiGroundColor);
    this.hemisphereLight.intensity = this.origHemiIntensity;
    this.directionalLight.color.copy(this.origDirColor);
    this.directionalLight.intensity = this.origDirIntensity;
    this.directionalLight.position.copy(this.origDirPosition);
    this.probe = null;
    this.supported = false;
  }
}
