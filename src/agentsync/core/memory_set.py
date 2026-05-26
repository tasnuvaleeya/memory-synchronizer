"""Load and represent the canonical set of memory files declared in the manifest."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from agentsync.core.frontmatter import FrontmatterError, parse_frontmatter_file
from agentsync.core.manifest import ManifestError, load_manifest
from agentsync.core.models import (
    AdapterTarget,
    Frontmatter,
    Manifest,
    ManifestFile,
    Source,
)
from agentsync.core.paths import AgentPaths

WILDCARD_TARGET = "*"


class MemorySetError(Exception):
    """Raised when the memory set cannot be loaded coherently."""


@dataclass(frozen=True)
class MemoryEntry:
    """One memory file as referenced by the manifest + parsed from disk."""

    rel_path: str  # relative to /agent
    absolute_path: Path
    manifest_entry: ManifestFile
    frontmatter: Frontmatter | None  # only present for markdown files
    body: str  # full file content (for non-markdown) or frontmatter-stripped body

    @property
    def name(self) -> str:
        if self.frontmatter is not None:
            return self.frontmatter.name
        # Derive a kebab-case name from the relative path.
        stem = Path(self.rel_path).stem.lower()
        return stem.replace("_", "-")

    @property
    def description(self) -> str:
        return self.frontmatter.description if self.frontmatter else ""

    @property
    def priority(self) -> int:
        # Frontmatter wins; manifest entry is the fallback.
        if self.frontmatter is not None:
            return self.frontmatter.priority
        return self.manifest_entry.priority

    @property
    def applies_to(self) -> list[str]:
        # Frontmatter wins.
        if self.frontmatter is not None:
            return self.frontmatter.applies_to
        return self.manifest_entry.applies_to

    @property
    def tags(self) -> list[str]:
        if self.frontmatter is not None:
            return self.frontmatter.tags
        return self.manifest_entry.tags

    @property
    def source(self) -> str:
        return (
            self.frontmatter.source
            if self.frontmatter is not None
            else self.manifest_entry.source
        )

    def applies_to_adapter(self, adapter: AdapterTarget | str) -> bool:
        target = adapter.value if isinstance(adapter, AdapterTarget) else adapter
        if WILDCARD_TARGET in self.applies_to:
            return True
        return target in self.applies_to


@dataclass(frozen=True)
class MemorySet:
    """Manifest + parsed memory entries for an /agent directory."""

    manifest: Manifest
    entries: tuple[MemoryEntry, ...]
    agent_dir: Path

    @property
    def project_name(self) -> str:
        return self.manifest.project.name

    @property
    def project_description(self) -> str:
        return self.manifest.project.description or ""

    def entries_for(self, adapter: AdapterTarget | str) -> list[MemoryEntry]:
        """Return entries that apply to the given adapter, sorted by priority asc."""
        applicable = [e for e in self.entries if e.applies_to_adapter(adapter)]
        return sorted(applicable, key=lambda e: (e.priority, e.rel_path))


def load_memory_set(paths: AgentPaths) -> MemorySet:
    """Load and parse all manifest-declared memory files."""
    if not paths.agent_dir.is_dir():
        raise MemorySetError(f"/agent directory not found at {paths.agent_dir}")

    try:
        manifest = load_manifest(paths.manifest_file)
    except ManifestError as exc:
        raise MemorySetError(str(exc)) from exc

    entries: list[MemoryEntry] = []
    for mf in manifest.files:
        abs_path = paths.agent_dir / mf.path
        if not abs_path.is_file():
            raise MemorySetError(f"manifest references missing file {mf.path!r}")

        frontmatter: Frontmatter | None = None
        if mf.path.endswith(".md"):
            try:
                doc = parse_frontmatter_file(abs_path)
            except FrontmatterError as exc:
                raise MemorySetError(str(exc)) from exc
            frontmatter = doc.frontmatter
            body = doc.body
        else:
            body = abs_path.read_text(encoding="utf-8")

        entries.append(
            MemoryEntry(
                rel_path=mf.path,
                absolute_path=abs_path,
                manifest_entry=mf,
                frontmatter=frontmatter,
                body=body,
            )
        )

    return MemorySet(
        manifest=manifest,
        entries=tuple(entries),
        agent_dir=paths.agent_dir,
    )


__all__ = [
    "MemoryEntry",
    "MemorySet",
    "MemorySetError",
    "Source",
    "load_memory_set",
]
