import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3d";

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

interface DracoOptions {
  inputDir: string;
  outputDir: string;
  quality: number;
  compressionLevel: number;
}

function parseArgs(argv: string[]): DracoOptions {
  const options: DracoOptions = {
    inputDir: "public/models/demo",
    outputDir: "public/models/draco-compressed",
    quality: 7,
    compressionLevel: 7,
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) options.inputDir = argv[i + 1];
    if (argv[i] === "--output" && argv[i + 1]) options.outputDir = argv[i + 1];
    if (argv[i] === "--quality" && argv[i + 1]) options.quality = Number(argv[i + 1]);
    if (argv[i] === "--compression-level" && argv[i + 1])
      options.compressionLevel = Number(argv[i + 1]);
  }

  return options;
}

async function compressFile(filePath: string, outputDir: string, quality: number, compressionLevel: number, io: NodeIO): Promise<{ original: number; compressed: number } | null> {
  const baseName = path.basename(filePath, ".glb");
  const outputPath = path.join(outputDir, `${baseName}.glb`);

  try {
    const originalSize = fs.statSync(filePath).size;
    const doc = await io.read(filePath);

    await doc.transform(
      draco({
        method: "edgebreaker",
        encodeSpeed: 10 - compressionLevel,
        decodeSpeed: 10,
        quantizePosition: Math.round(30 - quality * 1.5),
        quantizeNormal: Math.round(24 - quality * 1.2),
        quantizeTexcoord: Math.round(18 - quality),
        quantizeColor: 10,
      })
    );

    await io.write(outputPath, doc);
    const compressedSize = fs.statSync(outputPath).size;

    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`  ${baseName}.glb: ${(originalSize / 1024).toFixed(1)} KB → ${(compressedSize / 1024).toFixed(1)} KB (-${ratio}%)`);

    return { original: originalSize, compressed: compressedSize };
  } catch (err) {
    console.error(`  Failed: ${baseName} — ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.inputDir)) {
    console.error(`Input directory not found: ${options.inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  console.log(`=== Draco Compression ===`);
  console.log(`Input:   ${path.resolve(options.inputDir)}`);
  console.log(`Output:  ${path.resolve(options.outputDir)}`);
  console.log(`Quality: ${options.quality}/10, Level: ${options.compressionLevel}/10\n`);

  const files = fs
    .readdirSync(options.inputDir)
    .filter((f) => f.endsWith(".glb"));

  if (files.length === 0) {
    console.log("No GLB files found.");
    return;
  }

  const io = await createIO();
  let totalOriginal = 0;
  let totalCompressed = 0;
  let count = 0;

  for (const file of files) {
    const fullPath = path.join(options.inputDir, file);
    const result = await compressFile(fullPath, options.outputDir, options.quality, options.compressionLevel, io);
    if (result) {
      totalOriginal += result.original;
      totalCompressed += result.compressed;
      count++;
    }
  }

  if (count > 0) {
    const overallRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
    console.log(`\n=== Summary: ${count} files, ${(totalOriginal / 1048576).toFixed(2)} MB → ${(totalCompressed / 1048576).toFixed(2)} MB (-${overallRatio}%) ===`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
