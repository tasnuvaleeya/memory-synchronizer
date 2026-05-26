from __future__ import annotations

from agentsync.core.provenance import (
    HeaderStyle,
    parse_header,
    render_header,
)


def test_markdown_header_round_trips():
    text = render_header("claude", "abc123def456")
    prov = parse_header(text)
    assert prov is not None
    assert prov.adapter == "claude"
    assert prov.source_sha == "abc123def456"
    assert prov.style == HeaderStyle.MARKDOWN


def test_hash_style_header():
    text = render_header("cline", "deadbeefcafe", style=HeaderStyle.HASH)
    prov = parse_header(text)
    assert prov is not None
    assert prov.adapter == "cline"
    assert prov.style == HeaderStyle.HASH


def test_no_header():
    assert parse_header("# just a doc\n") is None
