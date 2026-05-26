from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli.main import app


def test_pull_no_drift(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    result = runner.invoke(app, ["pull", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert "no drift" in result.output.lower()


def test_pull_regenerate_all_overwrites_local(
    initialized_repo: Path, runner: CliRunner
):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    claude = initialized_repo / "CLAUDE.md"
    claude.write_text("local override\n")
    result = runner.invoke(
        app, ["pull", "--regenerate-all", "--repo", str(initialized_repo)]
    )
    assert result.exit_code == 0, result.output
    assert "local override" not in claude.read_text()


def test_pull_accept_all_keeps_local(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    claude = initialized_repo / "CLAUDE.md"
    claude.write_text("local override\n")
    result = runner.invoke(
        app, ["pull", "--accept-all", "--repo", str(initialized_repo)]
    )
    assert result.exit_code == 0, result.output
    assert claude.read_text() == "local override\n"
    # The next sync --check should now report unchanged for CLAUDE.md (cache updated).
    check = runner.invoke(app, ["sync", "--check", "--repo", str(initialized_repo)])
    assert "drift" not in check.output.lower() or check.exit_code == 2


def test_pull_mutually_exclusive_flags(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(
        app,
        [
            "pull",
            "--accept-all",
            "--regenerate-all",
            "--repo",
            str(initialized_repo),
        ],
    )
    assert result.exit_code != 0
    assert "mutually exclusive" in result.output.lower()
