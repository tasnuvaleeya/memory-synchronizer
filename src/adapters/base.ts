// The canonical adapter types and pure helpers now live in
// @agentctx/adapter-sdk so third-party adapters can semver-pin against them.
// This file is kept as a thin re-export so existing internal imports
// continue to work without churn.
export {
  type Adapter,
  type GeneratedFile,
  type RenderContext,
  applyTokenBudget,
  computeSourceSha,
} from "@agentctx/adapter-sdk";
