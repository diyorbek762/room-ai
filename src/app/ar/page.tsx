"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { ARSessionManager } from "@/ar/core/ARSessionManager";
import { ARRenderer } from "@/ar/core/ARRenderer";
import { ARCamera } from "@/ar/core/ARCamera";
import { LightEstimator } from "@/ar/core/LightEstimator";
import { HitTestManager } from "@/ar/placement/HitTestManager";
import { PlaneManager } from "@/ar/placement/PlaneManager";
import { ObjectPlacer } from "@/ar/placement/ObjectPlacer";
import { AnchorManager } from "@/ar/core/AnchorManager";
import { TransformController } from "@/ar/interaction/TransformController";
import { SceneSerializer } from "@/ar/persistence/SceneSerializer";
import { ScenePersistence } from "@/ar/persistence/ScenePersistence";
import { useARStore, useCartStore, useMeasurementStore } from "@/store";
import { useSurfaceStore } from "@/store/useSurfaceStore";
import { SurfacePainter } from "@/ar/decor/SurfacePainter";
import { SceneUrlSerializer } from "@/ar/persistence/SceneUrlSerializer";
import { BeforeAfterSlider } from "@/components/ar/BeforeAfterSlider";

import {
  ARCameraStagerOverlay,
  type OverlayProduct,
  type OverlayFinishItem,
} from "@/components/ar/ARCameraStagerOverlay";
import demoCatalog from "@/data/demo-catalog";
import { getModelUrl } from "@/lib/modelUrl";
import { MeasurementVisualizer } from "@/ar/measurement/MeasurementVisualizer";
import type { CalloutAnchors } from "@/ar/measurement/DimensionCallouts";
import { estimateWallHeight, isPointInPolygon } from "@/lib/measurementMath";

interface TouchState {
  startX: number;
  startY: number;
  mode: "none" | "pending-place" | "pending-deselect" | "pending-drag" | "drag" | "pinch" | "pending-corner";
  dragObjectId: string | null;
  lastPinchDist: number;
  lastTwistAngle: number;
}

const DRAG_THRESHOLD = 10;
const _proj = new THREE.Vector3();
const _badgeMid = new THREE.Vector3();
const _calloutProj = new THREE.Vector3();
const _calloutAnchors: CalloutAnchors = {
  w: new THREE.Vector3(),
  d: new THREE.Vector3(),
  h: new THREE.Vector3(),
};
const _calloutSize = new THREE.Vector3();

function writeBadge(el: HTMLElement, ndc: THREE.Vector3): void {
  if (ndc.z < 1) {
    el.style.transform = `translate3d(${(ndc.x * 0.5 + 0.5) * window.innerWidth}px, ${(ndc.y * -0.5 + 0.5) * window.innerHeight}px, 0)`;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

function writeCalloutLabel(camera: THREE.Camera, anchor: THREE.Vector3, lengthM: number, id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  _calloutProj.copy(anchor).project(camera);
  if (_calloutProj.z < 1) {
    const cm = Math.round(lengthM * 100);
    el.textContent = `${cm} cm`;
    el.style.transform = `translate3d(${(_calloutProj.x * 0.5 + 0.5) * window.innerWidth}px, ${(_calloutProj.y * -0.5 + 0.5) * window.innerHeight}px, 0)`;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

function toPickerProduct(entry: (typeof demoCatalog)[number]): OverlayProduct {
  return {
    id: entry.id,
    name: entry.name,
    nameUz: entry.nameUz,
    priceUZS: entry.priceUZS,
    storeSlug: entry.store,
    storeName: entry.store === "asaxiy" ? "Asaxiy" : "Olcha",
    modelUrl: getModelUrl(entry.id, "low"),
    categorySlug: entry.category,
    dimensions: entry.dimensions,
    placement: entry.placement || "floor",
    productClass: entry.productClass || "mass",
  };
}

const ALL_PRODUCTS: OverlayProduct[] = demoCatalog.map(toPickerProduct);

export default function ARPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isARActive, setIsARActive] = useState(false);
  const [hitTestReady, setHitTestReady] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [scaleLocked, setScaleLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Checking AR support...");
  const [marketOpen, setMarketOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishItems, setFinishItems] = useState<OverlayFinishItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<OverlayProduct>(() => {
    if (typeof window === "undefined") return ALL_PRODUCTS[0];
    const params = new URLSearchParams(window.location.search);
    const modelParam = params.get("model");
    const placeParam = params.get("place");
    if (modelParam) {
      const match = ALL_PRODUCTS.find((p) => p.modelUrl === modelParam);
      if (match) return match;
      if (placeParam) {
        const byId = ALL_PRODUCTS.find((p) => p.id === placeParam);
        if (byId) return byId;
      }
    } else if (placeParam) {
      const byId = ALL_PRODUCTS.find((p) => p.id === placeParam);
      if (byId) return byId;
    }
    return ALL_PRODUCTS[0];
  });
  const [loadingCount, setLoadingCount] = useState(0);
  const [beforeAfterOpen, setBeforeAfterOpen] = useState(false);

  const handleShareUrl = useCallback(() => {
    const objects = useARStore.getState().placedObjects;
    const floor = useSurfaceStore.getState().selectedFloorPreset;
    const wall = useSurfaceStore.getState().selectedWallPreset;
    const url = SceneUrlSerializer.createShareableUrl(objects, floor, wall);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      setStatusMessage("Copied shareable AR room link!");
    } else {
      alert(`Share link: ${url}`);
    }
  }, []);

  const sessionManagerRef = useRef<ARSessionManager | null>(null);
  const rendererRef = useRef<ARRenderer | null>(null);
  const cameraManagerRef = useRef<ARCamera | null>(null);
  const lightEstimatorRef = useRef<LightEstimator | null>(null);
  const planeManagerRef = useRef<PlaneManager | null>(null);
  const hitTestManagerRef = useRef<HitTestManager | null>(null);
  const objectPlacerRef = useRef<ObjectPlacer | null>(null);
  const surfacePainterRef = useRef<SurfacePainter | null>(null);
  const measurementVisualizerRef = useRef<MeasurementVisualizer | null>(null);
  const anchorManagerRef = useRef<AnchorManager | null>(null);
  const transformControllerRef = useRef<TransformController | null>(null);
  const serializerRef = useRef<SceneSerializer>(new SceneSerializer());
  const persistenceRef = useRef<ScenePersistence>(new ScenePersistence());
  const selectedObjectIdRef = useRef<string | null>(null);
  const placerListenersRef = useRef<{
    onModelLoading: (e: Event) => void;
    onModelLoaded: (e: Event) => void;
    onModelFailed: (e: Event) => void;
    onModelRemoved: (e: Event) => void;
    onSceneCleared: (e: Event) => void;
  } | null>(null);
  const isARActiveRef = useRef<boolean>(false);
  const overlayStateRef = useRef<{ marketOpen: boolean; finishOpen: boolean }>({
    marketOpen: false,
    finishOpen: false,
  });

  const syncSurfaces = useCallback(() => {
    if (!surfacePainterRef.current) return;
    const corners = useMeasurementStore.getState().corners;
    const metrics = useMeasurementStore.getState().metrics;
    const { selectedFloorPreset, selectedWallPreset } = useSurfaceStore.getState();
    surfacePainterRef.current.updateFloorSurface(corners, selectedFloorPreset);
    surfacePainterRef.current.updateWallSurfaces(corners, metrics?.ceilingHeightM || 2.7, selectedWallPreset);
  }, []);

  useEffect(() => {
    const unsubMeas = useMeasurementStore.subscribe(syncSurfaces);
    const unsubSurf = useSurfaceStore.subscribe(syncSurfaces);
    return () => {
      unsubMeas();
      unsubSurf();
    };
  }, [syncSurfaces]);

  const touchRef = useRef<TouchState>({
    startX: 0,
    startY: 0,
    mode: "none",
    dragObjectId: null,
    lastPinchDist: 0,
    lastTwistAngle: 0,
  });
  const selectedProductRef = useRef<OverlayProduct>(ALL_PRODUCTS[0]);
  const placeSelectedProductRef = useRef<(pos: THREE.Vector3, quat: THREE.Quaternion, surfaceType: "floor" | "wall", wallNormal?: THREE.Vector3) => void>(
    () => {}
  );
  const syncObjectToStoreRef = useRef<(id: string) => void>(() => {});
  const lastHeightEstRef = useRef<number>(0);
  const edgeTextCacheRef = useRef<number[]>([]);
  const placeCounterRef = useRef<number>(0);

  const placedObjects = useARStore((s) => s.placedObjects);
  const placeObject = useARStore((s) => s.placeObject);
  const removeObject = useARStore((s) => s.removeObject);
  const updateTransform = useARStore((s) => s.updateTransform);
  const setScanStatus = useARStore((s) => s.setScanStatus);
  const router = useRouter();
  const cartAddItem = useCartStore((s) => s.addItem);
  const measureMode = useMeasurementStore((s) => s.mode);

  useEffect(() => {
    selectedObjectIdRef.current = selectedObjectId;
    setScaleLocked(transformControllerRef.current?.isScaleLocked() ?? false);
  }, [selectedObjectId]);

  useEffect(() => {
    isARActiveRef.current = isARActive;
  }, [isARActive]);

  useEffect(() => {
    return useMeasurementStore.subscribe((state) => {
      measurementVisualizerRef.current?.setCorners(state.corners);
      measurementVisualizerRef.current?.setClosed(state.corners.length === 4);
      transformControllerRef.current?.setRoomCorners(
        state.corners.map((c) => ({ x: c[0], z: c[2] }))
      );
      if (state.mode === "idle") {
        measurementVisualizerRef.current?.clear();
      }
    });
  }, []);

  const totalPriceUZS = placedObjects.reduce((sum, obj) => {
    const product = demoCatalog.find((p) => p.id === obj.productId);
    return sum + (product?.priceUZS || 0);
  }, 0);

  useEffect(() => {
    overlayStateRef.current = { marketOpen, finishOpen };
  }, [marketOpen, finishOpen]);

  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);

  useEffect(() => {
    if (typeof window !== "undefined" && "navigator" in window) {
      ARSessionManager.isSupported().then((supported) => {
        setIsSupported(supported);
        setStatusMessage(
          supported ? "Tap to start AR" : "AR not supported on this device"
        );
      }).catch(() => {
        setIsSupported("xr" in navigator);
      });
    }

    persistenceRef.current.init();

    return () => {
      const placer = objectPlacerRef.current;
      if (placer && placerListenersRef.current) {
        const l = placerListenersRef.current;
        placer.removeEventListener("model-loading", l.onModelLoading);
        placer.removeEventListener("model-loaded", l.onModelLoaded);
        placer.removeEventListener("model-failed", l.onModelFailed);
        placer.removeEventListener("model-removed", l.onModelRemoved);
        placer.removeEventListener("scene-cleared", l.onSceneCleared);
        placerListenersRef.current = null;
      }
      sessionManagerRef.current?.dispose();
      lightEstimatorRef.current?.dispose();
      planeManagerRef.current?.dispose();
      anchorManagerRef.current?.clear();
      rendererRef.current?.dispose();
      objectPlacerRef.current?.dispose();
      surfacePainterRef.current?.dispose();
      surfacePainterRef.current = null;
      measurementVisualizerRef.current?.dispose();
      measurementVisualizerRef.current = null;
      transformControllerRef.current?.dispose();
      persistenceRef.current.dispose();
    };
  }, []);

  const startAR = useCallback(async () => {
    if (!canvasRef.current || !overlayRef.current) return;

    // Clear stale objects from previous sessions
    useARStore.getState().clearScene();

    const renderer = new ARRenderer(canvasRef.current);
    rendererRef.current = renderer;

    // Create SurfacePainter & ObjectPlacer
    const surfacePainter = new SurfacePainter(renderer.getScene());
    surfacePainterRef.current = surfacePainter;
    syncSurfaces();

    const objectPlacer = new ObjectPlacer(renderer.getScene(), renderer.getContactShadowTexture());
    objectPlacerRef.current = objectPlacer;
    objectPlacer.setProductDimsResolver(
      (pid) => ALL_PRODUCTS.find((p) => p.id === pid)?.dimensions ?? null
    );

    const recomputeLoadingCount = () => {
      let count = 0;
      for (const m of objectPlacer.getAllPlacedModels()) {
        if (m.isLoading) count++;
      }
      setLoadingCount(count);
    };
    const onModelLoading = () => recomputeLoadingCount();
    const onModelLoaded = () => recomputeLoadingCount();
    const onModelFailed = () => recomputeLoadingCount();
    const onModelRemoved = () => recomputeLoadingCount();
    const onSceneCleared = () => setLoadingCount(0);
    objectPlacer.addEventListener("model-loading", onModelLoading);
    objectPlacer.addEventListener("model-loaded", onModelLoaded);
    objectPlacer.addEventListener("model-failed", onModelFailed);
    objectPlacer.addEventListener("model-removed", onModelRemoved);
    objectPlacer.addEventListener("scene-cleared", onSceneCleared);
    placerListenersRef.current = {
      onModelLoading,
      onModelLoaded,
      onModelFailed,
      onModelRemoved,
      onSceneCleared,
    };

    const sessionManager = new ARSessionManager({
      onSessionStart: (session) => {
        renderer.getRenderer().xr.setSession(session);
        setIsARActive(true);
        setStatusMessage("Point camera at a flat surface");
      },
      onSessionEnd: () => {
        setIsARActive(false);
        setHitTestReady(false);
        setStatusMessage("AR session ended");
      },
    });
    sessionManagerRef.current = sessionManager;

    let session: XRSession;
    try {
      session = await sessionManager.startSession(overlayRef.current);
    } catch (err: unknown) {
      console.error("startAR error:", err);
      const msg = err instanceof Error ? err.message : "Check camera permissions";
      setStatusMessage(`Unable to start AR: ${msg}`);
      return;
    }

    const refSpace = sessionManager.getReferenceSpace()!;

    const arCamera = new ARCamera(renderer.getCamera());
    cameraManagerRef.current = arCamera;

    const planeManager = new PlaneManager();
    planeManagerRef.current = planeManager;

    const lightEstimator = new LightEstimator(
      renderer.getAmbientLight(),
      renderer.getHemisphereLight(),
      renderer.getDirectionalLight()
    );
    lightEstimatorRef.current = lightEstimator;
    lightEstimator.init(session);

    const hitTestManager = new HitTestManager(renderer.getScene());
    hitTestManager.setPlaneManager(planeManager);
    hitTestManagerRef.current = hitTestManager;

    const hitTestInitialized = await hitTestManager.initHitTest(session, refSpace);
    if (hitTestInitialized) {
      setHitTestReady(true);
      setStatusMessage("Move camera slowly to scan the floor");
    } else {
      setStatusMessage("AR ready · surface scanning unavailable");
    }

    const anchorManager = new AnchorManager();
    anchorManagerRef.current = anchorManager;

    const transformController = new TransformController(
      objectPlacer,
      renderer.getCamera(),
      renderer.getScene()
    );
    transformController.setPlaneManager(planeManager);
    transformController.setAnchorManager(anchorManager);
    transformController.setProductClassResolver(
      (pid) => ALL_PRODUCTS.find((p) => p.id === pid)?.productClass ?? "mass"
    );
    transformControllerRef.current = transformController;

    const measurementVisualizer = new MeasurementVisualizer(renderer.getScene());
    measurementVisualizerRef.current = measurementVisualizer;

    renderer.showShadowPlane(true);

    // Skip scanning phase — immediately ready and start calibration
    setScanStatus("ready");
    useMeasurementStore.getState().startCalibration();
    setStatusMessage("Aim at corner 1/4 and tap capture");

    let guidanceCounter = 0;
    let lastFrameTime = 0;

    renderer.setAnimationLoop((time, frame) => {
      if (!frame) return;

      arCamera.updateFromXRFrame(frame, refSpace);
      lightEstimator.update(frame);
      planeManager.update(frame, refSpace);
      anchorManager.update(frame, refSpace, objectPlacer.getAllPlacedModelsMap());

      const hitDetected = hitTestManager.update(frame, refSpace);

      const dtSec = lastFrameTime === 0 ? 0.016 : (time - lastFrameTime) / 1000;
      lastFrameTime = time;
      transformControllerRef.current?.updateHighlightAnimation(dtSec);
      objectPlacerRef.current?.updateLoadingAnimation(time / 1000);

      // --- Update AR Price Tags ---
      const placedModels = objectPlacerRef.current?.getAllPlacedModelsMap();
      const camera = renderer.getCamera();
      if (placedModels) {
        for (const [id, modelData] of placedModels.entries()) {
          const el = document.getElementById(`ar-tag-${id}`);
          if (el) {
            // Get world position of the object
            const pos = new THREE.Vector3();
            modelData.model.getWorldPosition(pos);
            
            // Adjust Y so the tag is placed roughly above the object
            // Using bounding box max.y is better, but a flat +1m is an okay fallback
            if (modelData.boundingBox) {
              pos.y = modelData.boundingBox.max.y + 0.15;
            } else {
              pos.y += 1.0; 
            }

            pos.project(camera);

            // Check if the object is in front of the camera
            if (pos.z < 1) {
              const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
              const y = (pos.y * -0.5 + 0.5) * window.innerHeight;
              el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
              el.classList.remove("hidden");
            } else {
              el.classList.add("hidden");
            }
          }
        }
      }
      // ----------------------------

      // --- Dimension callouts ---
      const tc = transformControllerRef.current;
      if (selectedObjectIdRef.current && tc) {
        if (tc.getCalloutAnchors(_calloutAnchors)) {
          const pm = objectPlacerRef.current?.getPlacedModel(selectedObjectIdRef.current);
          if (pm) {
            pm.boundingBox.getSize(_calloutSize);
            writeCalloutLabel(camera, _calloutAnchors.w, _calloutSize.x, "callout-w");
            writeCalloutLabel(camera, _calloutAnchors.d, _calloutSize.z, "callout-d");
            writeCalloutLabel(camera, _calloutAnchors.h, _calloutSize.y, "callout-h");
          }
        }
      } else {
        for (const id of ["callout-w", "callout-d", "callout-h"]) {
          const el = document.getElementById(id);
          if (el) el.style.display = "none";
        }
      }
      // --------------------------

      // --- Measurement badges ---
      const mState = useMeasurementStore.getState();
      const corners = mState.corners;
      if (corners.length > 0) {
        const camera = renderer.getCamera();
        for (let i = 0; i < corners.length; i++) {
          const el = document.getElementById(`measure-corner-${i}`);
          if (!el) continue;
          _proj.set(corners[i][0], corners[i][1] + 0.05, corners[i][2]).project(camera);
          writeBadge(el, _proj);
        }

        const edgeTotal = corners.length === 4 ? 4 : corners.length - 1;
        for (let i = 0; i < edgeTotal; i++) {
          const el = document.getElementById(`measure-edge-${i}`);
          if (!el) continue;
          const a = corners[i];
          const b = corners[(i + 1) % corners.length];
          const len = Math.hypot(a[0] - b[0], a[2] - b[2]);
          const cm = Math.round(len * 100);
          if (edgeTextCacheRef.current[i] !== cm) {
            edgeTextCacheRef.current[i] = cm;
            el.textContent = `${(cm / 100).toFixed(2)} m`;
          }
          _badgeMid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.03, (a[2] + b[2]) / 2).project(camera);
          writeBadge(el, _badgeMid);
        }
      }
      // --------------------------

      // --- Measurement preview line ---
      if (mState.mode === "capturing" && mState.corners.length > 0 && mState.corners.length < 4) {
        const last = mState.corners[mState.corners.length - 1];
        const fresh = hitDetected && hitTestManager.getTimeSinceLastDetection() < 0.5;
        measurementVisualizerRef.current?.setPreview(last, fresh ? hitTestManager.getHitPosition() : null);
      } else {
        measurementVisualizerRef.current?.setPreview(null, null);
      }
      // ---------------------------------

      // Update guidance message every 60 frames (~1s)
      guidanceCounter++;
      if (guidanceCounter % 60 === 0) {
        // Wall height estimation feed
        if (planeManager.isSupported()) {
          const samples = planeManager.getVerticalPlanes().map((p) => ({ polygon: p.plane.polygon }));
          const est = estimateWallHeight(samples);
          if (est !== null && Math.abs(est - lastHeightEstRef.current) > 0.05) {
            lastHeightEstRef.current = est;
            useMeasurementStore.getState().setEstimatedHeight(est);
          }
        }

        if (selectedObjectIdRef.current) {
          // In edit mode — don't overwrite edit-mode status messages
        } else if (useMeasurementStore.getState().mode === "capturing") {
          // Calibration in progress — keep corner instructions shown by touch handlers
        } else if (hitTestManager.hasEverDetected()) {
          setStatusMessage("Tap surface to place · drag to move");
        }
      }

      if (hitDetected && !hitTestReady) {
        setHitTestReady(true);
      }

      renderer.render();
    });
  }, []);

  const syncObjectToStore = useCallback((id: string) => {
    const placedModel = objectPlacerRef.current?.getPlacedModel(id);
    if (!placedModel) return;
    updateTransform(id, {
      position: [
        placedModel.model.position.x,
        placedModel.model.position.y,
        placedModel.model.position.z,
      ],
      rotation: [
        placedModel.model.rotation.x,
        placedModel.model.rotation.y,
        placedModel.model.rotation.z,
      ],
      scale: [
        placedModel.model.scale.x,
        placedModel.model.scale.y,
        placedModel.model.scale.z,
      ],
    });
  }, [updateTransform]);

  const placeSelectedProduct = useCallback(
    (position: THREE.Vector3, quaternion: THREE.Quaternion, surfaceType: "floor" | "wall", wallNormal?: THREE.Vector3) => {
      const product = selectedProduct;
      if (!product) return;

      const id = `placed_${Date.now()}_${placeCounterRef.current++}`;

      objectPlacerRef.current?.placeObject(
        id,
        product.id,
        product.modelUrl,
        position,
        quaternion,
        undefined, // default scale
        surfaceType,
        wallNormal
      );

      placeObject(id, product.id, product.modelUrl, [
        position.x,
        position.y,
        position.z,
      ]);

      setStatusMessage(`Placed: ${product.nameUz || product.name}`);
    },
    [selectedProduct, placeObject]
  );

  useEffect(() => {
    placeSelectedProductRef.current = placeSelectedProduct;
  }, [placeSelectedProduct]);

  useEffect(() => {
    syncObjectToStoreRef.current = syncObjectToStore;
  }, [syncObjectToStore]);

  // Attach touch listeners to document level (works regardless of WebXR DOM overlay state).
  // Registered ONCE on mount — handlers read state from refs, not closures, so we never
  // re-attach on prop/state changes.
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (!isARActiveRef.current) return;
      const overlay = overlayStateRef.current;
      if (overlay.marketOpen || overlay.finishOpen) return;
      if (useARStore.getState().scanStatus === "scanning") return; // block taps while scanning
      const tc = transformControllerRef.current;
      if (!tc) return;

      const target = e.target as HTMLElement;
      if (target.closest("button, a, [role='button'], input, select, textarea")) return;
      e.preventDefault();
      const touches = e.touches;

      if (useMeasurementStore.getState().mode === "capturing") {
        if (touches.length === 1) {
          const t = touches[0];
          touchRef.current.startX = t.clientX;
          touchRef.current.startY = t.clientY;
          touchRef.current.mode = "pending-corner";
        }
        return;
      }

      if (touches.length === 1) {
        const t = touches[0];
        touchRef.current.startX = t.clientX;
        touchRef.current.startY = t.clientY;
        const hitId = tc.hitTestObject(t.clientX, t.clientY);
        if (hitId) {
          // Tap on an existing object → select / re-select it
          tc.selectObject(hitId);
          setSelectedObjectId(hitId);
          touchRef.current.mode = "pending-drag";
          touchRef.current.dragObjectId = hitId;
        } else {
          // Tap on empty floor
          if (tc.getSelectedId()) {
            // Currently editing an object → wait until touchend to deselect
            // so we don't accidentally abort a pinch gesture if the first finger hits empty space
            touchRef.current.mode = "pending-deselect";
            touchRef.current.dragObjectId = null;
          } else {
            // No selection → this tap will PLACE the current product
            tc.selectObject(null);
            setSelectedObjectId(null);
            touchRef.current.mode = "pending-place";
            touchRef.current.dragObjectId = null;
          }
        }
      } else if (touches.length === 2 && tc.getSelectedId()) {
        const [a, b] = [touches[0], touches[1]];
        const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx);
        touchRef.current.mode = "pinch";
        touchRef.current.lastPinchDist = dist; touchRef.current.lastTwistAngle = angle;
        tc.onScaleStart(dist); tc.onRotateStart(angle);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isARActiveRef.current) return;
      const overlay = overlayStateRef.current;
      if (overlay.marketOpen || overlay.finishOpen) return;
      if (useARStore.getState().scanStatus === "scanning") return;
      const tc = transformControllerRef.current;
      if (!tc) return;
      const state = touchRef.current;
      if (state.mode === "none") return;
      e.preventDefault();
      const touches = e.touches;

      if (touches.length === 2 && state.mode === "pinch") {
        const [a, b] = [touches[0], touches[1]];
        const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx);
        tc.onScaleMove(dist); tc.onRotateMove(angle);
        state.lastPinchDist = dist; state.lastTwistAngle = angle;
        return;
      }

      if (state.mode === "pending-corner") {
        const t = touches[0];
        const moved = Math.hypot(t.clientX - state.startX, t.clientY - state.startY);
        if (moved > DRAG_THRESHOLD) state.mode = "none";
        return;
      }

      if (touches.length === 1) {
        const t = touches[0];
        if (state.mode === "pending-place" || state.mode === "pending-drag") {
          const movedX = t.clientX - state.startX, movedY = t.clientY - state.startY;
          const moved = Math.sqrt(movedX * movedX + movedY * movedY);
          if (moved > DRAG_THRESHOLD) {
            if (state.mode === "pending-drag" && state.dragObjectId) {
              tc.onDragStart(state.startX, state.startY);
              state.mode = "drag";
            }
            // pending-place stays in "pending-place" through drag — placement
            // happens at the current AR hit-test position on touchend, so
            // the user can drag around the floor to position before placing.
          }
        }
        if (state.mode === "drag") tc.onDragMove(t.clientX, t.clientY);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isARActiveRef.current) { touchRef.current.mode = "none"; return; }
      const overlay = overlayStateRef.current;
      if (overlay.marketOpen || overlay.finishOpen) { touchRef.current.mode = "none"; return; }
      if (useARStore.getState().scanStatus === "scanning") { touchRef.current.mode = "none"; return; }
      
      const tc = transformControllerRef.current;
      const state = touchRef.current;
      if (!tc) { state.mode = "none"; return; }

      if (e.touches.length === 0) {
        if (state.mode === "pinch") { tc.onScaleEnd(); tc.onRotateEnd(); if (state.dragObjectId) syncObjectToStoreRef.current(state.dragObjectId); }
        else if (state.mode === "drag") { tc.onDragEnd(); if (state.dragObjectId) syncObjectToStoreRef.current(state.dragObjectId); }
        else if (state.mode === "pending-deselect") {
          const lastTouch = e.changedTouches[0];
          const hitId = lastTouch ? tc.hitTestObject(lastTouch.clientX, lastTouch.clientY) : null;
          if (hitId) {
            tc.selectObject(hitId);
            setSelectedObjectId(hitId);
          } else {
            tc.deselect();
            setSelectedObjectId(null);
          }
        }
        else if (state.mode === "pending-corner") {
          // Screen-tap capture disabled; use the dedicated Capture Corner button
        }
        else if (state.mode === "pending-place") {
          const lastTouch = e.changedTouches[0];
          const hitId = lastTouch ? tc.hitTestObject(lastTouch.clientX, lastTouch.clientY) : null;
          if (hitId) {
            // Finger lifted on an existing object — select it instead of placing
            tc.selectObject(hitId);
            setSelectedObjectId(hitId);
          } else if (tc.getSelectedId() === null) {
            const ms = useMeasurementStore.getState();
            if (ms.mode !== "done" || !ms.roomConfirmed) {
              setStatusMessage("Complete room measurement first");
            } else {
              const hm = hitTestManagerRef.current;
              if (hm && hm.hasEverDetected()) {
                const productType = selectedProductRef.current.placement || "floor";

                if (productType === "wall") {
                  if (hm.isAimingAtWall()) {
                    placeSelectedProductRef.current(
                      hm.getWallHitPosition(),
                      hm.getHitQuaternion(),
                      "wall",
                      hm.getWallHitNormal()
                    );
                  } else {
                    setStatusMessage("Wall item — point camera at a wall");
                  }
                } else {
                  // floor or floor-wall
                  const pos = hm.getHitPosition();
                  const corners2D = ms.corners.map((c) => ({ x: c[0], z: c[2] }));
                  if (corners2D.length === 4 && !isPointInPolygon({ x: pos.x, z: pos.z }, corners2D)) {
                    setStatusMessage("Cannot place outside room bounds");
                  } else {
                    placeSelectedProductRef.current(pos, hm.getHitQuaternion(), "floor");
                  }
                }
              } else {
                setStatusMessage("No surface detected — move camera slowly to scan");
              }
            }
          }
        }
        state.mode = "none"; state.dragObjectId = null;
      } else if (e.touches.length === 1 && state.mode === "pinch") {
        tc.onScaleEnd(); tc.onRotateEnd();
        if (state.dragObjectId) syncObjectToStoreRef.current(state.dragObjectId);
        state.mode = "none"; state.dragObjectId = null;
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!transformControllerRef.current) return;
    const deletedId = transformControllerRef.current.deleteSelected();
    if (deletedId) {
      removeObject(deletedId);
      setSelectedObjectId(null);
      setStatusMessage("Object deleted");
    }
  }, [removeObject]);

  const handleRotateLeft = useCallback(() => {
    transformControllerRef.current?.rotateSelectedByAngle(-Math.PI / 12);
  }, []);

  const handleRotateRight = useCallback(() => {
    transformControllerRef.current?.rotateSelectedByAngle(Math.PI / 12);
  }, []);

  const handleNudge = useCallback(
    (dx: number, dz: number) => {
      const tc = transformControllerRef.current;
      const id = tc?.getSelectedId();
      if (!tc || !id) return;
      tc.nudgePosition(dx, dz);
      syncObjectToStore(id);
    },
    [syncObjectToStore]
  );

  const handleScaleUp = useCallback(() => {
    const tc = transformControllerRef.current;
    const id = tc?.getSelectedId();
    if (!tc || !id) return;
    if (tc.isScaleLocked()) {
      setStatusMessage("1:1 factory scale — size locked");
      return;
    }
    const factor = tc.scaleBy(1.1);
    syncObjectToStore(id);
    if (factor === 1) setStatusMessage("Max scale reached");
  }, [syncObjectToStore]);

  const handleScaleDown = useCallback(() => {
    const tc = transformControllerRef.current;
    const id = tc?.getSelectedId();
    if (!tc || !id) return;
    if (tc.isScaleLocked()) {
      setStatusMessage("1:1 factory scale — size locked");
      return;
    }
    const factor = tc.scaleBy(0.9);
    syncObjectToStore(id);
    if (factor === 1) setStatusMessage("Min scale reached");
  }, [syncObjectToStore]);

  const handleDeselect = useCallback(() => {
    const tc = transformControllerRef.current;
    const id = tc?.getSelectedId();
    if (!tc || !id) return;
    tc.deselect();
    setSelectedObjectId(null);
    setStatusMessage("Deselected — tap surface to place");
  }, []);

  const handleClearScene = useCallback(() => {
    objectPlacerRef.current?.clearAll();
    useARStore.getState().clearScene();
    setSelectedObjectId(null);
    setStatusMessage("Scene cleared");
  }, []);

  const handleMeasureToggle = useCallback(() => {
    const ms = useMeasurementStore.getState();
    transformControllerRef.current?.deselect();
    setSelectedObjectId(null);
    ms.startCalibration();
    measurementVisualizerRef.current?.clear();
    setStatusMessage("Aim at corner 1/4 and tap capture");
  }, []);

  const captureCorner = useCallback(() => {
    const hm = hitTestManagerRef.current;
    if (hm && hm.hasEverDetected() && hm.getTimeSinceLastDetection() < 0.5) {
      const pos = hm.getHitPosition();
      useMeasurementStore.getState().addCorner([pos.x, pos.y, pos.z]);
      const n = useMeasurementStore.getState().corners.length;
      setStatusMessage(n < 4 ? `Corner ${n}/4 — aim and capture` : "Room captured");
      if (n >= 4) useMeasurementStore.getState().finishCalibration();
    } else {
      setStatusMessage("No surface detected — aim at the floor");
    }
  }, []);

  const handleSaveAndFinish = useCallback(async () => {
    const storeObjects = useARStore.getState().placedObjects;

    const modelUrls = new Map<string, string>();
    const items: OverlayFinishItem[] = [];
    for (const obj of storeObjects) {
      const product = ALL_PRODUCTS.find((p) => p.id === obj.productId);
      if (product) {
        modelUrls.set(obj.id, product.modelUrl);
        items.push({
          id: obj.id,
          productId: obj.productId,
          name: product.nameUz || product.name,
          priceUZS: product.priceUZS,
          storeName: product.storeName,
        });
      }
    }

    if (objectPlacerRef.current) {
      const serialized = serializerRef.current.serialize(
        objectPlacerRef.current,
        modelUrls
      );
      await persistenceRef.current.saveScene("default", serialized);
      await persistenceRef.current.saveToLocalStorage("roomai-last-scene", serialized);
    }

    setFinishItems(items);
    setFinishOpen(true);
    setStatusMessage(`Scene saved — ${items.length} items`);
  }, []);

  const handlePlaceOrder = useCallback(() => {
    // Add all placed items to cart
    for (const item of finishItems) {
      cartAddItem({
        productId: item.productId,
        productName: item.name,
        storeSlug: item.storeName.toLowerCase(),
        storeName: item.storeName,
        priceUZS: item.priceUZS,
        thumbnailUrl: null,
      });
    }
    setFinishOpen(false);
    router.push("/checkout");
  }, [finishItems, cartAddItem, router]);

  const handleExitAR = useCallback(async () => {
    const placer = objectPlacerRef.current;
    if (placer && placerListenersRef.current) {
      const l = placerListenersRef.current;
      placer.removeEventListener("model-loading", l.onModelLoading);
      placer.removeEventListener("model-loaded", l.onModelLoaded);
      placer.removeEventListener("model-failed", l.onModelFailed);
      placer.removeEventListener("model-removed", l.onModelRemoved);
      placer.removeEventListener("scene-cleared", l.onSceneCleared);
      placerListenersRef.current = null;
    }
    await sessionManagerRef.current?.endSession();
    rendererRef.current?.dispose();
    objectPlacerRef.current?.dispose();
    measurementVisualizerRef.current?.dispose();
    measurementVisualizerRef.current = null;
    transformControllerRef.current?.dispose();
  }, []);


  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-4">AR Not Supported</h1>
        <p className="text-gray-400 text-center mb-6">
          WebXR native camera AR requires Chrome on Android.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setIsSupported(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white shadow-lg transition"
          >
            Launch 3D Demo Mode (Simulator)
          </button>
          <a
            href="/catalog"
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-center rounded-xl font-semibold text-slate-300 transition"
          >
            Browse Catalog
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* DOM Overlay root */}
      <div
        id="ar-overlay"
        ref={overlayRef}
        className="absolute inset-0"
      >
        {!isARActive && (
          <div className="flex flex-col items-center justify-center h-full pointer-events-auto">
            <button
              id="start-ar-btn"
              onClick={() => {
                setStatusMessage("Starting AR...");
                startAR().catch((e: unknown) => {
                  console.error("Start AR failed:", e);
                  const msg = e instanceof Error ? e.message : "Unknown error";
                  setStatusMessage(`Failed: ${msg}`);
                });
              }}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-white font-bold text-lg shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
            >
              Start AR Experience
            </button>
            <p className="text-white/60 mt-4 text-sm text-center px-6">{statusMessage}</p>
          </div>
        )}

        {isARActive && (
          <ARCameraStagerOverlay
            statusMessage={statusMessage}
            hitTestReady={hitTestReady}
            selectedObjectId={selectedObjectId}
            placedObjectsCount={placedObjects.length}
            totalPriceUZS={totalPriceUZS}
            loadingCount={loadingCount}
            selectedProductName={selectedProduct.nameUz || selectedProduct.name}
            scaleLocked={scaleLocked}
            products={ALL_PRODUCTS}
            marketOpen={marketOpen}
            onMarketOpenChange={setMarketOpen}
            onSelectProduct={setSelectedProduct}
            onRotateLeft={handleRotateLeft}
            onRotateRight={handleRotateRight}
            onDeleteSelected={handleDeleteSelected}
            onClearScene={handleClearScene}
            onExit={handleExitAR}
            onSaveAndFinish={handleSaveAndFinish}
            onNudge={handleNudge}
            onScaleUp={handleScaleUp}
            onScaleDown={handleScaleDown}
            onDeselect={handleDeselect}
            measureMode={measureMode}
            onMeasureToggle={handleMeasureToggle}
            onCaptureCorner={captureCorner}
            finishOpen={finishOpen}
            finishItems={finishItems}
            onCloseFinish={() => setFinishOpen(false)}
            onPlaceOrder={handlePlaceOrder}
            onBeforeAfter={() => setBeforeAfterOpen(true)}
            onShareUrl={handleShareUrl}
          />
        )}

        <BeforeAfterSlider
          isOpen={beforeAfterOpen}
          onClose={() => setBeforeAfterOpen(false)}
          canvasRef={canvasRef}
        />
      </div>
    </div>
  );
}
