import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NodeIO, type Document, type Texture } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, prune, dedup, weld, simplify } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3d";

interface TierConfig {
  name: "low" | "med" | "high";
  textureMax: number;
  webpQuality: number;
  dracoQuality: number;
  dracoCompression: number;
  simplifyRatio: number;
  stripNormalAO: boolean;
  maxBytes: number;
}

const TIERS: TierConfig[] = [
  { name: "low", textureMax: 256, webpQuality: 55, dracoQuality: 4, dracoCompression: 9, simplifyRatio: 1.0, stripNormalAO: true, maxBytes: 800 * 1024 },
  { name: "med", textureMax: 512, webpQuality: 70, dracoQuality: 6, dracoCompression: 7, simplifyRatio: 1.0, stripNormalAO: false, maxBytes: 1500 * 1024 },
  { name: "high", textureMax: 1024, webpQuality: 82, dracoQuality: 9, dracoCompression: 5, simplifyRatio: 1.0, stripNormalAO: false, maxBytes: 5 * 1024 * 1024 },
];

interface BuildResult {
  productId: string;
  tier: string;
  bytes: number;
  ok: boolean;
  error?: string;
}

async function createIO(): Promise<NodeIO> {
  const encoder = await draco3d.createEncoderModule();
  const decoder = await draco3d.createDecoderModule();
  return new NodeIO()
    .registerExtensions(KHRONOS_EXTENSIONS)
    .registerDependencies({
      "draco3d.encoder": encoder,
      "draco3d.decoder": decoder,
    });
}

const STRIP_SLOTS = /normalTexture|occlusionTexture/i;

function shouldStrip(texture: Texture, tier: TierConfig): boolean {
  if (!tier.stripNormalAO) return false;
  const name = texture.getName() || "";
  return STRIP_SLOTS.test(name);
}

async function processTexture(texture: Texture, tier: TierConfig): Promise<void> {
  if (shouldStrip(texture, tier)) {
    texture.dispose();
    return;
  }
  const image = texture.getImage();
  if (!image) return;
  // Sharp + gltf-transform + meshoptimizer + dual sharp versions in the
  // dependency tree interact badly on Windows (corrupts libvips colourspace
  // detection). We run the sharp conversion in a clean subprocess so it
  // gets its own module state. Subprocess startup is ~100ms — acceptable
  // for a build-time tool.
  const tmpRoot = process.env.TEMP || process.env.TMP || "C:\\Users\\Diyorbek\\AppData\\Local\\Temp";
  const id = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inPath = path.join(tmpRoot, `roomai-in-${id}.bin`);
  const outPath = path.join(tmpRoot, `roomai-out-${id}.webp`);
  fs.writeFileSync(inPath, Buffer.from(image));
  try {
    const script = path.join(process.cwd(), "scripts", "_sharp-convert.mjs");
    const result = spawnSync(
      process.execPath,
      [script, inPath, outPath, String(tier.textureMax), String(tier.webpQuality)],
      { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(result.stderr || `sharp subprocess exited ${result.status}`);
    }
    const out = fs.readFileSync(outPath);
    texture.setImage(new Uint8Array(out));
    texture.setMimeType("image/webp");
  } finally {
    try { fs.unlinkSync(inPath); } catch {}
    try { fs.unlinkSync(outPath); } catch {}
  }
}

async function processTextures(doc: Document, tier: TierConfig): Promise<number> {
  let count = 0;
  for (const texture of doc.getRoot().listTextures()) {
    await processTexture(texture, tier);
    count++;
  }
  return count;
}

async function buildTier(
  io: NodeIO,
  inputPath: string,
  outputPath: string,
  tier: TierConfig
): Promise<{ bytes: number; ok: boolean; error?: string }> {
  try {
    // Read with a BASIC NodeIO (no draco deps) — draco3d module init
    // corrupts libvips/sharp state in the same process, and we need
    // sharp to work on the texture bytes.
    const readIO = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
    const doc = await readIO.read(inputPath);

    // Process textures FIRST — sharp can't read the bytes after weld/dedup/prune
    // touches the internal buffer layout (even though content is identical).
    const texCount = await processTextures(doc, tier);
    process.stderr.write(`  [${texCount} tex] `);

    await doc.transform(weld(), dedup(), prune());

    if (tier.simplifyRatio < 1.0) {
      await MeshoptSimplifier.ready;
      await doc.transform(
        simplify({ simplifier: MeshoptSimplifier, ratio: tier.simplifyRatio, error: 0.01 })
      );
    }

    await doc.transform(
      draco({
        method: "edgebreaker",
        encodeSpeed: 10 - tier.dracoCompression,
        decodeSpeed: 10,
        quantizePosition: Math.round(30 - tier.dracoQuality * 1.5),
        quantizeNormal: Math.round(24 - tier.dracoQuality * 1.2),
        quantizeTexcoord: Math.round(18 - tier.dracoQuality),
        quantizeColor: 10,
      })
    );

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await io.write(outputPath, doc);
    const bytes = fs.statSync(outputPath).size;

    if (bytes > tier.maxBytes) {
      fs.unlinkSync(outputPath);
      return {
        bytes,
        ok: false,
        error: `exceeded cap of ${(tier.maxBytes / 1024).toFixed(0)} KB`,
      };
    }

    return { bytes, ok: true };
  } catch (err) {
    return { bytes: 0, ok: false, error: (err as Error).message };
  }
}

function productIdFromFilename(filename: string): string {
  const m = /^(\d{2})-/.exec(filename);
  if (!m) return filename.replace(".glb", "");
  const num = parseInt(m[1], 10);
  return `demo-${String(num).padStart(3, "0")}`;
}

function parseArgs(argv: string[]): { inputDir: string; outputDir: string; tiers: string[]; skipExisting: boolean } {
  const opts = {
    inputDir: "public/models/demo",
    outputDir: "public/models",
    tiers: ["low", "med", "high"] as string[],
    skipExisting: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) opts.inputDir = argv[i + 1];
    if (argv[i] === "--output" && argv[i + 1]) opts.outputDir = argv[i + 1];
    if (argv[i] === "--tiers" && argv[i + 1]) opts.tiers = argv[i + 1].split(",");
    if (argv[i] === "--skip-existing") opts.skipExisting = true;
  }
  return opts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const io = await createIO();

  if (!fs.existsSync(args.inputDir)) {
    console.error(`Input directory not found: ${args.inputDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(args.inputDir)
    .filter((f) => f.endsWith(".glb"))
    .sort();

  const realModels = files.filter((f) => fs.statSync(path.join(args.inputDir, f)).size > 5 * 1024);

  console.error(`Building ${realModels.length} real models × ${args.tiers.length} tiers from ${args.inputDir}\n`);

  const results: BuildResult[] = [];
  for (const f of realModels) {
    const productId = productIdFromFilename(f);
    const inputPath = path.join(args.inputDir, f);

    for (const tierName of args.tiers) {
      const tier = TIERS.find((t) => t.name === tierName);
      if (!tier) continue;

      const outputPath = path.join(args.outputDir, productId, `${tierName}.glb`);
      if (args.skipExisting && fs.existsSync(outputPath)) {
        const sz = fs.statSync(outputPath).size;
        results.push({ productId, tier: tierName, bytes: sz, ok: true });
        console.error(`  ${productId}/${tierName}.glb (cached) ${(sz / 1024).toFixed(0)} KB`);
        continue;
      }

      process.stderr.write(`  ${productId}/${tierName}.glb ... `);
      const r = await buildTier(io, inputPath, outputPath, tier);
      if (r.ok) {
        process.stderr.write(`${(r.bytes / 1024).toFixed(0)} KB\n`);
        results.push({ productId, tier: tierName, bytes: r.bytes, ok: true });
      } else {
        process.stderr.write(`FAIL (${r.error})\n`);
        results.push({ productId, tier: tierName, bytes: 0, ok: false, error: r.error });
      }
    }
  }

  const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
  const failed = results.filter((r) => !r.ok);
  const lowResults = results.filter((r) => r.tier === "low" && r.ok);

  console.error(`\n=== Summary ===`);
  console.error(`Total built: ${results.filter((r) => r.ok).length}/${results.length}`);
  console.error(`Total size:  ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  if (lowResults.length > 0) {
    console.error(`Low-tier avg: ${(lowResults.reduce((s, r) => s + r.bytes, 0) / lowResults.length / 1024).toFixed(0)} KB`);
  }
  if (failed.length > 0) {
    console.error(`\nFailures:`);
    for (const f of failed) {
      console.error(`  ${f.productId}/${f.tier}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

