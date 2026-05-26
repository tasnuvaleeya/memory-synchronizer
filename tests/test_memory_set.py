from __future__ import annotations

from pathlib import Path

from agentsync.core.memory_set import MemorySetError, load_memory_set
from agentsync.core.paths import resolve_paths


def test_load_memory_set_from_init(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    assert memory_set.project_name == "my-project"
    names = [e.name for e in memory_set.entries]
    assert "architecture" in names
    assert "coding-rules" in names


def test_entries_for_filters_by_applies_to(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    for_claude = memory_set.entries_for("claude")
    # Default starter manifest applies every file to "*" so all should be returned.
    assert len(for_claude) == len(memory_set.entries)
    # Priority ordering: architecture (10) before coding-rules (20).
    priorities = [e.priority for e in for_claude]
    assert priorities == sorted(priorities)


def test_load_memory_set_raises_on_missing_file(initialized_repo: Path):
    (initialized_repo / "agent" / "stack.md").unlink()
    paths = resolve_paths(initialized_repo)
    try:
        load_memory_set(paths)
    except MemorySetError as exc:
        assert "stack.md" in str(exc)
    else:
        raise AssertionError("expected MemorySetError")
