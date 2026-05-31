import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ConfigSchema } from "../src/core/config.js";
import { FrontmatterSchema, ManifestSchema } from "../src/core/manifest.js";
import { MemoryFileSchema } from "../src/core/memory.js";
import { RepoMapSchema, StackSchema } from "../src/scanners/types.js";
import { PolicySchema } from "../src/core/policy.js";

const OUT_DIR = path.resolve("docs/schema/v1");

interface Target {
  name: string;
  file: string;
  // The Zod schema type varies; use a structural minimum.
  schema: Parameters<typeof zodToJsonSchema>[0];
}

const targets: Target[] = [
  { name: "Manifest", file: "manifest.json", schema: ManifestSchema },
  { name: "Frontmatter", file: "frontmatter.json", schema: FrontmatterSchema },
  { name: "Config", file: "config.json", schema: ConfigSchema },
  { name: "MemoryFile", file: "memory-file.json", schema: MemoryFileSchema },
  { name: "RepoMap", file: "repo-map.json", schema: RepoMapSchema },
  { name: "Stack", file: "stack.json", schema: StackSchema },
  { name: "Policy", file: "policy.json", schema: PolicySchema },
];

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const t of targets) {
    const json = zodToJsonSchema(t.schema, { name: t.name, target: "jsonSchema7" });
    // Deterministic formatting: 2-space indent + LF.
    const body = JSON.stringify(json, null, 2) + "\n";
    const out = path.join(OUT_DIR, t.file);
    await writeFile(out, body, "utf8");
    process.stdout.write(`schema → ${path.relative(process.cwd(), out)}\n`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`schema export failed: ${message}\n`);
  process.exit(1);
});
