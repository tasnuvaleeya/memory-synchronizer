#!/usr/bin/env bash
# scripts/demo-recording.sh — agentctx demo for asciinema / screen recording.
#
# Records cleanly with:
#   asciinema rec demo.cast --title "agentctx — one file, every AI agent"
#   bash scripts/demo-recording.sh
#   # then Ctrl+D when it finishes
#
# Convert the .cast to a GIF afterwards (optional):
#   agg --theme monokai --speed 1.5 demo.cast demo.gif
#
# Or upload the cast directly to asciinema.org for an embeddable player:
#   asciinema upload demo.cast

set -e

# Self-contained: operate in a fresh scratch dir so the recording isn't
# polluted by the current working tree.
SCRATCH="$(mktemp -d -t agentctx-demo-XXXX)"
cd "$SCRATCH"
git init -q
echo '{"name":"demo","version":"0.0.1","type":"module"}' > package.json
mkdir -p src
echo 'export const greet = (n) => `Hello, ${n}!`;' > src/index.ts

# ─────────────────────────── pacing knobs ────────────────────────────────────

PROMPT='$ '
TYPE_DELAY=0.025          # seconds per character (try 0.04 for slower, 0.015 faster)
PAUSE_AFTER_PROMPT=0.4
PAUSE_AFTER_RUN=1.5
COMMENT_PAUSE=0.8

# ─────────────────────────── helpers ─────────────────────────────────────────

# Print a command with a typewriter effect, then execute it.
pe() {
  printf '%s' "$PROMPT"
  local cmd="$1"
  for (( i=0; i<${#cmd}; i++ )); do
    printf '%s' "${cmd:$i:1}"
    sleep "$TYPE_DELAY"
  done
  sleep "$PAUSE_AFTER_PROMPT"
  printf '\n'
  eval "$cmd"
  sleep "$PAUSE_AFTER_RUN"
}

# Gray inline comment — no execution, just narration for the viewer.
note() {
  printf "\033[90m# %s\033[0m\n" "$1"
  sleep "$COMMENT_PAUSE"
}

# Resolve agentctx: prefer in-repo dev build for the maintainer; fall back to
# global install or npx. This means the demo always shows the latest code.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)" || repo_root=""
if [[ -n "$repo_root" && -f "$repo_root/dist/cli/index.js" ]]; then
  alias agentctx="node $repo_root/dist/cli/index.js"
  shopt -s expand_aliases
elif ! command -v agentctx >/dev/null 2>&1; then
  if command -v npx >/dev/null 2>&1; then
    alias agentctx="npx -y @agentctx/cli@latest"
    shopt -s expand_aliases
  else
    echo "agentctx not found. Install with: npm install -g @agentctx/cli" >&2
    exit 1
  fi
fi

# ─────────────────────────── the demo ────────────────────────────────────────

clear
note "agentctx — one file, every AI coding agent"
sleep 0.6

pe "agentctx init --yes"

note "edit one memory file..."

pe "cat >> agent/coding-rules.md <<'EOF'
## Naming
- All logger classes MUST be prefixed with Sparkle.
EOF"

note "one command → CLAUDE, Cursor, Cline, Windsurf, Copilot, Codex all updated"

pe "agentctx sync"

pe "ls CLAUDE.md AGENTS.md .cursorrules .clinerules .windsurfrules .github/copilot-instructions.md"

note "change the rule once..."

pe "sed -i 's/Sparkle/Twinkle/g' agent/coding-rules.md && agentctx sync"

note "every tool sees the new rule:"

pe "grep -l Twinkle CLAUDE.md AGENTS.md .cursorrules .clinerules .windsurfrules .github/copilot-instructions.md"

note "bonus: auto-detect the stack"

pe "agentctx scan && head -15 agent/stack.md"

sleep 0.5
printf "\n\033[1;32m✨  npm install -g @agentctx/cli\033[0m\n"
sleep 2.5

# Cleanup. Comment out if you want to poke around the scratch dir after.
cd / && rm -rf "$SCRATCH"
