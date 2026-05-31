import yaml from "js-yaml";
import { FrontmatterSchema, type Frontmatter } from "./manifest.js";
import { UserError } from "./errors.js";
import { stripProvenance } from "@agentsync/adapter-sdk";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedMemory {
  frontmatter: Frontmatter;
  body: string;
}

/**
 * Strip a UTF-8 BOM if present. We only normalize the leading codepoint;
 * downstream code assumes the input is otherwise well-formed UTF-8.
 */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/**
 * Parse a memory markdown file's frontmatter block and body.
 *
 * Expected shape:
 *   ---
 *   <YAML>
 *   ---
 *   <markdown body>
 *
 * Throws `UserError` with a contextual message if the file lacks a
 * frontmatter block, the YAML fails to parse, or the parsed object fails
 * Zod validation.
 */
export function parseFrontmatter(filePath: string, raw: string): ParsedMemory {
  // Generated memory files (e.g. `stack.md`) carry a provenance HTML-comment
  // header above their YAML frontmatter. Strip it so the same parser works
  // for both authored and generated files.
  const source = stripProvenance(stripBom(raw));
  const match = FRONTMATTER_RE.exec(source);
  if (!match) {
    throw new UserError(
      `${filePath}: missing YAML frontmatter block (file must begin with '---').`,
    );
  }
  const yamlBlock = match[1] ?? "";
  const body = match[2] ?? "";

  let loaded: unknown;
  try {
    loaded = yaml.load(yamlBlock, { filename: filePath });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new UserError(`${filePath}: malformed YAML frontmatter — ${reason}`);
  }

  const result = FrontmatterSchema.safeParse(loaded ?? {});
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new UserError(`${filePath}: frontmatter validation failed\n${issues}`);
  }
  return { frontmatter: result.data, body };
}
