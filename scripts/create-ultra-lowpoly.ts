import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

async function createIO(): Promise<NodeIO> {
  await MeshoptSimplifier.ready;
  return new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
}

async function createUltraLowPoly(filePath: string, outputPath: string, io: NodeIO): Promise<boolean> {
  try {
    const doc = await io.read(filePath);

    // Ultra aggressive simplification: 5% of original triangles
    await doc.transform(
      weld({}),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: 0.05,
        error: 0.1,
      })
    );

    await io.write(outputPath, doc);
    const originalSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(outputPath).size;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(0);
    console.log(`  ${path.basename(filePath)}: ${(originalSize/1024).toFixed(0)}KB -> ${(newSize/1024).toFixed(0)}KB (-${reduction}%)`);
    return true;
  } catch (err) {
    console.error(`  Failed: ${path.basename(filePath)} — ${(err as Error).message}`);
    return false;
  }
}

async function main() {
  const inputDir = "public/models/demo";
  const outputDir = "public/models/ultra";

  if (!fs.existsSync(inputDir)) {
    console.error(`Input not found: ${inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log("=== Ultra Low-Poly Model Generation ===\n");

  const io = await createIO();
  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".glb"));

  let count = 0;
  for (const file of files) {
    const ok = await createUltraLowPoly(
      path.join(inputDir, file),
      path.join(outputDir, file),
      io
    );
    if (ok) count++;
  }

  console.log(`\n=== Done: ${count}/${files.length} ultra models ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
