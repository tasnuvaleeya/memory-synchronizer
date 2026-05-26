"""Implementation of `agentsync version`."""

from __future__ import annotations

import json
from typing import Annotated

import typer
from rich.console import Console

from agentsync import SCHEMA_VERSION, __version__

console = Console()


def version_command(
    as_json: Annotated[
        bool, typer.Option("--json", help="Emit machine-readable JSON.")
    ] = False,
) -> None:
    payload = {"version": __version__, "schema_version": SCHEMA_VERSION}
    if as_json:
        typer.echo(json.dumps(payload))
        return
    console.print(f"agentsync [bold]{__version__}[/bold] (schema v{SCHEMA_VERSION})")
