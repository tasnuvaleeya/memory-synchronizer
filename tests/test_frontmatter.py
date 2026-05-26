from __future__ import annotations

import pytest

from agentsync.core.frontmatter import (
    FrontmatterError,
    parse_frontmatter_text,
    serialize_frontmatter,
    split_frontmatter,
)
from agentsync.core.models import Frontmatter

VALID = """---
name: my-doc
description: A doc.
priority: 30
applies_to: ["claude"]
tags: [conventions]
---
# Body
hello
"""


def test_split_returns_none_when_no_frontmatter():
    raw, body = split_frontmatter("# hello\n")
    assert raw is None
    assert body == "# hello\n"


def test_split_extracts_yaml_block():
    raw, body = split_frontmatter(VALID)
    assert "name: my-doc" in raw
    assert body.startswith("# Body")


def test_unterminated_frontmatter_raises():
    text = "---\nname: x\nno closing\n"
    with pytest.raises(FrontmatterError):
        split_frontmatter(text)


def test_parse_valid_frontmatter():
    doc = parse_frontmatter_text(VALID)
    assert doc.frontmatter.name == "my-doc"
    assert doc.frontmatter.priority == 30
    assert doc.frontmatter.applies_to == ["claude"]
    assert "hello" in doc.body


def test_parse_rejects_missing_frontmatter():
    with pytest.raises(FrontmatterError):
        parse_frontmatter_text("# no frontmatter\n")


def test_parse_rejects_extra_fields():
    text = "---\nname: a\ndescription: b\nunknown: 1\n---\n"
    with pytest.raises(FrontmatterError):
        parse_frontmatter_text(text)


def test_serialize_round_trips():
    fm = Frontmatter(name="my-doc", description="hi", priority=10, applies_to=["claude"])
    out = serialize_frontmatter(fm, "# body\n")
    parsed = parse_frontmatter_text(out)
    assert parsed.frontmatter.name == "my-doc"
    assert parsed.frontmatter.priority == 10
    assert parsed.body.strip() == "# body"
