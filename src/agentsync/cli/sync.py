"""Implementation of `agentsync sync`."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.table import Table

from agentsync.cli._exit import ExitCode
from agentsync.core.memory_set import MemorySetError, load_memory_set
from agentsync.core.paths import resolve_paths
from agentsync.core.sync import (
    Status,
    SyncError,
    apply_plan,
    plan_sync,
)
from agentsync.core.sync_cache import load_sync_cache, save_sync_cache

console = Console()


_STATUS_COLOR = {
    Status.UNCHANGED: "dim",
    Status.UPDATED: "yellow",
    Status.CREATED: "green",
    Status.WOULD_UPDATE: "yellow",
    Status.WOULD_CREATE: "green",
    Status.DRIFT: "red",
}


def _parse_adapter_csv(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    out: list[str] = []
    seen: set[str] = set()
    for piece in raw.split(","):
        p = piece.strip()
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _render_table(plan_targets) -> Table:
    table = Table(show_header=True, header_style="bold")
    table.add_column("adapter")
    table.add_column("file")
    table.add_column("status")
    return table


def sync_command(
    repo_root: Annotated[
        Path | None,
        typer.Option("--repo", help="Repo root (defaults to cwd).", file_okay=False),
    ] = None,
    adapter: Annotated[
        str | None,
        typer.Option(
            "--adapter",
            "-a",
            help="Comma-separated list of adapter names to limit the sync to.",
        ),
    ] = None,
    check: Annotated[
        bool,
        typer.Option(
            "--check",
            help="Don't write any files. Exit 2 if any file would change or has drifted.",
        ),
    ] = False,
    dry_run: Annotated[
        bool,
        typer.Option("--dry-run", "-n", help="Show what would change; don't write."),
    ] = False,
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="Overwrite manually edited files."),
    ] = False,
) -> None:
    paths = resolve_paths(repo_root)
    only = _parse_adapter_csv(adapter)

    try:
        memory_set = load_memory_set(paths)
    except MemorySetError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    cache = load_sync_cache(paths.agentsync_dir)
    is_preview = check or dry_run

    try:
        plan = plan_sync(paths, memory_set, cache, only=only, dry_run=is_preview)
    except SyncError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    if not plan.adapter_plans:
        console.print(
            "[yellow]warning:[/yellow] no adapters selected. "
            "Add `targets:` to your manifest or pass --adapter."
        )
        raise typer.Exit(ExitCode.OK)

    table = Table(show_header=True, header_style="bold")
    table.add_column("adapter")
    table.add_column("file")
    table.add_column("status")

    changed_any = False
    drifted_any = False
    for ap in plan.adapter_plans:
        for tgt in ap.targets:
            status = tgt.status
            color = _STATUS_COLOR.get(status, "white")
            table.add_row(
                ap.adapter.name,
                tgt.rel_path,
                f"[{color}]{status}[/{color}]",
            )
            if tgt.changed:
                changed_any = True
            if tgt.drifted:
                drifted_any = True

    console.print(table)

    if check:
        if drifted_any:
            console.print(
                "[red]drift detected[/red] — manually edited generated files. "
                "Run `agentsync pull` or `agentsync sync --force`."
            )
            raise typer.Exit(ExitCode.DRIFT)
        if changed_any:
            console.print("[yellow]changes pending[/yellow] — run `agentsync sync`.")
            raise typer.Exit(ExitCode.DRIFT)
        console.print("[green]ok[/green] every adapter output is up to date.")
        raise typer.Exit(ExitCode.OK)

    if dry_run:
        if changed_any:
            console.print("[yellow]dry run[/yellow] — no files written.")
        else:
            console.print("[green]ok[/green] nothing to update.")
        raise typer.Exit(ExitCode.OK)

    try:
        apply_plan(plan, force=force)
    except SyncError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.DRIFT) from None

    save_sync_cache(paths.agentsync_dir, plan.cache)

    if changed_any:
        console.print(f"[green]synced[/green] {sum(1 for t in plan.all_targets() if t.changed)} file(s)")
    else:
        console.print("[green]ok[/green] no changes needed.")
