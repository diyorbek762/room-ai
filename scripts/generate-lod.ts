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

const LOD_TIERS = [
  { suffix: "high", ratio: 1.0, error: 0 },
  { suffix: "medium", ratio: 0.5, error: 0.01 },
  { suffix: "low", ratio: 0.25, error: 0.02 },
] as const;

interface LODOptions {
  inputDir: string;
  outputDir: string;
}

function parseArgs(argv: string[]): LODOptions {
  const options: LODOptions = {
    inputDir: "public/models/demo",
    outputDir: "public/models/lod",
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) options.inputDir = argv[i + 1];
    if (argv[i] === "--output" && argv[i + 1]) options.outputDir = argv[i + 1];
  }

  return options;
}

async function generateLODs(filePath: string, outputDir: string, io: NodeIO): Promise<void> {
  const baseName = path.basename(filePath, ".glb");

  for (const tier of LOD_TIERS) {
    const outputPath = path.join(outputDir, `${baseName}-${tier.suffix}.glb`);

    try {
      const doc = await io.read(filePath);

      if (tier.ratio < 1.0) {
        await doc.transform(
          weld(),
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: tier.ratio,
            error: tier.error,
          })
        );
      }

      await io.write(outputPath, doc);
      const size = fs.statSync(outputPath).size;
      console.log(`  ${baseName}-${tier.suffix}.glb (${(size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  Failed ${baseName}-${tier.suffix}: ${(err as Error).message}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.inputDir)) {
    console.error(`Input directory not found: ${options.inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  console.log(`=== LOD Generation ===`);
  console.log(`Input:  ${path.resolve(options.inputDir)}`);
  console.log(`Output: ${path.resolve(options.outputDir)}\n`);

  const files = fs
    .readdirSync(options.inputDir)
    .filter((f) => f.endsWith(".glb"));

  if (files.length === 0) {
    console.log("No GLB files found.");
    return;
  }

  const io = await createIO();

  for (const file of files) {
    await generateLODs(path.join(options.inputDir, file), options.outputDir, io);
  }

  console.log(`\n=== Summary: LODs generated for ${files.length} models ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
