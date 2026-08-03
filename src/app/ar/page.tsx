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
import { useARStore, useCartStore } from "@/store";
import type { PlacementType } from "@/types";
import {
  ARCameraStagerOverlay,
  type OverlayProduct,
  type OverlayFinishItem,
} from "@/components/ar/ARCameraStagerOverlay";
import demoCatalog from "@/data/demo-catalog";
import { getModelUrl } from "@/lib/modelUrl";

interface TouchState {
  startX: number;
  startY: number;
  mode: "none" | "pending-place" | "pending-drag" | "drag" | "pinch";
  dragObjectId: string | null;
  lastPinchDist: number;
  lastTwistAngle: number;
}

const DRAG_THRESHOLD = 10;
const MOVE_FLOOR_Y = 0;

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
  };
}

const ALL_PRODUCTS: OverlayProduct[] = demoCatalog.map(toPickerProduct);

export default function ARPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isARActive, setIsARActive] = useState(false);
  const [hitTestReady, setHitTestReady] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
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

  const sessionManagerRef = useRef<ARSessionManager | null>(null);
  const rendererRef = useRef<ARRenderer | null>(null);
  const cameraManagerRef = useRef<ARCamera | null>(null);
  const lightEstimatorRef = useRef<LightEstimator | null>(null);
  const planeManagerRef = useRef<PlaneManager | null>(null);
  const hitTestManagerRef = useRef<HitTestManager | null>(null);
  const objectPlacerRef = useRef<ObjectPlacer | null>(null);
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

  const placedObjects = useARStore((s) => s.placedObjects);
  const placeObject = useARStore((s) => s.placeObject);
  const removeObject = useARStore((s) => s.removeObject);
  const updateTransform = useARStore((s) => s.updateTransform);
  const router = useRouter();
  const cartAddItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    selectedObjectIdRef.current = selectedObjectId;
  }, [selectedObjectId]);

  useEffect(() => {
    isARActiveRef.current = isARActive;
  }, [isARActive]);

  useEffect(() => {
    overlayStateRef.current = { marketOpen, finishOpen };
  }, [marketOpen, finishOpen]);

  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);

  useEffect(() => {
    ARSessionManager.isSupported().then((supported) => {
      setIsSupported(supported);
      setStatusMessage(
        supported ? "Tap to start AR" : "AR not supported on this device"
      );
    });

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

    // Create ObjectPlacer early so it's ready when isARActive becomes true
    const objectPlacer = new ObjectPlacer(renderer.getScene(), renderer.getContactShadowTexture());
    objectPlacerRef.current = objectPlacer;

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

    const session = await sessionManager.startSession(overlayRef.current);
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
    transformControllerRef.current = transformController;

    renderer.showShadowPlane(true);

    let guidanceCounter = 0;
    let lastFrameTime = 0;

    renderer.setAnimationLoop((time, frame) => {
      if (!frame) return;

      arCamera.updateFromXRFrame(frame, refSpace);
      lightEstimator.update(frame);
      planeManager.update(frame, refSpace);
      anchorManager.update(frame, refSpace, objectPlacer.getAllPlacedModelsMap());

      const hitDetected = hitTestManager.update(frame, refSpace);

      // Pulse the selected-object highlight and loading placeholders
      const dtSec = lastFrameTime === 0 ? 0.016 : (time - lastFrameTime) / 1000;
      lastFrameTime = time;
      transformControllerRef.current?.updateHighlightAnimation(dtSec);
      objectPlacerRef.current?.updateLoadingAnimation(time / 1000);

      // Update guidance message every 60 frames (~1s)
      guidanceCounter++;
      if (guidanceCounter % 60 === 0) {
        if (selectedObjectIdRef.current) {
          // In edit mode — don't overwrite edit-mode status messages
        } else if (hitTestManager.hasEverDetected()) {
          setStatusMessage("Tap surface to place · drag to move");
        } else if (hitTestInitialized) {
          const secs = Math.floor(guidanceCounter / 60);
          if (secs > 5) {
            setStatusMessage("No surface found. Ensure good lighting and move camera");
          } else {
            setStatusMessage("Move camera slowly to scan the floor...");
          }
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

      const id = `placed_${Date.now()}`;

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

      placeObject(product.id, product.modelUrl, [
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
      const tc = transformControllerRef.current;
      if (!tc) return;

      const target = e.target as HTMLElement;
      if (target.closest("button, a, [role='button'], input, select, textarea")) return;
      e.preventDefault();
      const touches = e.touches;

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
            // Currently editing an object → this tap DESELECTS it
            tc.deselect();
            setSelectedObjectId(null);
            touchRef.current.mode = "none";
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
      const tc = transformControllerRef.current;
      const state = touchRef.current;
      if (!tc) { state.mode = "none"; return; }

      if (e.touches.length === 0) {
        if (state.mode === "pinch") { tc.onScaleEnd(); tc.onRotateEnd(); if (state.dragObjectId) syncObjectToStoreRef.current(state.dragObjectId); }
        else if (state.mode === "drag") { tc.onDragEnd(); if (state.dragObjectId) syncObjectToStoreRef.current(state.dragObjectId); }
        else if (state.mode === "pending-place") {
          // Safety: never place while an object is currently selected
          if (tc.getSelectedId() === null) {
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
                const hitNormal = hm.getHitNormal();
                const pm = planeManagerRef.current;

                // Validate this is actually a floor surface (not a raised ledge/step)
                if (pm && !pm.isValidFloorPosition(pos, hitNormal)) {
                  setStatusMessage("Can't place here — not a valid floor surface");
                } else {
                  placeSelectedProductRef.current(pos, hm.getHitQuaternion(), "floor");
                }
              }
            } else {
              setStatusMessage("No surface detected — move camera slowly to scan");
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
    const factor = tc.scaleBy(1.1);
    syncObjectToStore(id);
    if (factor === 1) setStatusMessage("Max scale reached");
  }, [syncObjectToStore]);

  const handleScaleDown = useCallback(() => {
    const tc = transformControllerRef.current;
    const id = tc?.getSelectedId();
    if (!tc || !id) return;
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
    transformControllerRef.current?.dispose();
  }, []);

  if (isSupported === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Checking AR support...</p>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-4">AR Not Supported</h1>
        <p className="text-gray-400 text-center mb-6">
          WebXR AR requires Android Chrome 79+ or a compatible browser.
          Try opening this page on your Android phone.
        </p>
        <a
          href="/catalog"
          className="px-6 py-3 bg-emerald-500 rounded-xl font-semibold"
        >
          Browse Catalog (Non-AR)
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* DOM Overlay root */}
      <div
        ref={overlayRef}
        className="absolute inset-0"
      >
        {!isARActive && (
          <div className="flex flex-col items-center justify-center h-full">
            <button
              onClick={startAR}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-white font-bold text-lg shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
            >
              Start AR Experience
            </button>
            <p className="text-white/60 mt-4 text-sm">{statusMessage}</p>
          </div>
        )}

        {isARActive && (
          <ARCameraStagerOverlay
            statusMessage={statusMessage}
            hitTestReady={hitTestReady}
            selectedObjectId={selectedObjectId}
            placedObjectsCount={placedObjects.length}
            loadingCount={loadingCount}
            selectedProductName={selectedProduct.nameUz || selectedProduct.name}
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
            finishOpen={finishOpen}
            finishItems={finishItems}
            onCloseFinish={() => setFinishOpen(false)}
            onPlaceOrder={handlePlaceOrder}
          />
        )}
      </div>
    </div>
  );
}
