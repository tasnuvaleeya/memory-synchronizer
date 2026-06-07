#!/usr/bin/env bash
# scripts/test-agentctx.sh — End-to-end smoke test for agentctx.
#
# Bootstraps a throwaway TypeScript project in a scratch directory, runs
# `agentctx init`, plants distinctive content in agent/, then verifies every
# major command: sync (idempotent + multi-tool propagation), diff, drift
# detection with --force overrides, lint (positive case), scan (Node+TS
# detection), stats, and the MCP server's resources/list response.
#
# The codex "does it actually read AGENTS.md?" check at the end is manual —
# the script prints clear instructions for how to verify that part by hand.
#
# Usage:
#   scripts/test-agentctx.sh                  # run with cleanup
#   scripts/test-agentctx.sh --keep           # leave scratch dir for poking
#   scripts/test-agentctx.sh --cwd /tmp/foo   # use a specific scratch dir
#   scripts/test-agentctx.sh --bin <path>     # explicit agentctx binary
#
# Binary resolution order (override via --bin or AGENTCTX_BIN):
#   1. --bin <path>
#   2. $AGENTCTX_BIN
#   3. `agentctx` on PATH
#   4. ./dist/cli/index.js relative to repo root (for in-repo dev)
#   5. `npx -y @agentctx/cli@latest` (network fallback)
#
# Exit codes:
#   0  all automated checks passed
#   1  at least one check failed (see stderr)
#   2  prerequisites missing

set -euo pipefail

# ─────────────────────────────── flag parsing ────────────────────────────────

KEEP=0
SCRATCH=""
EXPLICIT_BIN=""

usage() { sed -n '2,20p' "$0"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP=1; shift ;;
    --cwd)  SCRATCH="$2"; shift 2 ;;
    --bin)  EXPLICIT_BIN="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# ───────────────────────────── color helpers ─────────────────────────────────

if [[ -t 1 ]] && [[ "${NO_COLOR:-}" == "" ]]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[1m'; D=$'\033[2m'; N=$'\033[0m'
else
  R=""; G=""; Y=""; B=""; D=""; N=""
fi

PASS=0; FAIL=0
ok()   { echo "${G}✓${N} $1"; PASS=$((PASS+1)); }
bad()  { echo "${R}✗${N} $1" >&2; FAIL=$((FAIL+1)); }
note() { echo "${Y}…${N} $1"; }
step() { echo; echo "${B}── $1 ──${N}"; }

# ─────────────────────── agentctx binary resolution ──────────────────────────

resolve_ax() {
  local repo_root
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

  if [[ -n "$EXPLICIT_BIN" ]]; then
    AGENTCTX=("$EXPLICIT_BIN")
  elif [[ -n "${AGENTCTX_BIN:-}" ]]; then
    AGENTCTX=("$AGENTCTX_BIN")
  elif [[ -f "$repo_root/dist/cli/index.js" ]]; then
    # Prefer the in-repo dev build over a global install so this script
    # exercises uncommitted changes. Consumers outside the repo fall through.
    AGENTCTX=("node" "$repo_root/dist/cli/index.js")
  elif command -v agentctx >/dev/null 2>&1; then
    AGENTCTX=("agentctx")
  elif command -v npx >/dev/null 2>&1; then
    AGENTCTX=("npx" "-y" "@agentctx/cli@latest")
  else
    bad "No agentctx binary found. Install with: npm install -g @agentctx/cli"
    exit 2
  fi
  echo "${D}  agentctx via: ${AGENTCTX[*]}${N}"
}

ax() { "${AGENTCTX[@]}" "$@"; }

# ──────────────────────── portable sed -i wrapper ───────────────────────────

# GNU sed and BSD sed (macOS) differ on -i. Use a .bak suffix that both accept.
portable_sed() {
  local expr="$1" file="$2"
  sed -i.bak "$expr" "$file"
  rm -f "$file.bak"
}

# ───────────────────────────── cleanup trap ──────────────────────────────────

cleanup() {
  if [[ "$KEEP" == "1" ]]; then
    echo
    note "Keeping scratch dir: $SCRATCH"
  else
    [[ -n "$SCRATCH" && -d "$SCRATCH" ]] && rm -rf "$SCRATCH"
  fi
}
trap cleanup EXIT

# ──────────────────────────── prerequisites ──────────────────────────────────

step "Prerequisites"
command -v git  >/dev/null 2>&1 || { bad "git not on PATH";  exit 2; }
command -v node >/dev/null 2>&1 || { bad "node not on PATH"; exit 2; }
ok "git + node on PATH"
resolve_ax
ax version >/dev/null 2>&1 || { bad "agentctx didn't respond to 'version'"; exit 2; }
ok "agentctx responds: $(ax version)"

# ─────────────────────────── scratch directory ───────────────────────────────

if [[ -z "$SCRATCH" ]]; then
  SCRATCH="$(mktemp -d -t agentctx-smoke-XXXXXX)"
fi
echo "${D}  scratch dir: $SCRATCH${N}"

# ──────────────────────── 1. seed a tiny TS project ──────────────────────────

step "Seed a tiny TypeScript project"
cd "$SCRATCH"
git init -q
echo '{"name":"smoke","version":"0.0.1","type":"module"}' > package.json
mkdir -p src
cat > src/index.ts <<'EOF'
/** Greet someone by name. */
export const greet = (n: string): string => `Hello, ${n}!`;
EOF
ok "scratch repo seeded"

# ────────────────────────────── 2. init agent/ ───────────────────────────────

step "agentctx init"
ax init --yes >/dev/null
[[ -d "agent" ]]                || { bad "agent/ not created"; exit 1; }
[[ -f "agent/manifest.yaml" ]]  || { bad "agent/manifest.yaml missing"; exit 1; }
ok "agent/ scaffolded (manifest + starter files present)"

# ───────────────────────── 3. plant a fingerprint ────────────────────────────

step "Plant a distinctive rule (the 'Sparkle' fingerprint)"
cat > agent/coding-rules.md <<'EOF'
---
name: coding-rules
description: Coding conventions for the smoke test.
source: authored
priority: 20
applies_to: ["*"]
tags: [conventions]
---

# Coding rules

## TypeScript
- Exported functions need JSDoc comments.
- Test files end in `.test.ts`.

## Naming — fingerprint for testing AI tools
- All logger classes MUST be prefixed with `Sparkle` (e.g. `SparkleLogger`).
- Never use `Logger` alone as a class name in this repo.
EOF
ok "agent/coding-rules.md authored with fingerprint"

# ────────────────────── 4. sync, verify all outputs ──────────────────────────

step "sync — verify all 7 adapter outputs landed and contain the fingerprint"
ax sync >/dev/null
EXPECTED=(
  "CLAUDE.md"
  "AGENTS.md"
  ".cursorrules"
  ".cursor/rules/agentctx.mdc"
  ".clinerules"
  ".windsurfrules"
  ".github/copilot-instructions.md"
)
for f in "${EXPECTED[@]}"; do
  if [[ -f "$f" ]]; then
    if grep -q "Sparkle" "$f"; then
      ok "$f generated with fingerprint"
    else
      bad "$f generated but missing 'Sparkle'"
    fi
  else
    bad "$f was NOT generated"
  fi
done

# ─────────────── 5. idempotency: --check passes immediately ─────────────────

step "Idempotency: sync --check should be clean right after sync"
if ax sync --check >/dev/null 2>&1; then
  ok "sync --check exits 0 immediately after sync"
else
  bad "sync --check reported drift right after a clean sync"
fi

# ─────────────────── 6. multi-tool propagation (the wedge) ──────────────────

step "Multi-tool wedge: edit ONE rule, verify ALL outputs propagate"
portable_sed 's/Sparkle/Twinkle/g' agent/coding-rules.md
ax sync >/dev/null
HITS=0
LEAKED=0
for f in "${EXPECTED[@]}"; do
  grep -q "Twinkle" "$f" && HITS=$((HITS+1))
  grep -q "Sparkle" "$f" && { bad "$f still contains stale 'Sparkle'"; LEAKED=$((LEAKED+1)); }
done
if [[ "$HITS" == "${#EXPECTED[@]}" && "$LEAKED" == "0" ]]; then
  ok "all ${#EXPECTED[@]} adapter outputs updated to 'Twinkle' in one sync"
else
  bad "only $HITS/${#EXPECTED[@]} outputs propagated; $LEAKED kept stale value"
fi

# ───────────────────── 7. drift: refuses to overwrite ───────────────────────

step "Drift detection: hand-edit AGENTS.md, expect sync to refuse"
echo "## Hand-edited drift section" >> AGENTS.md
# sync exits with code 2 on drift (DriftError). Capture the output without
# letting `pipefail` mask grep's success behind sync's non-zero exit.
SYNC_OUT="$(ax sync 2>&1 || true)"
if echo "$SYNC_OUT" | grep -qi "manually edited"; then
  ok "sync refused to overwrite hand-edited AGENTS.md"
else
  bad "sync did NOT refuse the hand-edited AGENTS.md"
  echo "$SYNC_OUT" | head -5 | sed 's/^/    /'
fi

note "Verifying diff reports drifted status..."
DIFF_OUT="$(ax diff agents-md --json 2>&1 || true)"
if echo "$DIFF_OUT" | grep -q '"status": *"drifted"'; then
  ok "agentctx diff reports drifted status"
else
  bad "agentctx diff did NOT report drifted status"
  echo "$DIFF_OUT" | head -10 | sed 's/^/    /'
fi

note "Verifying --force overwrites..."
if ax sync --force >/dev/null 2>&1; then
  ok "sync --force succeeded after drift"
else
  bad "sync --force failed after drift"
fi

# ─────────────────────────────── 8. lint ────────────────────────────────────

step "Lint: plant a banned phrase, expect a finding"
echo "" >> agent/coding-rules.md
echo "TODO: write the deployment section" >> agent/coding-rules.md
LINT_OUT=$(ax lint --json 2>&1 || true)
if echo "$LINT_OUT" | grep -q '"banned-vague-phrases"'; then
  ok "lint flagged the planted TODO via banned-vague-phrases"
else
  bad "lint did NOT flag the planted TODO"
  echo "$LINT_OUT" | head -10 | sed 's/^/    /'
fi
portable_sed '/TODO: write the deployment section/d' agent/coding-rules.md

# ─────────────────────────────── 9. scan ────────────────────────────────────

step "Scan: should auto-detect TypeScript + Node from package.json + tsconfig"
echo '{"compilerOptions":{"target":"ES2022","module":"NodeNext"}}' > tsconfig.json
ax scan >/dev/null
[[ -f "agent/repo-map.json" ]] && ok "repo-map.json produced" || bad "repo-map.json missing"
if grep -q "TypeScript" agent/stack.md && grep -q "Node" agent/stack.md; then
  ok "stack.md detected TypeScript + Node.js"
else
  bad "stack.md missing expected detections"
  head -30 agent/stack.md | sed 's/^/    /'
fi

# ───────────────────────────── 10. stats ────────────────────────────────────

step "Stats: per-adapter token counts available"
NUM_ADAPTERS=$(
  ax stats --json | node -e "
let d='';
process.stdin.on('data',c=>d+=c)
              .on('end',()=>{const o=JSON.parse(d);console.log((o.adapters||[]).length)})"
)
if [[ "$NUM_ADAPTERS" =~ ^[0-9]+$ ]] && [[ "$NUM_ADAPTERS" -ge 6 ]]; then
  ok "stats reports $NUM_ADAPTERS adapters (≥6 expected)"
else
  bad "stats reports '$NUM_ADAPTERS' adapters; expected ≥6"
fi

# ───────────────────────────── 11. MCP server ───────────────────────────────

step "MCP server: list resources via JSON-RPC over stdio"
MCP_OUT=$(echo '{"jsonrpc":"2.0","id":1,"method":"resources/list"}' \
          | timeout 5 "${AGENTCTX[@]}" mcp 2>/dev/null || true)
if echo "$MCP_OUT" | grep -q '"agentctx://manifest"'; then
  ok "MCP server returned manifest resource"
else
  bad "MCP server did not return expected resources"
  echo "$MCP_OUT" | head -c 400 | sed 's/^/    /'
fi

# ──────────────────────────────── summary ───────────────────────────────────

step "Summary"
echo "  ${G}passed:${N} $PASS"
if [[ "$FAIL" -gt 0 ]]; then
  echo "  ${R}failed:${N} $FAIL"
  echo
  echo "${R}One or more automated checks failed.${N} See stderr above."
  exit 1
fi
echo "  failed: 0"

echo
echo "${G}${B}All automated checks passed.${N}"
echo
echo "${B}Manual codex / Claude Code / Cursor check (the real test):${N}"
echo "  1. ${D}cd $SCRATCH${N}  (re-run with ${B}--keep${N} if you don't see it)"
echo "  2. Launch your AI tool of choice (codex, claude, cursor)"
echo "  3. Prompt: ${D}\"I need to add a logger class to src/. What should I name it?\"${N}"
echo "  4. ${G}Pass${N}: the tool suggests a 'Twinkle'-prefixed name (it read the rules)"
echo "  5. ${R}Fail${N}: the tool suggests 'Logger' or 'MyLogger' (didn't read the rules)"

if [[ "$KEEP" != "1" ]]; then
  echo
  echo "${Y}Tip:${N} re-run with ${B}--keep${N} to keep the scratch dir for the manual check."
fi
