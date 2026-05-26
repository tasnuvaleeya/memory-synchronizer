"""Top-level `agentsync` CLI."""

from __future__ import annotations

import typer

from agentsync.cli.diff import diff_command
from agentsync.cli.init import init_command
from agentsync.cli.install_hook import install_hook_command
from agentsync.cli.pull import pull_command
from agentsync.cli.show import show_command
from agentsync.cli.sync import sync_command
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
app.command("sync", help="Render /agent into every configured adapter output.")(sync_command)
app.command("diff", help="Show what `agentsync sync` would change.")(diff_command)
app.command("pull", help="Reconcile manually edited generated files.")(pull_command)
app.command("install-hook", help="Install a git pre-commit hook running `sync --check`.")(
    install_hook_command
)
app.command("version", help="Print the installed agentsync version.")(version_command)


if __name__ == "__main__":  # pragma: no cover
    app()
