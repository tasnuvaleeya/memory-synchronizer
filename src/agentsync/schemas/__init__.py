"""Bundled JSON Schemas."""

from importlib.resources import files

SCHEMAS_ROOT = files("agentsync.schemas")


def load_schema(version: int, name: str) -> dict:
    import json

    path = SCHEMAS_ROOT.joinpath(f"v{version}", f"{name}.json")
    return json.loads(path.read_text(encoding="utf-8"))


__all__ = ["SCHEMAS_ROOT", "load_schema"]
