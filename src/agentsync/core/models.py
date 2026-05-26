"""Pydantic models for manifest, frontmatter, and shared enums."""

from __future__ import annotations

import re
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class AdapterTarget(str, Enum):
    CLAUDE = "claude"
    AGENTS_MD = "agents-md"
    CURSOR = "cursor"
    CLINE = "cline"
    WINDSURF = "windsurf"
    COPILOT = "copilot"


# Sentinel for "applies to every adapter".
WILDCARD_TARGET = "*"


class Source(str, Enum):
    AUTHORED = "authored"
    GENERATED = "generated"
    HYBRID = "hybrid"


def _validate_applies_to(values: list[str]) -> list[str]:
    valid = {WILDCARD_TARGET, *(t.value for t in AdapterTarget)}
    unknown = [v for v in values if v not in valid]
    if unknown:
        raise ValueError(f"unknown applies_to target(s): {unknown}")
    return values


class Frontmatter(BaseModel):
    """YAML frontmatter on a memory file."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True, use_enum_values=True)

    name: str = Field(..., min_length=1, max_length=64)
    description: str = Field(..., min_length=1, max_length=240)
    source: Source = Source.AUTHORED
    priority: int = Field(50, ge=0, le=100)
    applies_to: list[str] = Field(default_factory=lambda: [WILDCARD_TARGET])
    tags: list[str] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _check_name(cls, v: str) -> str:
        if not _NAME_PATTERN.match(v):
            raise ValueError(
                "name must be lowercase-kebab-case, start with [a-z0-9]; got " + repr(v)
            )
        return v

    @field_validator("applies_to")
    @classmethod
    def _check_applies_to(cls, v: list[str]) -> list[str]:
        return _validate_applies_to(v)


class ManifestProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1)
    description: str | None = None


class ManifestFile(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    path: str = Field(..., min_length=1)
    source: Source = Source.AUTHORED
    priority: int = Field(50, ge=0, le=100)
    applies_to: list[str] = Field(default_factory=lambda: [WILDCARD_TARGET])
    tags: list[str] = Field(default_factory=list)

    @field_validator("path")
    @classmethod
    def _check_path(cls, v: str) -> str:
        if v.startswith("/") or ".." in v.split("/"):
            raise ValueError(f"path must be relative inside /agent and contain no ..: {v!r}")
        return v

    @field_validator("applies_to")
    @classmethod
    def _check_applies_to(cls, v: list[str]) -> list[str]:
        return _validate_applies_to(v)


class ManifestGeneration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scanner: str | None = None
    exclude: list[str] = Field(default_factory=list)


class Manifest(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    version: int = Field(1, ge=1)
    project: ManifestProject
    targets: list[AdapterTarget] = Field(default_factory=list)
    files: list[ManifestFile] = Field(default_factory=list)
    generation: ManifestGeneration | None = None

    @field_validator("version")
    @classmethod
    def _check_version(cls, v: int) -> int:
        if v != 1:
            raise ValueError(f"only manifest version 1 is supported; got {v}")
        return v
