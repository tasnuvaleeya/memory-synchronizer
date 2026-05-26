from __future__ import annotations

import json

from typer.testing import CliRunner

from agentsync import __version__
from agentsync.cli.main import app


def test_version_text(runner: CliRunner):
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0, result.output
    assert __version__ in result.output


def test_version_json(runner: CliRunner):
    result = runner.invoke(app, ["version", "--json"])
    assert result.exit_code == 0, result.output
    payload = json.loads(result.output.strip())
    assert payload["version"] == __version__
    assert payload["schema_version"] == 1
