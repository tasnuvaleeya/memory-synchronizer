// Public surface for adapter authors and SDK consumers.

export {
  SourceType,
  FrontmatterSchema,
  type Frontmatter,
} from "./frontmatter.js";

export {
  MemoryFileSchema,
  MemorySetSchema,
  type MemoryFile,
  type MemorySet,
  type GeneratedFile,
  type RenderContext,
  type Adapter,
} from "./types.js";

export {
  buildProvenanceHeader,
  injectProvenance,
  stripProvenance,
  parseProvenance,
  contentChecksum,
  type ProvenanceFields,
} from "./provenance.js";

export { applyTokenBudget, computeSourceSha } from "./helpers.js";
