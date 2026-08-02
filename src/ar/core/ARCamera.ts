import * as THREE from "three";

export class ARCamera {
  private camera: THREE.PerspectiveCamera;
  private tempMatrix: THREE.Matrix4;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.tempMatrix = new THREE.Matrix4();
  }

  updateFromXRFrame(frame: XRFrame, referenceSpace: XRReferenceSpace): boolean {
    const pose = frame.getViewerPose(referenceSpace);
    if (!pose) return false;

    const view = pose.views[0];
    if (!view) return false;

    this.camera.matrix.fromArray(view.transform.matrix);
    this.camera.matrix.decompose(
      this.camera.position,
      this.camera.quaternion,
      this.camera.scale
    );

    if (view.projectionMatrix) {
      this.camera.projectionMatrix.fromArray(view.projectionMatrix);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }

    return true;
  }

  getWorldDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }

  getWorldPosition(): THREE.Vector3 {
    const position = new THREE.Vector3();
    this.camera.getWorldPosition(position);
    return position;
  }

  getProjectionMatrix(): THREE.Matrix4 {
    return this.camera.projectionMatrix;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
