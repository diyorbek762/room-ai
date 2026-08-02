import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

const SUPPORTED_INPUTS = [".obj", ".gltf", ".glb", ".fbx"];

interface ConvertOptions {
  inputDir: string;
  outputDir: string;
}

function parseArgs(argv: string[]): ConvertOptions {
  const options: ConvertOptions = {
    inputDir: "assets/raw",
    outputDir: "public/models/demo",
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) options.inputDir = argv[i + 1];
    if (argv[i] === "--output" && argv[i + 1]) options.outputDir = argv[i + 1];
  }

  return options;
}

async function convertFile(filePath: string, outputDir: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_INPUTS.includes(ext)) return false;

  const baseName = path.basename(filePath, ext);
  const outputPath = path.join(outputDir, `${baseName}.glb`);

  if (fs.existsSync(outputPath)) {
    console.log(`  Skip (exists): ${baseName}.glb`);
    return false;
  }

  try {
    const doc = await io.read(filePath);
    await io.write(outputPath, doc);
    const size = fs.statSync(outputPath).size;
    console.log(`  Converted: ${baseName}.glb (${(size / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.error(`  Failed: ${baseName} — ${(err as Error).message}`);
    return false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.inputDir)) {
    console.error(`Input directory not found: ${options.inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  console.log(`=== GLB Converter ===`);
  console.log(`Input:  ${path.resolve(options.inputDir)}`);
  console.log(`Output: ${path.resolve(options.outputDir)}\n`);

  const files = fs.readdirSync(options.inputDir).filter((f) =>
    SUPPORTED_INPUTS.includes(path.extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.log("No convertible files found (supported: OBJ, GLTF, GLB, FBX).");
    console.log("Note: FBX conversion requires the gltf-transform CLI with FBX plugin.");
    return;
  }

  let converted = 0;
  for (const file of files) {
    const fullPath = path.join(options.inputDir, file);
    const ok = await convertFile(fullPath, options.outputDir);
    if (ok) converted++;
  }

  console.log(`\n=== Summary: ${converted}/${files.length} converted ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
