"""Load and validate the `/agent/manifest.yaml` file."""

from __future__ import annotations

from pathlib import Path

import jsonschema
import yaml
from pydantic import ValidationError

from agentsync.core.models import Manifest
from agentsync.schemas import load_schema

_MANIFEST_SCHEMA = load_schema(1, "manifest")


class ManifestError(Exception):
    """Raised when the manifest cannot be parsed or validated."""


def load_manifest(path: Path) -> Manifest:
    if not path.is_file():
        raise ManifestError(f"manifest not found: {path}")

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ManifestError(f"invalid YAML in {path}: {exc}") from exc

    if not isinstance(raw, dict):
        raise ManifestError(f"manifest must be a mapping, got {type(raw).__name__}")

    try:
        jsonschema.validate(raw, _MANIFEST_SCHEMA)
    except jsonschema.ValidationError as exc:
        raise ManifestError(
            f"manifest schema validation failed at {'/'.join(map(str, exc.absolute_path)) or '<root>'}: {exc.message}"
        ) from exc

    try:
        return Manifest.model_validate(raw)
    except ValidationError as exc:
        raise ManifestError(f"manifest model validation failed: {exc}") from exc
