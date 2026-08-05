# RoomAI — Session Context (Resume File)

> Saved: 2026-08-02 ~04:31 UTC
> Tunnel URL: https://differences-serves-rides-wants.trycloudflare.com
> Status: Working — touches detected, surface detection improved

---

## How to Resume Tomorrow

```powershell
# 1. Navigate to project
cd C:\Users\Diyorbek\room-ai

# 2. Start dev server
Start-Process cmd -ArgumentList "/c","cd /d C:\Users\Diyorbek\room-ai && npm run dev -- -H 0.0.0.0 > dev-server.log 2>&1" -WindowStyle Minimized
# Wait ~10 seconds for startup

# 3. Start tunnel (URL written to temp file)
$logFile = "$env:TEMP\cloudflared-log.txt"
Start-Process cmd -ArgumentList "/k `"C:\Users\Diyorbek\AppData\Local\Temp\opencode\cloudflared.exe tunnel --url http://localhost:3000 > $logFile 2>&1`"" -WindowStyle Minimized
Start-Sleep -Seconds 10
Get-Content $logFile | Select-String "trycloudflare.com"
# Use that URL on your phone
```

---

## What's Built (All 4 Phases + Fixes)

### Phase 1 — Project Setup & Data ✅
- Next.js 16, Tailwind v4, Prisma 7 + SQLite, Zustand
- 18 demo products (Asaxiy + Olcha), UZS pricing
- Pre-caches GLB models on home page (Cache API)

### Phase 2 — WebXR AR Engine ✅
- `src/ar/core/` — ARSessionManager, ARRenderer, ARCamera
- `src/ar/placement/` — HitTestManager (multi-space: viewer/local/local-floor), ObjectPlacer (instant placeholders)
- `src/ar/interaction/` — TransformController (drag/rotate/scale/pinch)
- `src/ar/persistence/` — SceneSerializer (JSON), ScenePersistence (IndexedDB)

### Phase 3 — UI ✅
- GlassPanel, ProductCard, FurnitureCarousel, CartDrawer, ARToolbar
- Landing page (/), Catalog (/catalog), Checkout (/checkout), AR (/ar)
- ProductPicker (Market), FinishModal (Save & Finish)

### Phase 4 — Asset Pipeline ✅
- Draco compression, LOD generation, thumbnail generation, validation
- Ultra-low-poly generator

### Fixes Applied Today
- Document-level touch listeners (fixes WebXR DOM overlay touch issue)
- Disabled dynamic shadows (replaced with fake contact shadow — 2x FPS boost)
- Disabled antialiasing (20-30% GPU savings)
- ObjectPlacer creates placeholder instantly, loads real model async
- Hit-test tries 3 reference spaces (viewer, local, local-floor)
- Reticle persists 30 frames before hiding
- Placement uses last-known surface position
- Y-floor alignment: object bottom sits on surface
- Save & Finish → adds items to cart → checkout
- Object count resets on each AR session start
- Skeleton loaders on ProductCard, FurnitureCarousel, ProductPicker (pulse animation, respects reduced-motion)
- Market (ProductPicker) stays open after selection — multi-item browsing/placing flow
- Market button shows placed item count badge
- Touch handler blocked while picker is open (prevents accidental placement)
- Prisma seed command configured in prisma.config.ts

---

## Key File Locations

| Module | Path |
|--------|------|
| AR Page | `src/app/ar/page.tsx` |
| Hit Test Manager | `src/ar/placement/HitTestManager.ts` |
| Object Placer | `src/ar/placement/ObjectPlacer.ts` |
| AR Renderer | `src/ar/core/ARRenderer.ts` |
| Transform Controller | `src/ar/interaction/TransformController.ts` |
| Product Picker | `src/components/ar/ProductPicker.tsx` |
| Finish Modal | `src/components/ar/FinishModal.tsx` |
| Skeleton | `src/components/ui/Skeleton.tsx` |
| Model Cache | `src/lib/modelCache.ts` |
| Demo Catalog (TS) | `src/data/demo-catalog.ts` |
| Demo Catalog (JSON) | `src/data/demo-catalog.json` |
| Prisma Schema | `prisma/schema.prisma` |
| GLB Models | `public/models/demo/`, `draco-compressed/`, `lod/`, `ultra/` |
| Draco Decoder | `public/models/draco/` |
| Implementation Plan | `C:\Users\Diyorbek\IMPLEMENTATION_PLAN.md` |
| OpenCode Config | `C:\Users\Diyorbek\opencode.json` |

---

## Key npm Commands

```bash
npm run dev -H 0.0.0.0    # Start dev server on all interfaces
npm run db:seed            # Re-seed database (tsx prisma/seed.ts)
npm run db:studio          # Prisma Studio (visual DB browser)
npm run demo:download      # Download/generate demo 3D models
npm run assets:validate    # Validate 3D models for mobile
npm run assets:compress    # Draco compress models
npm run lint               # ESLint check
npm run build              # Production build
```

---

## Session 2 Changes (2026-08-02)

- **Skeleton loaders**: `src/components/ui/Skeleton.tsx` — reusable `<Skeleton>` + `<ProductCardSkeleton>` with pulse animation and `motion-reduce` support. Added `loading` prop to ProductCard, FurnitureCarousel, and ProductPicker.
- **Market multi-select**: ProductPicker no longer closes on item selection. User can browse/switch items freely, close via × or backdrop, then tap surface to place. Touch handler blocked while picker open. Market button now shows placed item count badge.
- **demo-catalog.json**: `src/data/demo-catalog.json` — static JSON manifest of all 18 products.
- **Draco compression**: All 18 models compressed to `public/models/draco-compressed/`. 2 models still > 5 MB due to heavy textures (use placeholders while loading).
- **Tunnel fix**: Cloudflared started with `Start-Process` (detached cmd window, /k flag, output redirected to file). Survives shell timeouts.

---

## Session 3 Changes (2026-08-04)

- **Room Calibration ("Ruletka")**: `MeasurementOverlay` + `MeasurementVisualizer` let users tap 4 corners to measure floor perimeter and estimate wall height. Guided by `measureMode` state.
- **1:1 Scale Lock**: `TransformController` gates scaling for `productClass === "mass"`; rotation remains unlocked. UI shows `🔒 1:1` badge and status message `1:1 factory scale — size locked`. `demo-013` (wardrobe) marked `productClass: "modular"` for testing unlocked scaling.
- **3D Dimension Callouts**: `DimensionCallouts` renders W/D/H lines + ticks around selected object; `page.tsx` projects midpoints to DOM labels (`#callout-w/d/h`) showing `XX cm`.
- **ID Unification**: `useARStore.placeObject` now accepts caller-provided `id`; `page.tsx` generates a single `placed_${ts}_${counter}` ID shared by both `ObjectPlacer` and the store, eliminating duplicate IDs.
- **GLB Normalization**: `ObjectPlacer.setProductDimsResolver` compares loaded GLB bounds against catalog dimensions; off-scale models (>15% width deviation) are auto-scaled to match catalog width.

---

## Known Issues / Notes

1. **Touch works at document level** — if changing touch logic, don't use React synthetic events or overlay.addEventListener; use `document.addEventListener` in useEffect.
2. **Surface detection requires camera movement** — ARCore needs to see the room from multiple angles; user should move phone in slow circles.
3. **GLB models are large (3-17MB)** — pre-caching on home page helps; placeholders appear instantly while loading.
4. **Shadows are disabled** — replacement is a transparent contact shadow circle; don't re-enable shadowMap on mobile.
5. **Cloudflared tunnel** — URL changes each time; update this file with the new URL.
6. **Next.js 16 allowedDevOrigins** — `*.trycloudflare.com` already whitelisted in `next.config.ts`.

---

## Phone Test Flow
1. Open tunnel URL on phone
2. Home page loads → models pre-cache in background
3. Tap "Start AR Experience"
4. Move phone slowly → watch status: "Move camera slowly to scan the floor" → "Tap surface to place"
5. Reticle ring appears on floor
6. Tap surface → colored placeholder appears → real model swaps in
7. Drag to move, pinch to scale, Market to choose items
8. Save & Finish → Place Order → Checkout
