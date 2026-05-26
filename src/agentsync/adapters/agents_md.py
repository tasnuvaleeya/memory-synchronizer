"""AGENTS.md adapter (Codex/OpenAI convention)."""

from __future__ import annotations

from agentsync.adapters._jinja import render_template
from agentsync.adapters.base import Adapter, GeneratedFile, RenderContext
from agentsync.core.memory_set import MemorySet


class AgentsMdAdapter(Adapter):
    name = "agents-md"
    char_budget = None  # AGENTS.md has no widely accepted hard limit

    def render(self, memory_set: MemorySet, ctx: RenderContext) -> list[GeneratedFile]:
        entries = self.applicable_entries(memory_set)
        kept, dropped = self.apply_budget(entries)
        body = render_template(
            "agents_md.md.j2",
            project_name=memory_set.project_name,
            project_description=memory_set.project_description,
            entries=kept,
            dropped=dropped,
        )
        source_sha = self.compute_source_sha(memory_set)
        content = self.attach_header(body, source_sha)
        return [GeneratedFile(rel_path="AGENTS.md", content=content)]
