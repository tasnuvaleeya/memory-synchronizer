// Provenance helpers are now canonical in @agentsync/adapter-sdk; this
// module is a thin re-export so existing internal imports keep working.
export {
  type ProvenanceFields,
  buildProvenanceHeader,
  injectProvenance,
  stripProvenance,
  parseProvenance,
  contentChecksum,
} from "@agentsync/adapter-sdk";
