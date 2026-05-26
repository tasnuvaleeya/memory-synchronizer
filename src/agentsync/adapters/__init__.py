"""Built-in adapters and the adapter registry."""

from agentsync.adapters.base import (
    Adapter,
    GeneratedFile,
    RenderContext,
)
from agentsync.adapters.registry import (
    discover_adapters,
    get_adapter,
    list_adapter_names,
    list_adapters,
)

__all__ = [
    "Adapter",
    "GeneratedFile",
    "RenderContext",
    "discover_adapters",
    "get_adapter",
    "list_adapter_names",
    "list_adapters",
]
