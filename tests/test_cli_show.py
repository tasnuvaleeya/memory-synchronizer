from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli.main import app


def test_show_renders_file(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(
        app, ["show", "coding-rules.md", "--repo", str(initialized_repo)]
    )
    assert result.exit_code == 0, result.output
    assert "coding-rules" in result.output


def test_show_body_only_skips_metadata_panel(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(
        app,
        ["show", "coding-rules.md", "--repo", str(initialized_repo), "--body-only"],
    )
    assert result.exit_code == 0, result.output
    # The metadata panel renders the description string; --body-only should suppress it.
    assert "Project-wide coding conventions" not in result.output


def test_show_missing_file(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(
        app, ["show", "no-such.md", "--repo", str(initialized_repo)]
    )
    assert result.exit_code != 0
    assert "not found" in result.output.lower()
