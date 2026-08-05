# AR Furniture Placer — Production Realism Implementation Plan

## 0. Mission

Strip the Room Measurement flow and evolve this project into a **pure, production-quality 3D furniture placer** matching the feel of **IKEA Place** and **Apple AR Quick Look**. Fix the six identified reality-breakers in capability-gated phases; every feature degrades gracefully on unsupported devices.

**New placement UX (post-pivot):**

Start AR → scan floor → reticle appears → **tap to place immediately** (no measurement gate). Reticle tints red on invalid floor or occupied space.

---

## Current-State Audit Findings

- **Drift root cause:** `AnchorManager.createAnchorFromHitTest()` is dead code — `page.tsx` never calls it at placement time. Objects are placed at raw hit-test coordinates with no anchor, so they slide as ARCore refines the map.
- **Stale-proxy bug:** `AnchorManager.update()` writes the anchor pose into `model.matrix` but never recomputes `boundingBox`, `hitProxy`, or `contactShadow` — so interaction boxes drift out of sync.
- **Anchor leak:** `createAnchorFromPose()` overwrites the map entry without deleting the old `XRAnchor`.
- **Comment/code mismatch:** `HIT_PROXY_PADDING` is documented as "1.4x" but is actually `2.0`.
- **Shadows fully disabled:** `renderer.shadowMap.enabled = false` and `loadRealModel()` force-sets `castShadow = false`. `LightEstimator` already tracks real light direction, but nothing casts shadows.
- **Dead code:** `BeforeAfterSlider` is imported in `page.tsx` but never rendered.
- **Measurement gate:** placement is blocked by "Complete room measurement first" and `measureMode === "done" && roomConfirmed` gates in `ARCameraStagerOverlay`.

---

## 1. Capability Matrix

Capability detection is decentralized: each manager checks its own WebXR API at session init and no-ops gracefully when unsupported. No central `Capabilities.ts` file is required.

- **anchors**: `AnchorManager` detects `"createAnchor" in XRFrame.prototype`.
- **planeDetection**: `PlaneManager` checks `frame.detectedPlanes`; `OcclusionManager` no-ops when empty.
- **lightEstimation**: `LightEstimator` resolves `session.requestLightProbe()`.
- **depthSensing**: `ARSessionManager` requests `"depth-sensing"` as optional; `DepthOcclusionManager` activates only when `session.depthUsage === "cpu-optimized"`.

**Rules:**

- Requested features in `ARSessionManager`: keep `hit-test`, `local-floor` required; optional = `dom-overlay`, `anchors`, `plane-detection`, `light-estimation`, **`depth-sensing`** (added in Phase 5).
- `depthSensing` init dict: `{ usagePreference: ["cpu-optimized", "gpu-optimized"], dataFormatPreference: ["luminance-alpha", "float32"] }`.
- Every manager no-ops when its capability is false — zero visual regression on unsupported devices.

---

## 2. Phase 0 — Pivot: Remove Room Measurement

### Delete files

- `src/store/useMeasurementStore.ts`
- `src/lib/measurementMath.ts`
- `src/ar/measurement/MeasurementVisualizer.ts`
- `src/components/ar/MeasurementOverlay.tsx`
- `src/components/ar/BeforeAfterSlider.tsx` (dead code)
- `src/ar/decor/SurfacePainter.ts`
- `src/ar/decor/surfacePresets.ts`
- `src/store/useSurfaceStore.ts`

### Relocate

- `src/ar/measurement/DimensionCallouts.ts` → `src/ar/ui/DimensionCallouts.ts` (per-object W×D×H labels are a furniture feature, keep). Update the import in `TransformController.ts`; delete the now-empty `src/ar/measurement/` directory.

### Edit `src/app/ar/page.tsx`

- Remove measurement imports, `captureCorner`, `handleMeasureToggle`, `pending-corner` touch mode, auto-`startCalibration()` on session start, measurement badge and preview-line render blocks, wall-height estimation block, `BeforeAfterSlider` import, `SurfacePainter`/`syncSurfaces`/surface store subscriptions, and the `useMeasurementStore` room-bounds gate in `pending-place`.
- Placement branch becomes: `hm.hasEverDetected()` → floor items check `planeManager.isValidFloorPosition(pos, normal)` + collision pre-check (Phase 3) → place; wall items unchanged.

### Edit `src/components/ar/ARCameraStagerOverlay.tsx`

- Remove `measureMode`, `onMeasureToggle`, `onCaptureCorner` props.
- Remove capture-corner UI, `<MeasurementOverlay />`, and both `measureMode === "done" && roomConfirmed` gates (picker and edit panel render whenever `scanStatus === "ready"`).

### Edit `src/ar/interaction/TransformController.ts`

- Delete `roomCorners`, `setRoomCorners()`, the `isPointInPolygon` import, and both polygon gates in `onDragMove`.

### Final sweep

- `rg "measurementMath|useMeasurementStore|SurfacePainter|useSurfaceStore|MeasurementOverlay|BeforeAfterSlider|surfacePresets|estimateWallHeight|isPointInPolygon" src/` → zero hits.
- Remove dead exports from `src/store/index.ts`.
- Prune `RoomMetrics` from `src/types/index.ts` if orphaned.

---

## 3. Phase 1 — Quick Wins

### 3.1 Proximity Fading

Files: `src/ar/placement/ObjectPlacer.ts`, `src/app/ar/page.tsx`

- Add to `PlacedModel`:
  - `fadeMaterials: { mat: THREE.Material; baseOpacity: number }[]`
  - `proximityOpacity = 1`
- Populate `fadeMaterials` at the end of `crossFadeSwap()` (materials are already cloned there). **Skip placeholders** — transient, already translucent.
- New method `updateProximityFade(camPos: THREE.Vector3)`:
  - `dist = placed.boundingBox.distanceToPoint(camPos)` (distance to AABB surface, not center).
  - Fade zone: **0.50 m → 0.30 m**, smoothstep; hysteresis **0.05 m** (enter at 0.50, exit at 0.55).
  - `opacity = baseOpacity × proximityOpacity`; when `proximityOpacity ≥ 0.999` restore `transparent = false`, else `transparent = true`.
  - Multiply contact-shadow material opacity (base 0.55).
- Call once per frame in the render loop after `arCamera.updateFromXRFrame`.
- Fade DOM price tags via `el.style.opacity` in the existing tag loop; hide when `< 0.05`.

**Acceptance:** walking into the chair fades it out before the near plane clips; no hollow-mesh reveal.

### 3.2 Hit-Box Precision

Files: `src/ar/placement/ObjectPlacer.ts`, `src/ar/interaction/TransformController.ts`

- `HIT_PROXY_PADDING`: `2.0` → **`1.15`**.
- Min proxy dims: unify to `MIN_HIT_PROXY_DIM = 0.15`; fix stale "1.4x" comment.
- `hitTestObject()` new priority:
  1. Precise mesh raycast against `placedModel.model` (recursive) — nearest hit wins.
  2. Tight hit proxies.
  3. Screen-space fallback: threshold 12% → **8%**, and the tap must fall inside the model's projected screen AABB.

### 3.3 Anchor Hardening

Files: `src/ar/core/AnchorManager.ts`, `src/app/ar/page.tsx`, `src/ar/placement/ObjectPlacer.ts`

- **Create anchors at placement:** in `placeSelectedProduct`, after `placeObject()`, call `anchorManager.createAnchorFromHitTest(hitTestManager.getLastHitTestResult(), id)` (guarded by `capabilities.anchors` and `getTimeSinceLastDetection() < 0.5`). Works for wall items too.
- `AnchorManager`:
  - Real detection in constructor: `"createAnchor" in XRFrame.prototype`.
  - `deleteAnchor(modelId)` at the top of both create methods (leak fix).
  - `update()` gains callback `onPoseApplied?: (id: string) => void`.
  - Page passes `id => objectPlacer.syncDerivedTransforms(id)` — new lightweight method recomputing `boundingBox` + hit proxy + contact shadow only (epsilon-gated, ~1 mm).
  - Tracking-loss guard: if `frame.trackedAnchors` exists and doesn't contain the anchor → skip pose write.
  - Skip pose writes for models being dragged (anchor already deleted at drag start).

### 3.4 Micro-perf

File: `src/app/ar/page.tsx`

- Hoist `new THREE.Vector3()` out of the per-frame price-tag loop to a module scratch vector.

---

## 4. Phase 2 — Dynamic Shadows & Lighting

### `src/ar/core/ARRenderer.ts`

- `configureShadows(quality: "off" | "low" | "high")`:
  - `low`: `shadowMap.enabled = true`, `PCFShadowMap`, `mapSize = 512`
  - `high`: `PCFSoftShadowMap`, `mapSize = 1024` (mobile) / `2048` (desktop)
- Any runtime toggle requires `material.needsUpdate = true` on all scene materials — add `markAllMaterialsDirty()`. Configure once at session start before models load.
- `directionalLight.castShadow = true`; ortho shadow camera ±4 m, near 0.5 / far 25, `bias = -0.0004`, `normalBias = 0.02`; add `directionalLight.target` to scene.
- `updateShadowRig(focus, lightDir)` per frame:
  - target = centroid of placed models (fallback: 2 m ahead of camera at floor level)
  - light position = `focus − lightDir × 8`

### `src/ar/core/LightEstimator.ts`

- Add `getPrimaryLightDirection(out): boolean` (normalized `targetDirPosition`; false when unsupported → rig uses fixed default).

### New file: `src/ar/placement/ShadowCatcher.ts`

- 12×12 m `PlaneGeometry` + `THREE.ShadowMaterial({ opacity: 0.35 })`.
- `receiveShadow = true`; y = `planeManager.getReferenceFloorY()` when finite, else 0; reposition when Δy > 2 cm.

### `src/ar/placement/ObjectPlacer.ts`

- `loadRealModel()` traverse: `castShadow = true` (currently forced false); keep `receiveShadow = false`.
- Blob contact shadow stays as AO complement; opacity 0.55 → **0.35** while dynamic shadows active (`setContactShadowIntensity()`).

### `src/app/ar/page.tsx`

- Adaptive quality ladder in render loop: `high → low → off` when `renderer.getFPS() < 30` sustained 3 s; step up after 15 s above 50 fps.
- Only call `configureShadows()` on actual tier change.

---

## 5. Phase 3 — Object-to-Object Collision

### New file: `src/ar/placement/CollisionResolver.ts`

Pure, allocation-free resolver:

- `resolveFloorDrag(draggedId, candidatePos, draggedBox, others): { position, collidedIds }`
- XZ AABB overlap with Y-overlap precondition (>1 cm).
- Push out along axis of least penetration + 1 cm gap; max 3 relaxation passes.

### `src/ar/interaction/TransformController.ts`

- Floor branch of `onDragMove()` runs candidate through resolver before `updateTransform()` → furniture slides around obstacles.
- On collision rising edge: highlight color emerald `0x10b981` → red `0xef4444`; optional `navigator.vibrate?.(10)` in try/catch.
- Rotate/scale: snapshot transform at gesture start; on gesture end, if overlap → revert + status "Not enough space".

### `src/app/ar/page.tsx` + `src/ar/placement/HitTestManager.ts`

- Each frame, test the selected product's catalog-dims footprint at the reticle position.
- If occupied: `hitTestManager.setReticleBlocked(true)` (INVALID_COLOR tint) and block placement on touchend with "Space occupied".
- Wall items exempt.

---

## 6. Phase 4 — Occlusion Tier A: Plane Occluders

### New file: `src/ar/placement/OcclusionManager.ts`

Gate: `capabilities.planeDetection`.

- One invisible mesh per `XRPlane`.
- Geometry from `plane.polygon` via `THREE.Shape`/`ShapeGeometry` (earcut handles concave polygons) using the `(x, −z)` + `rotateX(−π/2)` pattern; transformed by the plane pose.
- Material: `MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: DoubleSide })`, `renderOrder = -1`.
- Rebuild geometry only when `plane.lastChangedTime` changes; remove meshes for vanished planes; cap 16 planes.
- Offset every occluder **5–10 mm along its negative normal** to prevent floor-plane z-fighting.

**Result:** chair dragged behind a real wall or furniture-top is hidden. Documented limitation: planar surfaces only → Tier B.

---

## 7. Phase 5 — Occlusion Tier B: WebXR Depth API

### Types

Extend `src/types/webxr-extensions.d.ts` with `XRSessionInit.depthSensing`, `XRDepthInformation`, and `XRCPUDepthInformation` (`width/height`, `normDepthBufferFromNormView`, `getDepthInMeters(x, y)`). First check `@types/webxr` and only fill gaps.

### `src/ar/core/ARSessionManager.ts`

- Add `"depth-sensing"` to optional features.
- Add the `depthSensing` init dict. Prefer `cpu-optimized` (integrates cleanly with three.js); `gpu-optimized` requires raw WebGL texture rebinding.

### New file: `src/ar/core/DepthOcclusionManager.ts`

Gate: `capabilities.depthSensing`.

- Per frame: `frame.getDepthInformation(viewerPose.views[0])` → downsample via `getDepthInMeters()` into a ~160×90 `Float32Array` → `THREE.DataTexture` (`RedFormat`/`FloatType`).
- Inject occlusion into placed-model materials at the `crossFadeSwap()` clone point via `material.onBeforeCompile`:
  - Uniforms: `uDepthTex`, `uDepthUvTransform` (from `normDepthBufferFromNormView`), `uDepthResolution`.
  - Fragment: NDC → depth-texture UV, sample real depth, compare against `-vViewPosition.z` (already available in standard materials), `discard` when real surface is >2 cm closer than the fragment.
- Null-depth frames → reuse last texture.
- Auto-disable on adaptive ladder if fps < 25 sustained.

**Acceptance:** the video's exact failure case — chair dragged behind the physical bed — renders correctly hidden.

---

## 8. Render Loop — Final Order

```
arCamera.updateFromXRFrame
lightEstimator.update
planeManager.update
occlusionManager.update (Tier A)
depthOcclusionManager.update (Tier B)
anchorManager.update(+syncDerived)
hitTestManager.update
collision reticle pre-check
placer.updateProximityFade
shadowRig update
adaptive quality tick
highlight/loading anims, price tags (opacity-aware), callouts
renderer.render()
```

---

## 9. Verification

- `npm run build` + `npm run lint` green.
- No test framework exists in this repo — verification is build + on-device QA.
- Chrome Android checklist:
  1. Walk into chair → fades before clipping.
  2. Tap empty floor near object → places, doesn't select neighbor.
  3. Walk 3 m away and back → object stays locked.
  4. Drag sofa into table → slides around, red highlight, no overlap on release.
  5. Shadow direction matches real window light.
  6. Occlusion: behind wall (Tier A), behind bed (Tier B).

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Runtime `shadowMap` toggle recompiles all materials | Configure once at session start; adaptive changes are rare + `markAllMaterialsDirty` |
| Depth API absent on most devices | Fully capability-gated; Tier A still occludes walls |
| CPU depth upload cost | 160×90 downsample; fps-ladder auto-disable |
| Concave plane polygons | `ShapeGeometry`/earcut; 16-plane cap |
| Anchor creation rejected mid-session | try/catch + no-anchor mode = today's behavior (never worse) |
| `navigator.vibrate` blocked in AR | try/catch, purely cosmetic |

---

## 11. Progress Log

- **2026-08-05**: Plan file created.
- **2026-08-05**: Phase 0 completed — removed room measurement, surface/finishes, and dead code; rewrote `ARCameraStagerOverlay` and `page.tsx` for tap-to-place flow; build green.
- **2026-08-05**: Phase 1 completed — added proximity fade (camera-clipping fix), tightened hit proxies + geometry-first raycast, fixed anchor creation/s leaks/stale proxies, hoisted price-tag vector; build green.
- **2026-08-05**: Phase 2 completed — enabled dynamic shadows, shadow catcher, light-direction shadow rig, adaptive quality ladder; build green.
- **2026-08-05**: Phase 3 completed — added `CollisionResolver`, slide-around dragging with red highlight, reticle collision pre-check, gesture collision revert; build green.
- **2026-08-05**: Phase 4 completed — added plane-based occlusion manager (`OcclusionManager`) writing depth from detected XR planes; build green.
- **2026-08-05**: Phase 5 completed — added `DepthOcclusionManager` with WebXR Depth API CPU path, shader injection via `onBeforeCompile`; build + lint green.
