from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli.main import app


def test_init_creates_agent_dir(tmp_path: Path, runner: CliRunner):
    result = runner.invoke(app, ["init", "--repo", str(tmp_path)])
    assert result.exit_code == 0, result.output
    assert (tmp_path / "agent" / "manifest.yaml").is_file()
    assert (tmp_path / "agent" / "architecture.md").is_file()
    assert (tmp_path / "agent" / "workflows" / "testing.md").is_file()
    assert (tmp_path / ".agentsync" / "config.yaml").is_file()
    # The .agentsyncignore template should land at repo root, not inside /agent.
    assert (tmp_path / ".agentsyncignore").is_file()
    assert not (tmp_path / "agent" / ".agentsyncignore").exists()


def test_init_refuses_when_agent_dir_not_empty(tmp_path: Path, runner: CliRunner):
    (tmp_path / "agent").mkdir()
    (tmp_path / "agent" / "preexisting.md").write_text("hi")
    result = runner.invoke(app, ["init", "--repo", str(tmp_path)])
    assert result.exit_code != 0
    assert "already exists" in result.output


def test_init_force_overwrites(tmp_path: Path, runner: CliRunner):
    (tmp_path / "agent").mkdir()
    (tmp_path / "agent" / "preexisting.md").write_text("hi")
    result = runner.invoke(app, ["init", "--repo", str(tmp_path), "--force"])
    assert result.exit_code == 0, result.output
    assert (tmp_path / "agent" / "architecture.md").is_file()


def test_init_targets_validated(tmp_path: Path, runner: CliRunner):
    result = runner.invoke(app, ["init", "--repo", str(tmp_path), "--targets", "nonsense"])
    assert result.exit_code != 0
    assert "unknown adapter target" in result.output.lower()


def test_init_custom_targets_written_to_config(tmp_path: Path, runner: CliRunner):
    result = runner.invoke(
        app, ["init", "--repo", str(tmp_path), "--targets", "claude,cline"]
    )
    assert result.exit_code == 0, result.output
    cfg = (tmp_path / ".agentsync" / "config.yaml").read_text()
    assert "claude" in cfg
    assert "cline" in cfg
    assert "cursor" not in cfg
