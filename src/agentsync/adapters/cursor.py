"""Cursor adapter — emits .cursorrules (legacy) and .cursor/rules/*.mdc (modern)."""

from __future__ import annotations

import re
from pathlib import Path

from agentsync.adapters._jinja import render_template
from agentsync.adapters.base import Adapter, GeneratedFile, RenderContext
from agentsync.core.memory_set import MemoryEntry, MemorySet

_RULE_NAME_RE = re.compile(r"[^a-z0-9-]+")


def _rule_filename(entry: MemoryEntry) -> str:
    base = entry.name.lower()
    base = _RULE_NAME_RE.sub("-", base).strip("-") or "rule"
    return f"{base}.mdc"


class CursorAdapter(Adapter):
    name = "cursor"
    char_budget = 20_000

    def render(self, memory_set: MemorySet, ctx: RenderContext) -> list[GeneratedFile]:
        entries = self.applicable_entries(memory_set)
        kept, dropped = self.apply_budget(entries)

        # Legacy single-file rules.
        body = render_template(
            "cursorrules.j2",
            project_name=memory_set.project_name,
            project_description=memory_set.project_description,
            entries=kept,
            dropped=dropped,
        )
        source_sha = self.compute_source_sha(memory_set)
        output: list[GeneratedFile] = [
            GeneratedFile(rel_path=".cursorrules", content=self.attach_header(body, source_sha))
        ]

        # Modern per-rule files.
        seen_names: set[str] = set()
        for entry in kept:
            filename = _rule_filename(entry)
            # Disambiguate collisions deterministically.
            suffix = 1
            base = filename[:-4]
            while filename in seen_names:
                suffix += 1
                filename = f"{base}-{suffix}.mdc"
            seen_names.add(filename)

            rule_body = render_template("cursor_rule.mdc.j2", entry=entry)
            output.append(
                GeneratedFile(
                    rel_path=str(Path(".cursor") / "rules" / filename),
                    content=self.attach_header(rule_body, source_sha),
                )
            )

        return output
