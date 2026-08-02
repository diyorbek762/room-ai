import { execSync } from "node:child_process";
import path from "node:path";

interface PipelineOptions {
  inputDir: string;
  outputDir: string;
  skipConvert: boolean;
  skipCompress: boolean;
  skipLod: boolean;
  skipThumbnails: boolean;
  skipValidate: boolean;
  parallel: boolean;
}

function parseArgs(argv: string[]): PipelineOptions {
  const options: PipelineOptions = {
    inputDir: "assets/raw",
    outputDir: "public/models/demo",
    skipConvert: false,
    skipCompress: false,
    skipLod: false,
    skipThumbnails: false,
    skipValidate: false,
    parallel: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) options.inputDir = argv[i + 1];
    if (arg === "--output" && argv[i + 1]) options.outputDir = argv[i + 1];
    if (arg === "--skip-convert") options.skipConvert = true;
    if (arg === "--skip-compress") options.skipCompress = true;
    if (arg === "--skip-lod") options.skipLod = true;
    if (arg === "--skip-thumbnails") options.skipThumbnails = true;
    if (arg === "--skip-validate") options.skipValidate = true;
    if (arg === "--parallel") options.parallel = true;
  }

  return options;
}

const STAGES = [
  { name: "convert", script: "convert-to-glb.ts", skip: "skipConvert", args: (o: PipelineOptions) => [`--input=${o.inputDir}`, `--output=${o.outputDir}`] },
  { name: "compress", script: "draco-compress.ts", skip: "skipCompress", args: (o: PipelineOptions) => [`--input=${o.outputDir}`, `--output=${o.outputDir.replace("demo", "draco-compressed")}`] },
  { name: "lod", script: "generate-lod.ts", skip: "skipLod", args: (o: PipelineOptions) => [`--input=${o.outputDir}`, `--output=${o.outputDir.replace("demo", "lod")}`] },
  { name: "thumbnails", script: "generate-thumbnails.ts", skip: "skipThumbnails", args: (o: PipelineOptions) => [`--input=${o.outputDir}`, `--output=public/thumbnails`] },
  { name: "validate", script: "validate-assets.ts", skip: "skipValidate", args: (o: PipelineOptions) => [`--input=${o.outputDir}`] },
] as const;

function runScript(script: string, args: string[]): void {
  const cmd = `npx tsx ${path.join("scripts", script)} ${args.join(" ")}`;
  console.log(`\n▶ Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  RoomAI Asset Pipeline Orchestrator`);
  console.log(`══════════════════════════════════════════\n`);
  console.log(`Input:  ${options.inputDir}`);
  console.log(`Output: ${options.outputDir}`);
  console.log(`Parallel: ${options.parallel ? "yes (stages run concurrently)" : "no (sequential)"}\n`);

  const start = Date.now();

  const activeStages = STAGES.filter((s) => !options[s.skip]);

  if (activeStages.length === 0) {
    console.log("All stages skipped. Nothing to do.");
    return;
  }

  if (options.parallel) {
    const procs = activeStages.map((s) => {
      return new Promise<void>((resolve, reject) => {
        const args = s.args(options);
        const cmd = `npx tsx ${path.join("scripts", s.script)} ${args.join(" ")}`;
        console.log(`\n▶ (parallel) ${cmd}`);
        try {
          execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
    await Promise.all(procs);
  } else {
    for (const stage of activeStages) {
      console.log(`\n─── Stage: ${stage.name} ───`);
      runScript(stage.script, stage.args(options));
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Pipeline complete in ${elapsed}s`);
  console.log(`══════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("\n❌ Pipeline failed:");
  console.error(err);
  process.exit(1);
});
