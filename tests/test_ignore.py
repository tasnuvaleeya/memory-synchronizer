from __future__ import annotations

from pathlib import Path

from agentsync.core.ignore import load_ignore_matcher


def test_default_patterns_ignore_node_modules(tmp_path: Path):
    matcher = load_ignore_matcher(tmp_path)
    assert matcher.matches(tmp_path / "node_modules" / "x.js")
    assert matcher.matches(tmp_path / ".git" / "HEAD")
    assert not matcher.matches(tmp_path / "src" / "main.py")


def test_custom_ignore_file_is_picked_up(tmp_path: Path):
    (tmp_path / ".agentsyncignore").write_text("vendor/\n*.generated.ts\n")
    matcher = load_ignore_matcher(tmp_path)
    assert matcher.matches(tmp_path / "vendor" / "lib.go")
    assert matcher.matches(tmp_path / "out" / "build.generated.ts")
    assert not matcher.matches(tmp_path / "out" / "build.ts")


def test_path_outside_root_is_not_matched(tmp_path: Path):
    matcher = load_ignore_matcher(tmp_path)
    other = tmp_path.parent / "other-repo" / "node_modules" / "x.js"
    other.parent.mkdir(parents=True, exist_ok=True)
    other.write_text("")
    assert not matcher.matches(other)
