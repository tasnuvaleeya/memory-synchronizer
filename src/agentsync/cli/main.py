"""Top-level `agentsync` CLI."""

from __future__ import annotations

import typer

from agentsync.cli.init import init_command
from agentsync.cli.show import show_command
from agentsync.cli.validate import validate_command
from agentsync.cli.version import version_command

app = typer.Typer(
    name="agentsync",
    help="Shared, repo-local memory layer that synchronizes context across AI coding tools.",
    no_args_is_help=True,
    add_completion=False,
)

app.command("init", help="Scaffold a fresh /agent directory in the current repo.")(init_command)
app.command("validate", help="Validate manifest.yaml, frontmatter, and links.")(validate_command)
app.command("show", help="Pretty-print a memory file with its metadata.")(show_command)
app.command("version", help="Print the installed agentsync version.")(version_command)


if __name__ == "__main__":  # pragma: no cover
    app()
