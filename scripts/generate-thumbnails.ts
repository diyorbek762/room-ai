import fs from "node:fs";
import path from "node:path";

const TARGET_W = 256;
const TARGET_H = 256;

interface ThumbnailOptions {
  inputDir: string;
  outputDir: string;
}

function parseArgs(argv: string[]): ThumbnailOptions {
  const options: ThumbnailOptions = {
    inputDir: "public/models/demo",
    outputDir: "public/thumbnails",
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) options.inputDir = argv[i + 1];
    if (argv[i] === "--output" && argv[i + 1]) options.outputDir = argv[i + 1];
  }

  return options;
}

function createSVGThumbnail(name: string, outPath: string): void {
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TARGET_W}" height="${TARGET_H}" viewBox="0 0 ${TARGET_W} ${TARGET_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 45%, 22%)"/>
      <stop offset="100%" stop-color="hsl(${hue}, 55%, 12%)"/>
    </linearGradient>
    <linearGradient id="srf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 50%, 55%)"/>
      <stop offset="100%" stop-color="hsl(${hue}, 60%, 35%)"/>
    </linearGradient>
  </defs>
  <rect width="${TARGET_W}" height="${TARGET_H}" fill="url(#bg)"/>
  <g transform="translate(${TARGET_W / 2}, ${TARGET_H / 2 + 20})">
    <ellipse cx="0" cy="50" rx="85" ry="20" fill="rgba(0,0,0,0.35)"/>
    <path d="M-70,-40 L-55,-60 L55,-60 L70,-40 L70,40 L-70,40 Z" fill="url(#srf)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <rect x="-45" y="-50" width="90" height="10" fill="rgba(255,255,255,0.2)"/>
  </g>
  <text x="12" y="${TARGET_H - 12}" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.45)">${name}</text>
</svg>`;

  fs.writeFileSync(outPath, svg);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.inputDir)) {
    console.error(`Input directory not found: ${options.inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  console.log(`=== Thumbnail Generation (SVG fallback renderer) ===`);
  console.log(`Input:  ${path.resolve(options.inputDir)}`);
  console.log(`Output: ${path.resolve(options.outputDir)}\n`);

  const files = fs
    .readdirSync(options.inputDir)
    .filter((f) => f.endsWith(".glb"));

  if (files.length === 0) {
    console.log("No GLB files found.");
    return;
  }

  let generated = 0;
  for (const file of files) {
    const baseName = path.basename(file, ".glb");
    const outPath = path.join(options.outputDir, `${baseName}.svg`);

    if (fs.existsSync(outPath)) {
      console.log(`  Skip (exists): ${baseName}.svg`);
      continue;
    }

    createSVGThumbnail(baseName, outPath);
    generated++;
  }

  console.log(`\n=== Summary: ${generated} thumbnails generated (${files.length} models) ===`);
  console.log(`\nNote: For PNG renders of real GLB geometry, run this in a browser context`);
  console.log(`or use three.js + headless-gl. SVG placeholders are used as fallbacks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
