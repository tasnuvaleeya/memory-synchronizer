from __future__ import annotations

import subprocess
from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli.install_hook import HOOK_MARKER
from agentsync.cli.main import app


def _git_init(path: Path) -> None:
    subprocess.run(
        ["git", "init", "-q", "-b", "main"],
        cwd=path,
        check=True,
    )


def test_install_hook_writes_executable(tmp_path: Path, runner: CliRunner):
    _git_init(tmp_path)
    result = runner.invoke(app, ["install-hook", "--repo", str(tmp_path)])
    assert result.exit_code == 0, result.output
    hook = tmp_path / ".git" / "hooks" / "pre-commit"
    assert hook.is_file()
    assert HOOK_MARKER in hook.read_text()
    mode = hook.stat().st_mode
    assert mode & 0o111


def test_install_hook_refuses_non_git(tmp_path: Path, runner: CliRunner):
    result = runner.invoke(app, ["install-hook", "--repo", str(tmp_path)])
    assert result.exit_code != 0
    assert "not a git repository" in result.output.lower()


def test_install_hook_idempotent(tmp_path: Path, runner: CliRunner):
    _git_init(tmp_path)
    runner.invoke(app, ["install-hook", "--repo", str(tmp_path)])
    result = runner.invoke(app, ["install-hook", "--repo", str(tmp_path)])
    assert result.exit_code == 0, result.output
    assert "already installed" in result.output.lower()


def test_install_hook_refuses_to_overwrite_existing(tmp_path: Path, runner: CliRunner):
    _git_init(tmp_path)
    existing = tmp_path / ".git" / "hooks" / "pre-commit"
    existing.parent.mkdir(parents=True, exist_ok=True)
    existing.write_text("#!/bin/sh\necho other\n")
    result = runner.invoke(app, ["install-hook", "--repo", str(tmp_path)])
    assert result.exit_code != 0
    assert "already exists" in result.output.lower()


def test_install_hook_force_overwrites(tmp_path: Path, runner: CliRunner):
    _git_init(tmp_path)
    existing = tmp_path / ".git" / "hooks" / "pre-commit"
    existing.parent.mkdir(parents=True, exist_ok=True)
    existing.write_text("#!/bin/sh\necho other\n")
    result = runner.invoke(app, ["install-hook", "--force", "--repo", str(tmp_path)])
    assert result.exit_code == 0, result.output
    assert HOOK_MARKER in existing.read_text()
