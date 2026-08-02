#!/usr/bin/env node
// Sharp texture conversion — runs in a clean subprocess.
// Args: <input> <output> <maxSize> <quality>
import fs from "node:fs";
import sharp from "sharp";

const [, , input, output, maxSizeStr, qualityStr] = process.argv;
if (!input || !output) {
  console.error("usage: _sharp-convert.mjs <input> <output> [maxSize] [quality]");
  process.exit(2);
}
const maxSize = parseInt(maxSizeStr || "1024", 10);
const quality = parseInt(qualityStr || "80", 10);

try {
  const buf = await sharp(input)
    .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .webp({ quality })
    .toBuffer();
  fs.writeFileSync(output, buf);
  process.exit(0);
} catch (err) {
  process.stderr.write(`sharp convert failed: ${err.message}\n`);
  process.exit(1);
}
