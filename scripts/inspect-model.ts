import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { inspect } from "@gltf-transform/functions";

interface ModelReport {
  file: string;
  fileSizeKB: number;
  meshes: number;
  vertices: number;
  materials: number;
  textures: number;
  texturePixels: number;
  textureBytes: number;
  largestTexture: string;
  mimeType: string;
  warnings: string[];
}

async function inspectFile(filePath: string): Promise<ModelReport> {
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io.read(filePath);
  const report = inspect(doc);

  let textureBytes = 0;
  let texturePixels = 0;
  let largest = "";
  let largestPixels = 0;
  let mimeType = "";

  for (const t of report.textures.properties) {
    textureBytes += t.size;
    const match = /(\d+)\s*x\s*(\d+)/.exec(t.resolution);
    if (match) {
      const px = parseInt(match[1], 10) * parseInt(match[2], 10);
      texturePixels += px;
      if (px > largestPixels) {
        largestPixels = px;
        largest = t.resolution;
        mimeType = t.mimeType;
      }
    }
  }

  let totalVertices = 0;
  for (const m of report.meshes.properties) {
    totalVertices += m.vertices;
  }

  const fileSizeKB = Math.round(fs.statSync(filePath).size / 1024);

  return {
    file: path.basename(filePath),
    fileSizeKB,
    meshes: report.meshes.properties.length,
    vertices: totalVertices,
    materials: report.materials.properties.length,
    textures: report.textures.properties.length,
    texturePixels,
    textureBytes,
    largestTexture: largest || "(none)",
    mimeType: mimeType || "(none)",
    warnings: report.textures.warnings ?? [],
  };
}

function toMarkdown(reports: ModelReport[]): string {
  const lines: string[] = [];
  lines.push("# Model Inspection Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Per-file breakdown");
  lines.push("");
  lines.push(
    "| File | Size (KB) | Meshes | Verts | Mats | Tex | Largest Tex | Mime |"
  );
  lines.push(
    "|------|----------:|-------:|------:|-----:|----:|-------------|------|"
  );

  for (const r of reports) {
    lines.push(
      `| ${r.file} | ${r.fileSizeKB} | ${r.meshes} | ${r.vertices.toLocaleString()} | ${r.materials} | ${r.textures} | ${r.largestTexture} | ${r.mimeType} |`
    );
  }

  const totalKB = reports.reduce((s, r) => s + r.fileSizeKB, 0);
  const totalTexKB = Math.round(
    reports.reduce((s, r) => s + r.textureBytes, 0) / 1024
  );
  const realModels = reports.filter((r) => r.fileSizeKB > 5);
  const placeholders = reports.filter((r) => r.fileSizeKB <= 5);

  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- **Total files**: ${reports.length}`);
  lines.push(`- **Total size**: ${(totalKB / 1024).toFixed(2)} MB`);
  lines.push(`- **Total texture bytes**: ${totalTexKB} KB`);
  lines.push(
    `- **Real models** (> 5 KB): ${realModels.length} → ${(realModels.reduce((s, r) => s + r.fileSizeKB, 0) / 1024).toFixed(2)} MB`
  );
  lines.push(
    `- **Placeholders** (<= 5 KB): ${placeholders.length} → ${(placeholders.reduce((s, r) => s + r.fileSizeKB, 0) / 1024).toFixed(2)} MB`
  );

  lines.push("");
  lines.push("## Texture hotspots (the bundle killers)");
  lines.push("");
  lines.push(
    "These are the files where texture bytes dominate. Optimize these first."
  );
  lines.push("");
  const sorted = [...reports].sort((a, b) => b.textureBytes - a.textureBytes);
  for (const r of sorted.slice(0, 5)) {
    const pct = r.fileSizeKB > 0 ? Math.round((r.textureBytes / 1024 / r.fileSizeKB) * 100) : 0;
    lines.push(
      `- **${r.file}**: ${Math.round(r.textureBytes / 1024)} KB of textures (${pct}% of file), largest ${r.largestTexture}`
    );
  }

  if (reports.some((r) => r.warnings.length > 0)) {
    lines.push("");
    lines.push("## Inspector warnings");
    lines.push("");
    for (const r of reports) {
      for (const w of r.warnings) {
        lines.push(`- ${r.file}: ${w}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

async function main() {
  const args = process.argv.slice(2);
  const inputDir = args.includes("--input")
    ? args[args.indexOf("--input") + 1]
    : "public/models/demo";
  const outputFile = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : "reports/model-inspection.md";

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.endsWith(".glb"))
    .sort();

  if (files.length === 0) {
    console.log("No GLB files found.");
    return;
  }

  console.error(`Inspecting ${files.length} models in ${inputDir}...\n`);

  const reports: ModelReport[] = [];
  for (const f of files) {
    try {
      const r = await inspectFile(path.join(inputDir, f));
      reports.push(r);
      console.error(
        `  ${r.file.padEnd(28)} ${String(r.fileSizeKB).padStart(7)} KB · ${r.meshes} meshes · ${r.vertices.toString().padStart(7)} verts · ${r.textures} tex (largest ${r.largestTexture})`
      );
    } catch (err) {
      console.error(`  FAILED ${f}: ${(err as Error).message}`);
    }
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, toMarkdown(reports), "utf8");
  console.error(`\nWrote ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
