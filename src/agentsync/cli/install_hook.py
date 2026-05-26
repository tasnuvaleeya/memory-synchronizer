"""Install a git pre-commit hook that runs `agentsync sync --check`."""

from __future__ import annotations

import stat
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

from agentsync.cli._exit import ExitCode
from agentsync.core.paths import resolve_paths

console = Console()

HOOK_MARKER = "# agentsync:pre-commit"

HOOK_SCRIPT = f"""#!/usr/bin/env sh
{HOOK_MARKER}
# Block commits whose generated agent files have drifted from /agent.
# Edit /agent/* and run `agentsync sync`, or remove this hook to bypass.

if ! command -v agentsync >/dev/null 2>&1; then
    echo "agentsync not on PATH — skipping check"
    exit 0
fi

agentsync sync --check
"""


def install_hook_command(
    repo_root: Annotated[
        Path | None,
        typer.Option("--repo", help="Repo root (defaults to cwd).", file_okay=False),
    ] = None,
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="Overwrite an existing pre-commit hook."),
    ] = False,
) -> None:
    paths = resolve_paths(repo_root)
    git_dir = paths.repo_root / ".git"
    if not git_dir.is_dir():
        console.print(
            "[red]error:[/red] not a git repository. Run `git init` first or use "
            "[bold]pre-commit[/bold] (M4 ships an official hook)."
        )
        raise typer.Exit(ExitCode.USER_ERROR)

    hooks_dir = git_dir / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)
    hook_file = hooks_dir / "pre-commit"

    if hook_file.exists() and not force:
        existing = hook_file.read_text(encoding="utf-8", errors="replace")
        if HOOK_MARKER in existing:
            console.print(f"[yellow]ok[/yellow] hook already installed at {hook_file}")
            raise typer.Exit(ExitCode.OK)
        console.print(
            f"[red]error:[/red] {hook_file} already exists. Re-run with --force to overwrite."
        )
        raise typer.Exit(ExitCode.USER_ERROR)

    hook_file.write_text(HOOK_SCRIPT, encoding="utf-8")
    mode = hook_file.stat().st_mode
    hook_file.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    rel = hook_file.relative_to(paths.repo_root) if hook_file.is_relative_to(paths.repo_root) else hook_file
    console.print(f"[green]installed[/green] {rel}")
    console.print("  → runs [bold]agentsync sync --check[/bold] before every commit.")
