"""Discover built-in and third-party adapters via importlib entry points."""

from __future__ import annotations

from collections.abc import Callable
from importlib.metadata import entry_points

from agentsync.adapters.base import Adapter

ENTRY_POINT_GROUP = "agentsync.adapters"


class AdapterError(Exception):
    """Raised when adapter discovery or instantiation fails."""


def _builtin_factories() -> dict[str, Callable[[], Adapter]]:
    # Imports happen lazily to keep module load cheap.
    from agentsync.adapters.agents_md import AgentsMdAdapter
    from agentsync.adapters.claude import ClaudeAdapter
    from agentsync.adapters.cline import ClineAdapter
    from agentsync.adapters.copilot import CopilotAdapter
    from agentsync.adapters.cursor import CursorAdapter
    from agentsync.adapters.windsurf import WindsurfAdapter

    return {
        "claude": ClaudeAdapter,
        "agents-md": AgentsMdAdapter,
        "cursor": CursorAdapter,
        "cline": ClineAdapter,
        "windsurf": WindsurfAdapter,
        "copilot": CopilotAdapter,
    }


def discover_adapters() -> dict[str, Adapter]:
    """Return a mapping of adapter name → instance.

    Built-ins are loaded first; third-party plugins registered via the
    `agentsync.adapters` entry-point group override them by name.
    """
    adapters: dict[str, Adapter] = {}

    for name, factory in _builtin_factories().items():
        try:
            adapter = factory()
        except Exception as exc:  # pragma: no cover - defensive
            raise AdapterError(f"failed to load built-in adapter {name!r}: {exc}") from exc
        if adapter.name and adapter.name != name:
            raise AdapterError(
                f"built-in adapter at key {name!r} reported mismatched name {adapter.name!r}"
            )
        adapter.name = name
        adapters[name] = adapter

    eps = entry_points(group=ENTRY_POINT_GROUP)
    for ep in eps:
        try:
            cls = ep.load()
        except Exception as exc:
            raise AdapterError(f"failed to load adapter plugin {ep.name!r}: {exc}") from exc
        try:
            adapter = cls()
        except Exception as exc:
            raise AdapterError(
                f"failed to instantiate adapter plugin {ep.name!r}: {exc}"
            ) from exc
        adapter.name = ep.name
        adapters[ep.name] = adapter

    return adapters


def list_adapters() -> list[Adapter]:
    return list(discover_adapters().values())


def list_adapter_names() -> list[str]:
    return list(discover_adapters().keys())


def get_adapter(name: str) -> Adapter:
    adapters = discover_adapters()
    if name not in adapters:
        valid = ", ".join(sorted(adapters)) or "(none)"
        raise AdapterError(f"unknown adapter {name!r}; available: {valid}")
    return adapters[name]
