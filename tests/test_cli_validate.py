from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from agentsync.cli.main import app


def test_validate_clean_init_passes(initialized_repo: Path, runner: CliRunner):
    result = runner.invoke(app, ["validate", "--repo", str(initialized_repo)])
    assert result.exit_code == 0, result.output
    assert "ok" in result.output.lower() or "no problems" in result.output.lower()


def test_validate_reports_missing_agent_dir(tmp_path: Path, runner: CliRunner):
    result = runner.invoke(app, ["validate", "--repo", str(tmp_path)])
    assert result.exit_code != 0
    assert "not found" in result.output.lower()


def test_validate_reports_missing_manifest_file_reference(
    initialized_repo: Path, runner: CliRunner
):
    # Delete one of the referenced files.
    (initialized_repo / "agent" / "domain-knowledge.md").unlink()
    result = runner.invoke(app, ["validate", "--repo", str(initialized_repo)])
    assert result.exit_code != 0
    assert "domain-knowledge.md" in result.output


def test_validate_warns_about_undeclared_files(initialized_repo: Path, runner: CliRunner):
    (initialized_repo / "agent" / "stray.md").write_text(
        "---\nname: stray\ndescription: stray\n---\n"
    )
    result = runner.invoke(app, ["validate", "--repo", str(initialized_repo)])
    # Warnings alone shouldn't fail without --strict.
    assert result.exit_code == 0
    assert "stray.md" in result.output


def test_validate_strict_fails_on_warning(initialized_repo: Path, runner: CliRunner):
    (initialized_repo / "agent" / "stray.md").write_text(
        "---\nname: stray\ndescription: stray\n---\n"
    )
    result = runner.invoke(app, ["validate", "--repo", str(initialized_repo), "--strict"])
    assert result.exit_code != 0


def test_validate_catches_bad_frontmatter(initialized_repo: Path, runner: CliRunner):
    bad = initialized_repo / "agent" / "coding-rules.md"
    bad.write_text("no frontmatter at all\n")
    result = runner.invoke(app, ["validate", "--repo", str(initialized_repo)])
    assert result.exit_code != 0
    assert "frontmatter" in result.output.lower()
