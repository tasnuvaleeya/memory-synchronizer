from __future__ import annotations

from pathlib import Path

from agentsync.adapters import get_adapter, list_adapter_names
from agentsync.adapters.base import RenderContext
from agentsync.core.memory_set import load_memory_set
from agentsync.core.paths import resolve_paths
from agentsync.core.provenance import parse_header


def _ctx(repo: Path) -> RenderContext:
    return RenderContext(repo_root=repo)


def test_discover_includes_all_builtins():
    names = set(list_adapter_names())
    assert names >= {"claude", "agents-md", "cursor", "cline", "windsurf", "copilot"}


def test_get_adapter_unknown_raises():
    import pytest

    from agentsync.adapters.registry import AdapterError

    with pytest.raises(AdapterError):
        get_adapter("nonsense")


def test_claude_emits_claude_md(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    adapter = get_adapter("claude")
    files = adapter.render(memory_set, _ctx(initialized_repo))
    assert len(files) == 1
    out = files[0]
    assert out.rel_path == "CLAUDE.md"
    assert parse_header(out.content) is not None
    assert "Agent Context" in out.content


def test_cursor_emits_legacy_plus_rules(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    adapter = get_adapter("cursor")
    files = adapter.render(memory_set, _ctx(initialized_repo))
    rel_paths = {f.rel_path for f in files}
    assert ".cursorrules" in rel_paths
    assert any(p.startswith(".cursor/rules/") for p in rel_paths)
    # No duplicate rule filenames.
    rules = [p for p in rel_paths if p.startswith(".cursor/rules/")]
    assert len(rules) == len(set(rules))


def test_agents_md_emits_root_file(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    adapter = get_adapter("agents-md")
    files = adapter.render(memory_set, _ctx(initialized_repo))
    assert [f.rel_path for f in files] == ["AGENTS.md"]


def test_copilot_emits_under_dot_github(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    adapter = get_adapter("copilot")
    files = adapter.render(memory_set, _ctx(initialized_repo))
    assert [f.rel_path for f in files] == [".github/copilot-instructions.md"]


def test_render_is_deterministic(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    adapter = get_adapter("claude")
    a = adapter.render(memory_set, _ctx(initialized_repo))[0].content
    b = adapter.render(memory_set, _ctx(initialized_repo))[0].content
    assert a == b


def test_budget_drops_low_priority_entries(initialized_repo: Path):
    paths = resolve_paths(initialized_repo)
    memory_set = load_memory_set(paths)
    adapter = get_adapter("windsurf")
    # Set a tight budget that surely drops something.
    adapter.char_budget = 200
    files = adapter.render(memory_set, _ctx(initialized_repo))
    content = files[0].content
    assert "Omitted by token budget" in content or "_Omitted by" in content


def test_overrides_via_entry_point(monkeypatch):
    """A registered plugin replaces a built-in with the same name."""
    from agentsync.adapters import registry
    from agentsync.adapters.base import Adapter, GeneratedFile

    class FakeAdapter(Adapter):
        name = "claude"

        def render(self, memory_set, ctx):
            return [GeneratedFile(rel_path="CLAUDE.md", content="fake\n")]

    class FakeEntryPoint:
        def __init__(self, name, cls):
            self.name = name
            self._cls = cls

        def load(self):
            return self._cls

    def fake_entry_points(group=None):
        return [FakeEntryPoint("claude", FakeAdapter)]

    monkeypatch.setattr(registry, "entry_points", fake_entry_points)
    adapters = registry.discover_adapters()
    assert isinstance(adapters["claude"], FakeAdapter)
