"""Implementation of `agentsync validate`."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.table import Table

from agentsync.cli._exit import ExitCode
from agentsync.core.paths import resolve_paths
from agentsync.core.validation import validate_agent_dir

console = Console()


def validate_command(
    repo_root: Annotated[
        Path | None,
        typer.Option("--repo", help="Repo root (defaults to cwd).", file_okay=False),
    ] = None,
    strict: Annotated[
        bool,
        typer.Option("--strict", help="Treat warnings as errors."),
    ] = False,
) -> None:
    paths = resolve_paths(repo_root)
    report = validate_agent_dir(paths)

    if not report.issues:
        console.print("[green]ok[/green] no problems found")
        raise typer.Exit(ExitCode.OK)

    table = Table(show_header=True, header_style="bold")
    table.add_column("severity")
    table.add_column("file")
    table.add_column("message")
    for issue in report.issues:
        color = "red" if issue.severity == "error" else "yellow"
        file_str = (
            str(issue.path.relative_to(paths.repo_root))
            if issue.path and issue.path.is_relative_to(paths.repo_root)
            else (str(issue.path) if issue.path else "-")
        )
        table.add_row(f"[{color}]{issue.severity}[/{color}]", file_str, issue.message)
    console.print(table)

    summary = (
        f"[bold]{len(report.errors)}[/bold] error(s), "
        f"[bold]{len(report.warnings)}[/bold] warning(s)"
    )
    console.print(summary)

    if report.errors or (strict and report.warnings):
        raise typer.Exit(ExitCode.USER_ERROR)
    raise typer.Exit(ExitCode.OK)
