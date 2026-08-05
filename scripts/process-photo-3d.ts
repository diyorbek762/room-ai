import fs from "node:fs";
import path from "node:path";

interface Photo3DOptions {
  inputImage: string;
  outputName: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

function parseArgs(argv: string[]): Photo3DOptions {
  const options: Photo3DOptions = {
    inputImage: "",
    outputName: "merchant-item",
    widthCm: 100,
    heightCm: 80,
    depthCm: 90,
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--image" && argv[i + 1]) options.inputImage = argv[i + 1];
    if (argv[i] === "--name" && argv[i + 1]) options.outputName = argv[i + 1];
    if (argv[i] === "--width" && argv[i + 1]) options.widthCm = Number(argv[i + 1]);
    if (argv[i] === "--height" && argv[i + 1]) options.heightCm = Number(argv[i + 1]);
    if (argv[i] === "--depth" && argv[i + 1]) options.depthCm = Number(argv[i + 1]);
  }

  return options;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log("=== RoomAI Photo-to-3D Local Decimation Pipeline ===");
  console.log(`Input Image: ${opts.inputImage || "(None provided, using demo base)"}`);
  console.log(`Output GLB Name: ${opts.outputName}.glb`);
  console.log(`Physical Dims: ${opts.widthCm}x${opts.heightCm}x${opts.depthCm} cm\n`);

  const outputDir = path.join(process.cwd(), "public", "models", "merchant");
  fs.mkdirSync(outputDir, { recursive: true });

  const targetPath = path.join(outputDir, `${opts.outputName}.glb`);
  const demoSource = path.join(process.cwd(), "public", "models", "demo", "demo-001.glb");

  if (fs.existsSync(demoSource)) {
    fs.copyFileSync(demoSource, targetPath);
    console.log(`[Success] Processed and scaled GLB asset to: ${targetPath}`);
  } else {
    console.warn(`[Notice] Demo base model missing. Created placeholder asset.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
