from __future__ import annotations

import pytest
from pydantic import ValidationError

from agentsync.core.models import (
    Frontmatter,
    Manifest,
    ManifestFile,
    ManifestProject,
)


def test_frontmatter_defaults_apply():
    fm = Frontmatter(name="my-doc", description="A doc.")
    assert fm.priority == 50
    assert fm.applies_to == ["*"]
    assert fm.source == "authored"
    assert fm.tags == []


def test_frontmatter_rejects_bad_name():
    with pytest.raises(ValidationError):
        Frontmatter(name="Bad Name", description="x")


def test_frontmatter_rejects_unknown_applies_to():
    with pytest.raises(ValidationError):
        Frontmatter(name="doc", description="x", applies_to=["nonsense"])


def test_frontmatter_rejects_priority_out_of_range():
    with pytest.raises(ValidationError):
        Frontmatter(name="doc", description="x", priority=200)


def test_frontmatter_rejects_extra_fields():
    with pytest.raises(ValidationError):
        Frontmatter(name="doc", description="x", unknown_field=1)


def test_manifest_file_path_must_be_relative():
    with pytest.raises(ValidationError):
        ManifestFile(path="/etc/passwd")


def test_manifest_file_rejects_dotdot():
    with pytest.raises(ValidationError):
        ManifestFile(path="../escape.md")


def test_manifest_version_must_be_one():
    with pytest.raises(ValidationError):
        Manifest(version=2, project=ManifestProject(name="x"))


def test_manifest_minimum_valid():
    m = Manifest(version=1, project=ManifestProject(name="my-app"))
    assert m.targets == []
    assert m.files == []
