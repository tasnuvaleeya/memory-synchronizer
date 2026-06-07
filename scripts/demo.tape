# Render with: vhs scripts/demo.tape
# Produces: scripts/demo.gif (and scripts/demo.mp4 if uncommented below)
#
# Install VHS first:
#   macOS:   brew install vhs
#   Linux:   go install github.com/charmbracelet/vhs@latest
#            (or download from https://github.com/charmbracelet/vhs/releases)
#   Windows: scoop install vhs
#
# The tape runs in a fresh tmp dir, so it doesn't pollute the repo.

Output scripts/demo.gif
# Output scripts/demo.mp4    # uncomment to also produce an mp4

Set FontSize 16
Set Width 1180
Set Height 680
Set Theme "Catppuccin Mocha"
Set Padding 20
Set BorderRadius 10
Set Margin 18
Set MarginFill "#11111b"
Set TypingSpeed 35ms
Set Shell "bash"

# ── setup (hidden so the demo starts in a tidy scratch dir) ────────────────
Hide
Type "cd $(mktemp -d -t agentctx-demo-XXXX) && clear"
Enter
Sleep 200ms
Show

# ── intro ──────────────────────────────────────────────────────────────────
Type "# agentctx — one file, every AI coding agent"
Sleep 700ms
Enter
Sleep 400ms

# ── 1. init ────────────────────────────────────────────────────────────────
Type "agentctx init --yes"
Enter
Sleep 2200ms

# ── 2. edit one memory file (use sed for clean playback; vim looks messy) ──
Type "# add a fingerprint rule to coding-rules.md"
Sleep 600ms
Enter

Type "cat >> agent/coding-rules.md <<'EOF'"
Enter
Type "## Naming"
Enter
Type "- All logger classes MUST be prefixed with 'Sparkle'."
Enter
Type "EOF"
Enter
Sleep 1500ms

# ── 3. sync (the wedge) ────────────────────────────────────────────────────
Type "# one command → every AI tool's context file is generated"
Sleep 600ms
Enter

Type "agentctx sync"
Enter
Sleep 3000ms

Type "ls -1 CLAUDE.md AGENTS.md .cursorrules .clinerules .windsurfrules .github/copilot-instructions.md"
Enter
Sleep 2500ms

# ── 4. propagation — change the rule, every tool updates in one shot ──────
Type "# change the rule once..."
Sleep 500ms
Enter

Type "sed -i 's/Sparkle/Twinkle/g' agent/coding-rules.md && agentctx sync"
Enter
Sleep 2800ms

Type "grep -l Twinkle CLAUDE.md AGENTS.md .cursorrules .clinerules .windsurfrules .github/copilot-instructions.md"
Enter
Sleep 2200ms

# ── 5. scan — auto-detect the stack ───────────────────────────────────────
Type "# bonus: auto-detect the tech stack"
Sleep 500ms
Enter

Type "agentctx scan && head -25 agent/stack.md"
Enter
Sleep 3500ms

# ── outro ─────────────────────────────────────────────────────────────────
Type "# npm install -g @agentctx/cli  →  agentctx.dev"
Sleep 1800ms
Enter
Sleep 500ms
