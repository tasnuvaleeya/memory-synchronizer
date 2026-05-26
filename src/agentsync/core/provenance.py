"""Provenance header injected into every generated file.

The header is deterministic: it contains only the agentsync version, the
adapter that produced it, and a content hash of the canonical /agent source.
Re-running sync with no source changes therefore produces byte-identical output.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from agentsync import __version__

PROVENANCE_MAGIC = "agentsync:generated"

_MARKDOWN_HEADER_TEMPLATE = (
    "<!-- {magic} -->\n"
    "<!-- generator: {adapter}@{version} -->\n"
    "<!-- source-sha: {source_sha} -->\n"
    "<!-- DO NOT EDIT — run `agentsync sync` instead -->\n"
)

_HASH_HEADER_TEMPLATE = (
    "# {magic}\n"
    "# generator: {adapter}@{version}\n"
    "# source-sha: {source_sha}\n"
    "# DO NOT EDIT — run `agentsync sync` instead\n"
)

_MARKDOWN_RE = re.compile(
    r"<!-- agentsync:generated -->\s*\n"
    r"<!-- generator: ([^@]+)@([^\s]+) -->\s*\n"
    r"<!-- source-sha: ([0-9a-f]+) -->\s*\n"
    r"<!-- DO NOT EDIT[^\n]* -->\s*\n",
)

_HASH_RE = re.compile(
    r"# agentsync:generated\s*\n"
    r"# generator: ([^@]+)@([^\s]+)\s*\n"
    r"# source-sha: ([0-9a-f]+)\s*\n"
    r"# DO NOT EDIT[^\n]*\n",
)


class HeaderStyle:
    MARKDOWN = "markdown"
    HASH = "hash"


@dataclass(frozen=True)
class Provenance:
    adapter: str
    version: str
    source_sha: str
    style: str


def render_header(adapter: str, source_sha: str, *, style: str = HeaderStyle.MARKDOWN) -> str:
    template = _MARKDOWN_HEADER_TEMPLATE if style == HeaderStyle.MARKDOWN else _HASH_HEADER_TEMPLATE
    return template.format(
        magic=PROVENANCE_MAGIC,
        adapter=adapter,
        version=__version__,
        source_sha=source_sha,
    )


def parse_header(text: str) -> Provenance | None:
    """Return the provenance, or None if the file has no recognisable header."""
    md_match = _MARKDOWN_RE.match(text)
    if md_match is not None:
        return Provenance(
            adapter=md_match.group(1),
            version=md_match.group(2),
            source_sha=md_match.group(3),
            style=HeaderStyle.MARKDOWN,
        )
    hash_match = _HASH_RE.match(text)
    if hash_match is not None:
        return Provenance(
            adapter=hash_match.group(1),
            version=hash_match.group(2),
            source_sha=hash_match.group(3),
            style=HeaderStyle.HASH,
        )
    return None


def has_provenance(text: str) -> bool:
    return parse_header(text) is not None
