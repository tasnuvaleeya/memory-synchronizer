"""Gitignore-style filtering using `.agentsyncignore`."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pathspec

DEFAULT_IGNORE_PATTERNS: tuple[str, ...] = (
    ".git/",
    "node_modules/",
    "__pycache__/",
    ".venv/",
    "venv/",
    "dist/",
    "build/",
    ".agentsync/cache/",
)

IGNORE_FILENAME = ".agentsyncignore"


@dataclass
class IgnoreMatcher:
    """Wraps a `pathspec` matcher rooted at a repo directory."""

    root: Path
    spec: pathspec.PathSpec

    def matches(self, path: Path) -> bool:
        try:
            rel = path.resolve().relative_to(self.root.resolve())
        except ValueError:
            return False
        return self.spec.match_file(rel.as_posix())

    def is_ignored(self, path: Path) -> bool:  # convenience alias
        return self.matches(path)


def load_ignore_matcher(repo_root: Path) -> IgnoreMatcher:
    patterns: list[str] = list(DEFAULT_IGNORE_PATTERNS)
    ignore_file = repo_root / IGNORE_FILENAME
    if ignore_file.is_file():
        text = ignore_file.read_text(encoding="utf-8")
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            patterns.append(stripped)
    spec = pathspec.PathSpec.from_lines("gitignore", patterns)
    return IgnoreMatcher(root=repo_root, spec=spec)
