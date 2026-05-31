import { RepoMapSchema, type RepoMap } from "../scanners/types.js";
import { InternalError } from "../core/errors.js";

/**
 * Render `repo-map.json`. Pure function: same input → byte-identical output.
 *
 * - Schema-validated so callers can't accidentally emit malformed JSON.
 * - Two-space indent, trailing newline. Matches the project's writeFileLF
 *   convention and is friendly to git diffs.
 */
export function renderRepoMap(repoMap: RepoMap): string {
  const parsed = RepoMapSchema.safeParse(repoMap);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new InternalError(`renderRepoMap: invalid repo-map\n${issues}`);
  }
  return JSON.stringify(parsed.data, null, 2) + "\n";
}
