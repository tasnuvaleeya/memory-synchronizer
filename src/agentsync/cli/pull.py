"""Implementation of `agentsync pull`.

The full back-port (mapping local edits in a generated file back into
`/agent/*` source files) is deferred to a later milestone. For now `pull`
detects drift, prints each drifted file, and lets the user choose to:

  - **regenerate**  — discard local edits and re-write from `/agent`
  - **accept**      — accept the on-disk content as the new baseline (cache
                       update only; `/agent` is *not* modified). Future syncs
                       will refuse again if `/agent` next produces different
                       content, so this is a temporary truce.
  - **skip**        — leave the file alone.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

from agentsync.cli._exit import ExitCode
from agentsync.core.memory_set import MemorySetError, load_memory_set
from agentsync.core.paths import resolve_paths
from agentsync.core.sync import SyncError, plan_sync
from agentsync.core.sync_cache import load_sync_cache, save_sync_cache

console = Console()


_CHOICES = {"r": "regenerate", "a": "accept", "s": "skip"}


def pull_command(
    repo_root: Annotated[
        Path | None,
        typer.Option("--repo", help="Repo root (defaults to cwd).", file_okay=False),
    ] = None,
    accept_all: Annotated[
        bool,
        typer.Option(
            "--accept-all",
            help="Non-interactive: accept the on-disk version of every drifted file.",
        ),
    ] = False,
    regenerate_all: Annotated[
        bool,
        typer.Option(
            "--regenerate-all",
            help="Non-interactive: discard local edits on every drifted file.",
        ),
    ] = False,
) -> None:
    if accept_all and regenerate_all:
        console.print("[red]error:[/red] --accept-all and --regenerate-all are mutually exclusive")
        raise typer.Exit(ExitCode.USER_ERROR)

    paths = resolve_paths(repo_root)
    try:
        memory_set = load_memory_set(paths)
    except MemorySetError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    cache = load_sync_cache(paths.agentsync_dir)

    try:
        plan = plan_sync(paths, memory_set, cache, dry_run=True)
    except SyncError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    drifted = [t for t in plan.all_targets() if t.drifted]
    if not drifted:
        console.print("[green]ok[/green] no drift detected.")
        raise typer.Exit(ExitCode.OK)

    console.print(f"[yellow]{len(drifted)}[/yellow] drifted file(s):")
    for tgt in drifted:
        console.print(f"  • {tgt.rel_path}")

    changed = False
    for tgt in drifted:
        console.rule(f"[bold]{tgt.rel_path}[/bold]")
        if regenerate_all:
            action = "r"
        elif accept_all:
            action = "a"
        else:
            console.print(
                "[r]egenerate (discard local edits) · [a]ccept (keep local, update cache) · [s]kip"
            )
            try:
                choice = typer.prompt("action", default="s", show_default=True)
            except typer.Abort:
                console.print("[yellow]aborted[/yellow]")
                raise typer.Exit(ExitCode.USER_ERROR) from None
            action = choice.strip().lower()[:1] if choice else "s"

        if action not in _CHOICES:
            console.print(f"[dim]unknown choice {action!r}, skipping[/dim]")
            continue

        if action == "r":
            tgt.absolute_path.parent.mkdir(parents=True, exist_ok=True)
            tgt.absolute_path.write_text(tgt.rendered, encoding="utf-8")
            cache.record(tgt.rel_path, tgt.rendered)
            console.print(f"[green]regenerated[/green] {tgt.rel_path}")
            changed = True
        elif action == "a":
            cache.record(tgt.rel_path, tgt.on_disk or "")
            console.print(
                f"[yellow]accepted[/yellow] local edits on {tgt.rel_path} "
                "(cache updated; /agent unchanged)"
            )
            changed = True
        else:
            console.print(f"[dim]skipped[/dim] {tgt.rel_path}")

    if changed:
        save_sync_cache(paths.agentsync_dir, cache)
