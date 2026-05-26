"""Parse and serialize YAML frontmatter blocks on memory markdown files."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml
from pydantic import ValidationError

from agentsync.core.models import Frontmatter

FRONTMATTER_DELIMITER = "---"


class FrontmatterError(Exception):
    """Raised when frontmatter is missing, malformed, or fails validation."""


@dataclass(frozen=True)
class FrontmatterDocument:
    frontmatter: Frontmatter
    body: str


def split_frontmatter(text: str) -> tuple[str | None, str]:
    """Split a markdown document into (raw_yaml, body).

    Returns (None, text) if the document has no frontmatter block.
    """
    if not text.startswith(FRONTMATTER_DELIMITER):
        return None, text

    lines = text.splitlines(keepends=True)
    if not lines or lines[0].rstrip("\r\n") != FRONTMATTER_DELIMITER:
        return None, text

    closing_index: int | None = None
    for idx in range(1, len(lines)):
        if lines[idx].rstrip("\r\n") == FRONTMATTER_DELIMITER:
            closing_index = idx
            break

    if closing_index is None:
        raise FrontmatterError(
            "frontmatter block opened with `---` but no closing `---` line was found"
        )

    raw_yaml = "".join(lines[1:closing_index])
    body = "".join(lines[closing_index + 1 :])
    return raw_yaml, body


def parse_frontmatter_text(text: str, *, path: Path | str | None = None) -> FrontmatterDocument:
    raw, body = split_frontmatter(text)
    if raw is None:
        loc = f" in {path}" if path else ""
        raise FrontmatterError(f"missing YAML frontmatter block{loc}")

    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError as exc:
        loc = f" in {path}" if path else ""
        raise FrontmatterError(f"invalid YAML in frontmatter{loc}: {exc}") from exc

    if not isinstance(data, dict):
        loc = f" in {path}" if path else ""
        raise FrontmatterError(f"frontmatter must be a mapping{loc}, got {type(data).__name__}")

    try:
        fm = Frontmatter.model_validate(data)
    except ValidationError as exc:
        loc = f" in {path}" if path else ""
        raise FrontmatterError(f"frontmatter validation failed{loc}: {exc}") from exc

    return FrontmatterDocument(frontmatter=fm, body=body)


def parse_frontmatter_file(path: Path) -> FrontmatterDocument:
    text = path.read_text(encoding="utf-8")
    return parse_frontmatter_text(text, path=path)


def serialize_frontmatter(frontmatter: Frontmatter, body: str) -> str:
    """Serialize a frontmatter object + body back into a markdown string."""
    data = frontmatter.model_dump(mode="json")
    yaml_text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True).rstrip()
    if not body.endswith("\n") and body:
        body = body + "\n"
    return f"{FRONTMATTER_DELIMITER}\n{yaml_text}\n{FRONTMATTER_DELIMITER}\n{body}"
