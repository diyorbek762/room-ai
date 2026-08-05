import * as THREE from "three";
import type { PlacedModel } from "../placement/ObjectPlacer";

/**
 * Tier-B real-world occlusion using the WebXR Depth API (CPU-optimized path).
 *
 * Each frame we grab the depth buffer for the current view, downsample it to a
 * small Float32 DataTexture, and inject a `discard` test into every placed-model
 * material so fragments behind real-world geometry are hidden.
 *
 * This is gated by device capability: it only activates when the session grants
 * `depth-sensing` with `cpu-optimized` usage. Tier-A plane occluders continue to
 * run on devices that don't support depth sensing.
 */
export class DepthOcclusionManager {
  private scene: THREE.Scene;
  private supported = false;
  private depthTexture: THREE.DataTexture | null = null;
  private uvTransform = new THREE.Matrix4();
  private lastDepthFrame: XRCPUDepthInformation | null = null;
  private materialSet = new WeakSet<THREE.Material>();

  // Downsample target; balances fidelity and CPU cost.
  private readonly targetWidth = 160;
  private readonly targetHeight = 90;
  private readonly depthBias = 0.02;

  private _scaleMatrix = new THREE.Matrix4();
  private _scratchMatrix = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(session: XRSession): boolean {
    this.supported =
      session.depthUsage === "cpu-optimized" &&
      (session.depthDataFormat === "luminance-alpha" ||
        session.depthDataFormat === "float32");
    return this.supported;
  }

  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Update the depth texture and apply the occlusion shader to any new
   * placed-model materials.
   */
  update(frame: XRFrame, referenceSpace: XRReferenceSpace, placedModels: PlacedModel[]): void {
    if (!this.supported) return;

    const pose = frame.getViewerPose(referenceSpace);
    if (!pose || pose.views.length === 0) return;

    const view = pose.views[0];
    let depthInfo: XRCPUDepthInformation | XRWebGLDepthInformation | null | undefined;
    try {
      depthInfo = frame.getDepthInformation?.(view);
    } catch (e) {
      // Some sessions report depth-sensing in init but throw at runtime.
      // Disable permanently so we fall back to Tier-A plane occluders.
      console.warn("Depth sensing unsupported at runtime; disabling Tier-B occlusion:", e);
      this.supported = false;
      return;
    }
    if (!depthInfo || !("getDepthInMeters" in depthInfo)) {
      // Null frame or GPU-optimized path; reuse last texture if available.
      return;
    }
    this.lastDepthFrame = depthInfo as XRCPUDepthInformation;
    this.buildDepthTexture(this.lastDepthFrame);

    for (const placed of placedModels) {
      placed.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const mat of mats) {
            this.applyToMaterial(mat);
          }
        }
      });
    }

    for (const placed of placedModels) {
      for (const { mat } of placed.fadeMaterials) {
        this.applyToMaterial(mat);
      }
    }
  }

  private buildDepthTexture(depthInfo: XRCPUDepthInformation): void {
    const fullW = depthInfo.width;
    const fullH = depthInfo.height;
    const stepX = Math.max(1, Math.floor(fullW / this.targetWidth));
    const stepY = Math.max(1, Math.floor(fullH / this.targetHeight));
    const texW = Math.floor(fullW / stepX);
    const texH = Math.floor(fullH / stepY);

    const data = new Float32Array(texW * texH);
    let i = 0;
    for (let y = 0; y < texH; y++) {
      const sy = y * stepY;
      for (let x = 0; x < texW; x++) {
        const sx = x * stepX;
        data[i++] = depthInfo.getDepthInMeters(sx, sy);
      }
    }

    if (
      !this.depthTexture ||
      this.depthTexture.image.width !== texW ||
      this.depthTexture.image.height !== texH
    ) {
      this.depthTexture?.dispose();
      this.depthTexture = new THREE.DataTexture(
        data,
        texW,
        texH,
        THREE.RedFormat,
        THREE.FloatType
      );
      this.depthTexture.minFilter = THREE.NearestFilter;
      this.depthTexture.magFilter = THREE.NearestFilter;
      this.depthTexture.wrapS = THREE.ClampToEdgeWrapping;
      this.depthTexture.wrapT = THREE.ClampToEdgeWrapping;
      this.depthTexture.needsUpdate = true;
    } else {
      this.depthTexture.image.data = data;
      this.depthTexture.needsUpdate = true;
    }

    // Adjust the UV transform for the downsampled texture size.
    const mat = depthInfo.normDepthBufferFromNormView.matrix;
    this._scratchMatrix.fromArray(mat);
    this._scaleMatrix.makeScale(texW / fullW, texH / fullH, 1);
    this.uvTransform.multiplyMatrices(this._scaleMatrix, this._scratchMatrix);
  }

  private applyToMaterial(mat: THREE.Material): void {
    if (this.materialSet.has(mat)) return;
    this.materialSet.add(mat);

    const uniforms = {
      uDepthTex: { value: this.depthTexture },
      uDepthUvTransform: { value: this.uvTransform },
      uDepthBias: { value: this.depthBias },
    };
    (mat.userData as Record<string, unknown>).depthOcclusionUniforms = uniforms;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDepthTex = uniforms.uDepthTex;
      shader.uniforms.uDepthUvTransform = uniforms.uDepthUvTransform;
      shader.uniforms.uDepthBias = uniforms.uDepthBias;

      // Vertex: pass clip-space position to the fragment.
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>\nvarying vec4 vDepthClipPos;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        `void main() {\n  vDepthClipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);`
      );

      // Fragment: compare real-world depth to fragment view-space depth.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>\nvarying vec4 vDepthClipPos;\nuniform sampler2D uDepthTex;\nuniform mat4 uDepthUvTransform;\nuniform float uDepthBias;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `void main() {\n  vec2 depthUV = (uDepthUvTransform * vec4(vDepthClipPos.xy / vDepthClipPos.w, 0.0, 1.0)).xy;\n  float realDepth = texture(uDepthTex, depthUV).r;\n  float fragDepth = -vViewPosition.z;\n  if (realDepth > 0.0 && realDepth < fragDepth - uDepthBias) discard;`
      );
    };

    mat.needsUpdate = true;
  }

  dispose(): void {
    this.depthTexture?.dispose();
    this.depthTexture = null;
    this.lastDepthFrame = null;
  }
}
