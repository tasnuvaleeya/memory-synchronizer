from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli.main import app


def test_diff_clean(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    result = runner.invoke(app, ["diff", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert "no differences" in result.output.lower()


def test_diff_shows_local_edits(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    (initialized_repo / "CLAUDE.md").write_text("local override\n")
    result = runner.invoke(app, ["diff", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert "CLAUDE.md" in result.output
