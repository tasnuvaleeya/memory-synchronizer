"""Implementation of `agentsync diff`."""

from __future__ import annotations

import difflib
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.syntax import Syntax

from agentsync.cli._exit import ExitCode
from agentsync.core.memory_set import MemorySetError, load_memory_set
from agentsync.core.paths import resolve_paths
from agentsync.core.sync import Status, SyncError, plan_sync
from agentsync.core.sync_cache import load_sync_cache

console = Console()


def _parse_adapter_csv(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    return [p.strip() for p in raw.split(",") if p.strip()]


def diff_command(
    adapter: Annotated[
        str | None,
        typer.Argument(help="Optional adapter name; default = all configured adapters."),
    ] = None,
    repo_root: Annotated[
        Path | None,
        typer.Option("--repo", help="Repo root (defaults to cwd).", file_okay=False),
    ] = None,
) -> None:
    paths = resolve_paths(repo_root)
    only = _parse_adapter_csv(adapter)
    try:
        memory_set = load_memory_set(paths)
    except MemorySetError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    cache = load_sync_cache(paths.agentsync_dir)

    try:
        plan = plan_sync(paths, memory_set, cache, only=only, dry_run=True)
    except SyncError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    printed_any = False
    for ap in plan.adapter_plans:
        for tgt in ap.targets:
            if tgt.status == Status.UNCHANGED:
                continue
            printed_any = True
            console.rule(f"[bold]{ap.adapter.name}[/bold] · {tgt.rel_path} ({tgt.status})")
            current_lines = (tgt.on_disk or "").splitlines(keepends=True)
            rendered_lines = tgt.rendered.splitlines(keepends=True)
            diff = "".join(
                difflib.unified_diff(
                    current_lines,
                    rendered_lines,
                    fromfile=f"{tgt.rel_path} (on disk)",
                    tofile=f"{tgt.rel_path} (rendered)",
                    n=3,
                )
            )
            if not diff.strip():
                console.print("[dim](binary or whitespace-only change)[/dim]")
            else:
                console.print(Syntax(diff, "diff", theme="ansi_dark", word_wrap=False))

    if not printed_any:
        console.print("[green]ok[/green] no differences.")
        raise typer.Exit(ExitCode.OK)
    raise typer.Exit(ExitCode.OK)
