"""Bundled starter templates for `agentsync init`."""

from importlib.resources import files

TEMPLATES_ROOT = files("agentsync.templates")

__all__ = ["TEMPLATES_ROOT"]
