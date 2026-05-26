import yaml from "js-yaml";
import { globby } from "globby";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  agentDir,
  configPath,
  ignorePath,
  manifestPath,
  readFileUtf8,
  sha256,
  toPosix,
} from "./paths.js";
import { ManifestSchema, type Manifest } from "./manifest.js";
import { ConfigSchema, DEFAULT_CONFIG, type Config } from "./config.js";
import { parseFrontmatter } from "./frontmatter.js";
import { readIgnoreFile } from "./ignore.js";
import { UserError } from "./errors.js";
import { type MemoryFile, type MemorySet } from "./memory.js";

/** Load and validate `.agentsync/config.yaml`. Returns defaults if missing. */
export async function loadConfig(cwd: string): Promise<Config> {
  const file = configPath(cwd);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_CONFIG;
    throw err;
  }
  const loaded = yaml.load(raw, { filename: file }) ?? {};
  const parsed = ConfigSchema.safeParse(loaded);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new UserError(`${file}: invalid config\n${issues}`);
  }
  return parsed.data;
}

/** Load and validate `agent/manifest.yaml`. */
export async function loadManifest(cwd: string): Promise<Manifest> {
  const file = manifestPath(cwd);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new UserError(
        `No manifest found at ${toPosix(path.relative(cwd, file))}. Run \`agentsync init\` to scaffold one.`,
      );
    }
    throw err;
  }
  const loaded = yaml.load(raw, { filename: file });
  const parsed = ManifestSchema.safeParse(loaded);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new UserError(`${file}: invalid manifest\n${issues}`);
  }
  return parsed.data;
}

/**
 * Enumerate markdown files inside `agent/`, parse + validate each one's
 * frontmatter, and return the assembled MemorySet. Honors `.agentsyncignore`.
 *
 * On the first parse failure we throw — callers that want to collect all
 * issues should use `validate` command paths instead of this helper.
 */
export async function loadMemorySet(cwd: string): Promise<MemorySet> {
  const dir = agentDir(cwd);
  const ignore = await readIgnoreFile(ignorePath(cwd));

  const paths = await globby(["**/*.md"], {
    cwd: dir,
    dot: false,
    ignore,
  });
  paths.sort();

  const files: MemoryFile[] = [];
  for (const rel of paths) {
    const abs = path.join(dir, rel);
    const raw = await readFileUtf8(abs);
    const { frontmatter, body } = parseFrontmatter(toPosix(rel), raw);
    files.push({
      path: toPosix(rel),
      frontmatter,
      body,
      sha: sha256(raw),
    });
  }

  return {
    manifestVersion: 1,
    files,
  };
}
