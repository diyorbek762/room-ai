export interface ARSessionCallbacks {
  onSessionStart?: (session: XRSession) => void;
  onSessionEnd?: () => void;
  onVisibilityChange?: (visibility: XRVisibilityState) => void;
  onError?: (error: Error) => void;
}

export class ARSessionManager {
  private session: XRSession | null = null;
  private referenceSpace: XRReferenceSpace | null = null;
  private callbacks: ARSessionCallbacks;
  private domOverlay: HTMLElement | null = null;

  constructor(callbacks: ARSessionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  static async isSupported(): Promise<boolean> {
    if (!("xr" in navigator)) return false;
    try {
      return await navigator.xr!.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  async startSession(overlayElement?: HTMLElement): Promise<XRSession> {
    if (!navigator.xr) {
      throw new Error("WebXR not available");
    }

    if (this.session) {
      return this.session;
    }

    const requiredFeatures: string[] = ["hit-test", "local-floor"];
    const optionalFeatures: string[] = [
      "dom-overlay",
      "anchors",
      "plane-detection",
      "light-estimation",
    ];

    const sessionInit: XRSessionInit = {
      requiredFeatures,
      optionalFeatures,
    };

    if (overlayElement) {
      this.domOverlay = overlayElement;
      sessionInit.domOverlay = { root: overlayElement };
    }

    try {
      this.session = await navigator.xr.requestSession("immersive-ar", sessionInit);
    } catch {
      try {
        const fallbackInit: XRSessionInit = {
          requiredFeatures: [],
          optionalFeatures: ["hit-test", "local-floor", "dom-overlay", "anchors", "plane-detection"],
        };
        if (overlayElement) {
          fallbackInit.domOverlay = { root: overlayElement };
        }
        this.session = await navigator.xr.requestSession("immersive-ar", fallbackInit);
      } catch {
        try {
          const barebonesInit: XRSessionInit = {
            requiredFeatures: [],
            optionalFeatures: ["hit-test", "local-floor", "dom-overlay", "anchors", "plane-detection"],
          };
          if (overlayElement) {
            barebonesInit.domOverlay = { root: overlayElement };
          }
          this.session = await navigator.xr.requestSession("immersive-ar", barebonesInit);
        } catch {
          try {
            // Ultimate fallback: absolutely no advanced ARCore features except hit-test
            const ultimateInit: XRSessionInit = {
              requiredFeatures: [],
              optionalFeatures: ["hit-test", "dom-overlay"],
            };
            if (overlayElement) {
              ultimateInit.domOverlay = { root: overlayElement };
            }
            this.session = await navigator.xr.requestSession("immersive-ar", ultimateInit);
          } catch (err: unknown) {
            console.error("WebXR requestSession failed on all fallbacks:", err);
            throw err;
          }
        }
      }
    }

    this.session.addEventListener("end", this.handleSessionEnd);
    this.session.addEventListener("visibilitychange", this.handleVisibilityChange);

    try {
      this.referenceSpace = await this.session.requestReferenceSpace("local-floor");
    } catch {
      this.referenceSpace = await this.session.requestReferenceSpace("viewer");
    }

    this.callbacks.onSessionStart?.(this.session);
    return this.session;
  }

  async endSession(): Promise<void> {
    if (this.session) {
      await this.session.end();
    }
  }

  getSession(): XRSession | null {
    return this.session;
  }

  getReferenceSpace(): XRReferenceSpace | null {
    return this.referenceSpace;
  }

  getDomOverlay(): HTMLElement | null {
    return this.domOverlay;
  }

  private handleSessionEnd = (): void => {
    if (this.session) {
      this.session.removeEventListener("end", this.handleSessionEnd);
      this.session.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    this.session = null;
    this.referenceSpace = null;
    this.callbacks.onSessionEnd?.();
  };

  private handleVisibilityChange = (event: Event): void => {
    const session = event.target as XRSession;
    this.callbacks.onVisibilityChange?.(session.visibilityState);
  };

  dispose(): void {
    if (this.session) {
      this.session.removeEventListener("end", this.handleSessionEnd);
      this.session.removeEventListener("visibilitychange", this.handleVisibilityChange);
      this.session.end().catch(() => {});
    }
    this.session = null;
    this.referenceSpace = null;
  }
}
