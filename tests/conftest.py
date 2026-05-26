"""Shared pytest fixtures."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from agentsync.cli.main import app


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


@pytest.fixture
def cli_app():
    return app


@pytest.fixture
def initialized_repo(tmp_path: Path, runner: CliRunner) -> Path:
    """A tmp dir that has already been `agentsync init`-ed."""
    result = runner.invoke(app, ["init", "--repo", str(tmp_path)])
    assert result.exit_code == 0, result.output
    return tmp_path
