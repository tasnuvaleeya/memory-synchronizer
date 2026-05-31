import { createHash } from "node:crypto";

export interface ProvenanceFields {
  sourceSha: string;
  generator: string;
  generatedAt: string;
}

const HEADER_START = "<!-- agentctx:generated -->";
const PROVENANCE_BLOCK_RE =
  /^<!-- agentctx:generated -->\n(?:<!--[^>]*-->\n)*<!--\s*DO NOT EDIT[^>]*-->\n?/;

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function buildProvenanceHeader(fields: ProvenanceFields): string {
  return [
    "<!-- agentctx:generated -->",
    `<!-- source-sha: ${fields.sourceSha} -->`,
    `<!-- generator: ${fields.generator} -->`,
    `<!-- generated-at: ${fields.generatedAt} -->`,
    "<!-- DO NOT EDIT — run `agentctx sync` instead -->",
    "",
  ].join("\n");
}

export function injectProvenance(contents: string, fields: ProvenanceFields): string {
  return buildProvenanceHeader(fields) + contents;
}

/** Strip provenance header from file contents. Returns bare contents. */
export function stripProvenance(raw: string): string {
  if (!raw.startsWith(HEADER_START)) return raw;
  return raw.replace(PROVENANCE_BLOCK_RE, "");
}

/** Parse provenance fields from a generated file. Returns null if no header. */
export function parseProvenance(raw: string): ProvenanceFields | null {
  if (!raw.startsWith(HEADER_START)) return null;
  const sourceShaMatch = raw.match(/<!-- source-sha: ([a-f0-9]+) -->/);
  const generatorMatch = raw.match(/<!-- generator: ([^\s>]+) -->/);
  const generatedAtMatch = raw.match(/<!-- generated-at: ([^\s>]+) -->/);
  if (!sourceShaMatch || !generatorMatch || !generatedAtMatch) return null;
  return {
    sourceSha: sourceShaMatch[1]!,
    generator: generatorMatch[1]!,
    generatedAt: generatedAtMatch[1]!,
  };
}

/** SHA-256 of file contents after stripping the provenance header. */
export function contentChecksum(raw: string): string {
  return sha256(stripProvenance(raw));
}
