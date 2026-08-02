interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  domOverlay?: { root: HTMLElement };
}

interface XRSession extends EventTarget {
  requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
  requestHitTestSource?(options: {
    space: XRReferenceSpace;
  }): Promise<XRHitTestSource>;
  end(): Promise<void>;
  visibilityState: XRVisibilityState;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

type XRVisibilityState = "visible" | "visible-blurred" | "hidden";

interface XRReferenceSpace extends EventTarget {
  getOffsetReferenceSpace(originOffset: XRRigidTransform): XRReferenceSpace;
}

interface XRRigidTransform {
  position: DOMPointReadOnly;
  orientation: DOMPointReadOnly;
  matrix: Float32Array;
  inverse: XRRigidTransform;
}

interface XRFrame {
  getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
  getHitTestResults(hitTestSource: XRHitTestSource): XRHitTestResult[];
  predictedDisplayTime: number;
  session: XRSession;
}

interface XRViewerPose {
  views: XRView[];
  transform: XRRigidTransform;
}

interface XRView {
  eye: string;
  projectionMatrix: Float32Array;
  transform: XRRigidTransform;
}

interface XRHitTestSource {
  cancel(): void;
}

interface XRHitTestResult {
  getPose(baseSpace: XRReferenceSpace): XRPose | null;
}

interface XRPose {
  transform: XRRigidTransform;
}

interface XRSystem extends EventTarget {
  isSessionSupported(mode: string): Promise<boolean>;
  requestSession(mode: string, options?: XRSessionInit): Promise<XRSession>;
}

interface Navigator {
  xr?: XRSystem;
}

type XRFrameRequestCallback = (
  time: DOMHighResTimeStamp,
  frame: XRFrame
) => void;

interface WebGLRenderingContext {
  makeXRCompatible?(): Promise<void>;
}
