import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
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

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ValidationOptions {
  inputDir: string;
  maxSizeBytes: number;
  strict: boolean;
}

function parseArgs(argv: string[]): ValidationOptions {
  const options: ValidationOptions = {
    inputDir: "public/models/demo",
    maxSizeBytes: MAX_FILE_SIZE,
    strict: true,
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) options.inputDir = argv[i + 1];
    if (argv[i] === "--max-size" && argv[i + 1])
      options.maxSizeBytes = Number(argv[i + 1]) * 1024 * 1024;
    if (argv[i] === "--no-strict") options.strict = false;
  }

  return options;
}

interface ValidationResult {
  file: string;
  issues: string[];
  warnings: string[];
}

async function validateFile(filePath: string, options: ValidationOptions, io: NodeIO): Promise<ValidationResult> {
  const result: ValidationResult = { file: path.basename(filePath), issues: [], warnings: [] };
  const size = fs.statSync(filePath).size;

  if (size > options.maxSizeBytes) {
    result.issues.push(
      `Size ${(size / 1048576).toFixed(2)} MB exceeds limit ${(options.maxSizeBytes / 1048576).toFixed(0)} MB`
    );
  }

  try {
    const doc = await io.read(filePath);
    const root = doc.getRoot();

    let meshCount = 0;
    let missingNormals = 0;

    for (const mesh of root.listMeshes()) {
      meshCount++;
      for (const primitive of mesh.listPrimitives()) {
        const semantics = primitive.listSemantics();
        if (!semantics.includes("NORMAL")) {
          missingNormals++;
        }
      }
    }

    if (meshCount === 0) {
      result.issues.push("No meshes found");
    } else if (missingNormals > 0) {
      result.issues.push(`${missingNormals} primitives missing normals`);
    }

    const extRequired = root.listExtensionsUsed();
    const usesDraco = extRequired.some(
      (e) => e.extensionName === "KHR_draco_mesh_compression"
    );
    if (!usesDraco && options.strict) {
      result.warnings.push("Not Draco-compressed (run assets:compress)");
    }

    const scenes = root.listScenes();
    if (scenes.length === 0) {
      result.issues.push("No scenes defined");
    }
  } catch (err) {
    result.issues.push(`Parse failed: ${(err as Error).message}`);
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.inputDir)) {
    console.error(`Input directory not found: ${options.inputDir}`);
    process.exit(1);
  }

  console.log(`=== Asset Validation ===`);
  console.log(`Input:      ${path.resolve(options.inputDir)}`);
  console.log(`Max size:   ${(options.maxSizeBytes / 1048576).toFixed(0)} MB`);
  console.log(`Strict:     ${options.strict ? "yes" : "no (warnings only)"}\n`);

  const files = fs
    .readdirSync(options.inputDir)
    .filter((f) => f.endsWith(".glb"));

  if (files.length === 0) {
    console.log("No GLB files found.");
    process.exit(1);
  }

  let failed = 0;
  let warned = 0;

  const io = await createIO();

  for (const file of files) {
    const result = await validateFile(path.join(options.inputDir, file), options, io);

    const status = result.issues.length === 0 ? "PASS" : "FAIL";
    if (result.issues.length > 0) failed++;
    if (result.warnings.length > 0) warned++;

    console.log(`[${status}] ${result.file}`);
    for (const issue of result.issues) console.log(`       ✗ ${issue}`);
    for (const warning of result.warnings) console.log(`       ⚠ ${warning}`);
  }

  console.log(`\n=== Summary: ${files.length - failed}/${files.length} passed, ${warned} with warnings ===`);

  if (failed > 0 && options.strict) {
    console.log("Validation FAILED — pipeline aborted.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
