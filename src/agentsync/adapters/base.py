"""Adapter abstract base class and supporting dataclasses."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

from agentsync.core.checksum import short_sha
from agentsync.core.memory_set import MemoryEntry, MemorySet
from agentsync.core.provenance import HeaderStyle, render_header


@dataclass(frozen=True)
class GeneratedFile:
    """A file produced by an adapter, written relative to the repo root."""

    rel_path: str  # relative to repo root
    content: str  # full file content (provenance header already injected)


@dataclass
class RenderContext:
    repo_root: Path
    options: dict[str, str] = field(default_factory=dict)


class Adapter(ABC):
    """Base class every adapter (built-in or plugin) extends."""

    #: Adapter identifier — must match an AdapterTarget value for built-ins.
    name: str = ""

    #: Soft cap on rendered chars. None = unbounded.
    char_budget: int | None = None

    #: Provenance comment style for files this adapter writes.
    header_style: str = HeaderStyle.MARKDOWN

    @abstractmethod
    def render(self, memory_set: MemorySet, ctx: RenderContext) -> list[GeneratedFile]:
        """Render the memory set into one or more output files."""

    # -- shared helpers -----------------------------------------------------

    def applicable_entries(self, memory_set: MemorySet) -> list[MemoryEntry]:
        return memory_set.entries_for(self.name)

    def compute_source_sha(self, memory_set: MemorySet) -> str:
        """Stable short hash over the entries that feed this adapter."""
        entries = self.applicable_entries(memory_set)
        parts: list[str] = [self.name, memory_set.project_name]
        for entry in entries:
            parts.append(f"{entry.rel_path}|{entry.priority}|{entry.body.strip()}")
        return short_sha("\n".join(parts))

    def apply_budget(self, entries: list[MemoryEntry]) -> tuple[list[MemoryEntry], list[MemoryEntry]]:
        """Split entries into (kept, dropped) according to the adapter budget.

        Entries are kept in their existing order (priority asc, then path).
        When the running char total would exceed `char_budget`, the remaining
        entries are dropped. The first entry is always kept, even if it alone
        exceeds the budget.
        """
        if self.char_budget is None:
            return entries, []

        kept: list[MemoryEntry] = []
        dropped: list[MemoryEntry] = []
        running = 0
        for entry in entries:
            piece = len(entry.body)
            if kept and running + piece > self.char_budget:
                dropped.append(entry)
            else:
                kept.append(entry)
                running += piece
        return kept, dropped

    def attach_header(self, body: str, source_sha: str) -> str:
        header = render_header(self.name, source_sha, style=self.header_style)
        if not body.endswith("\n"):
            body = body + "\n"
        return f"{header}\n{body}"
