import * as THREE from "three";

export class ARRenderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private contactShadowTexture: THREE.CanvasTexture;
  private ambientLight: THREE.AmbientLight;
  private hemisphereLight: THREE.HemisphereLight;
  private directionalLight: THREE.DirectionalLight;
  private frameCount = 0;
  private lastTime = 0;
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const pixelRatioCap = isMobile ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    // Dynamic shadows disabled for mobile GPU; we use baked contact shadows
    this.renderer.shadowMap.enabled = false;
    this.renderer.sortObjects = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      100
    );

    // Three-light setup for natural, even illumination
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambientLight);

    this.hemisphereLight = new THREE.HemisphereLight(0xddeeff, 0.443322, 0.6);
    this.hemisphereLight.position.set(0, 10, 0);
    this.scene.add(this.hemisphereLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.directionalLight.position.set(5, 10, 7.5);
    this.directionalLight.castShadow = false;
    this.scene.add(this.directionalLight);

    // Build a shared contact-shadow texture once. ObjectPlacer will clone
    // this texture onto per-object shadow planes that follow each piece
    // of furniture on the floor.
    this.contactShadowTexture = this.buildContactShadowTexture();

    window.addEventListener("resize", this.handleResize);
  }

  private buildContactShadowTexture(): THREE.CanvasTexture {
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 512;
    shadowCanvas.height = 512;
    const ctx = shadowCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, "rgba(0,0,0,0.6)");
    gradient.addColorStop(0.25, "rgba(0,0,0,0.45)");
    gradient.addColorStop(0.6, "rgba(0,0,0,0.15)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    const texture = new THREE.CanvasTexture(shadowCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  getContactShadowTexture(): THREE.CanvasTexture {
    return this.contactShadowTexture;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getAmbientLight(): THREE.AmbientLight {
    return this.ambientLight;
  }

  getHemisphereLight(): THREE.HemisphereLight {
    return this.hemisphereLight;
  }

  getDirectionalLight(): THREE.DirectionalLight {
    return this.directionalLight;
  }

  getFPS(): number {
    return this.fps;
  }

  /**
   * Legacy: kept for back-compat. Contact shadows are now per-object —
   * see ObjectPlacer.attachContactShadow().
   */
  showShadowPlane(_visible: boolean): void {
    void _visible;
  }

  setAnimationLoop(callback: XRFrameRequestCallback | null): void {
    this.renderer.setAnimationLoop((time, frame) => {
      if (document.visibilityState === "hidden") return;
      this.frameCount++;
      if (time - this.lastTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastTime = time;
      }
      if (callback) callback(time, frame);
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.setAnimationLoop(null);
    this.contactShadowTexture.dispose();
    this.renderer.dispose();
  }
}
