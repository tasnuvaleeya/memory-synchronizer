"""Implementation of `agentsync show`."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from agentsync.cli._exit import ExitCode
from agentsync.core.frontmatter import FrontmatterError, parse_frontmatter_file
from agentsync.core.paths import resolve_paths

console = Console()


def _resolve_target(arg: Path, agent_dir: Path) -> Path | None:
    """Resolve the file argument relative to cwd or agent dir."""
    candidates = []
    if arg.is_absolute():
        candidates.append(arg)
    else:
        candidates.append(Path.cwd() / arg)
        candidates.append(agent_dir / arg)
        # Also accept "agent/foo.md" passed from repo root.
        candidates.append(agent_dir.parent / arg)
    for c in candidates:
        if c.is_file():
            return c.resolve()
    return None


def show_command(
    file: Annotated[Path, typer.Argument(help="Memory file to display (relative or absolute).")],
    repo_root: Annotated[
        Path | None,
        typer.Option("--repo", help="Repo root (defaults to cwd).", file_okay=False),
    ] = None,
    body_only: Annotated[
        bool,
        typer.Option("--body-only", help="Skip the metadata panel."),
    ] = False,
) -> None:
    paths = resolve_paths(repo_root)
    resolved = _resolve_target(file, paths.agent_dir)
    if resolved is None:
        console.print(f"[red]error:[/red] file not found: {file}")
        raise typer.Exit(ExitCode.USER_ERROR)

    try:
        doc = parse_frontmatter_file(resolved)
    except FrontmatterError as exc:
        console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(ExitCode.USER_ERROR) from None

    fm = doc.frontmatter

    if not body_only:
        meta = Table.grid(padding=(0, 2))
        meta.add_column(style="bold cyan")
        meta.add_column()
        meta.add_row("name", fm.name)
        meta.add_row("description", fm.description)
        meta.add_row("source", str(fm.source))
        meta.add_row("priority", str(fm.priority))
        meta.add_row("applies_to", ", ".join(fm.applies_to))
        if fm.tags:
            meta.add_row("tags", ", ".join(fm.tags))
        console.print(
            Panel(
                meta,
                title=f"[bold]{resolved.name}[/bold]",
                title_align="left",
                border_style="cyan",
            )
        )

    console.print(Markdown(doc.body.strip() or "_(empty)_"))
    raise typer.Exit(ExitCode.OK)
