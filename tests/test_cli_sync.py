from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli._exit import ExitCode
from agentsync.cli.main import app


def test_sync_writes_outputs(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert (initialized_repo / "CLAUDE.md").is_file()
    assert (initialized_repo / "AGENTS.md").is_file()
    assert (initialized_repo / ".cursorrules").is_file()
    assert any((initialized_repo / ".cursor" / "rules").iterdir())


def test_sync_is_idempotent(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    before = (initialized_repo / "CLAUDE.md").read_bytes()
    result = runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    after = (initialized_repo / "CLAUDE.md").read_bytes()
    assert before == after


def test_sync_check_clean(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    result = runner.invoke(app, ["sync", "--check", "--repo", str(initialized_repo)])
    assert result.exit_code == ExitCode.OK, result.output


def test_sync_check_detects_pending_changes(initialized_repo: Path, runner: CliRunner):
    # No sync yet → every target is "would-create".
    result = runner.invoke(app, ["sync", "--check", "--repo", str(initialized_repo)])
    assert result.exit_code == ExitCode.DRIFT, result.output


def test_sync_check_detects_drift(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    (initialized_repo / "CLAUDE.md").write_text("manually edited\n")
    result = runner.invoke(app, ["sync", "--check", "--repo", str(initialized_repo)])
    assert result.exit_code == ExitCode.DRIFT
    assert "drift" in result.output.lower()


def test_sync_refuses_to_overwrite_drift(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    (initialized_repo / "CLAUDE.md").write_text("local edits\n")
    result = runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    assert result.exit_code != 0
    assert "refusing" in result.output.lower() or "manually edited" in result.output.lower()


def test_sync_force_overrides_drift(initialized_repo: Path, runner: CliRunner):
    runner.invoke(app, ["sync", "--repo", str(initialized_repo)])
    (initialized_repo / "CLAUDE.md").write_text("local edits\n")
    result = runner.invoke(app, ["sync", "--force", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert "manually edited" not in (initialized_repo / "CLAUDE.md").read_text()


def test_sync_dry_run_does_not_write(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(app, ["sync", "--dry-run", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert not (initialized_repo / "CLAUDE.md").exists()


def test_sync_filter_by_adapter(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(
        app,
        ["sync", "--adapter", "claude", "--repo", str(initialized_repo)],
    )
    assert result.exit_code == 0, result.output
    assert (initialized_repo / "CLAUDE.md").is_file()
    assert not (initialized_repo / "AGENTS.md").exists()


def test_sync_unknown_adapter(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(
        app, ["sync", "--adapter", "nope", "--repo", str(initialized_repo)]
    )
    assert result.exit_code != 0
    assert "unknown adapter" in result.output.lower()
