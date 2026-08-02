# RoomAI Asset Pipeline Scripts

Automated 3D asset conversion and optimization pipeline for mobile WebAR.

## Pipeline Stages

```
assets/raw (OBJ/FBX/GLTF)
    │
    ▼ 1. convert-to-glb.ts
public/models/demo (GLB)
    │
    ├── 2. draco-compress.ts ──► public/models/draco-compressed
    ├── 3. generate-lod.ts   ──► public/models/lod
    ├── 4. generate-thumbnails.ts ──► public/thumbnails
    └── 5. validate-assets.ts (gate — exits non-zero on failure)
```

## Quick Start

```bash
# Full pipeline (sequential)
npm run assets:convert

# Validate only (CI-friendly, exit code 1 on failure)
npm run assets:validate

# Draco compression only
npm run assets:compress

# Demo data setup (download + DB)
npm run demo:setup
```

## Scripts

| Script | Purpose | Key Flags |
|--------|---------|-----------|
| `convert-to-glb.ts` | Convert OBJ/GLTF/GLB/FBX → GLB | `--input`, `--output` |
| `draco-compress.ts` | Draco mesh compression | `--quality` (1-10), `--compression-level`, `--input`, `--output` |
| `generate-lod.ts` | 3 LOD tiers (high/medium/low) | `--input`, `--output` |
| `generate-thumbnails.ts` | SVG placeholder thumbnails (PNG needs browser context) | `--input`, `--output` |
| `validate-assets.ts` | Size/normals/textures/Draco gate | `--max-size` (MB), `--no-strict`, `--input` |
| `batch-process.ts` | Orchestrator for all stages | `--skip-*`, `--parallel`, `--input`, `--output` |
| `fetch-store-products.ts` | Store product fetcher stub | `--stores`, `--limit`, `--delay` |

## Examples

```bash
# Convert only
npx tsx scripts/convert-to-glb.ts --input assets/raw --output public/models/demo

# Compress with lower quality for older phones
npx tsx scripts/draco-compress.ts --quality 5 --output public/models/draco-compressed

# Validate with 10MB limit, non-strict
npx tsx scripts/validate-assets.ts --max-size 10 --no-strict

# Run everything in parallel
npx tsx scripts/batch-process.ts --parallel
```

## FBX Support

FBX conversion requires `@gltf-transform/cli` with FBX plugin. Install:

```bash
npm install -D @gltf-transform/cli
npx gltf-transform optimize input.fbx output.glb
```

## CI Usage

`.github/workflows/asset-validation.yml` runs `assets:validate` on every PR.
Any model exceeding 5MB, missing normals, or failing to parse aborts the build.

## Notes

- **Thumbnails**: SVG placeholders are generated in Node. For true geometry
  previews, render GLBs in a browser context (see Phase 4 notes) or use
  headless-gl + three.js on Linux CI.
- **Draco decoder**: The Three.js `DRACOLoader` is configured to look in
  `/models/draco/`. Copy `draco_decoder.wasm`, `draco_decoder.js`, and
  `draco_wasm_wrapper.js` from `node_modules/draco3d/` there.
- **Scrapers**: Asaxiy/Olcha have no public APIs. The fetcher is a stub —
  wire up partner APIs or HTML parsing for production use.
