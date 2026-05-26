"""Core sync engine — renders adapters and reconciles with disk."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from agentsync.adapters.base import Adapter, GeneratedFile, RenderContext
from agentsync.adapters.registry import discover_adapters
from agentsync.core.checksum import sha256_text
from agentsync.core.memory_set import MemorySet
from agentsync.core.models import AdapterTarget
from agentsync.core.paths import AgentPaths
from agentsync.core.sync_cache import SyncCache


class SyncError(Exception):
    """Raised when a sync cannot proceed."""


class Status:
    UNCHANGED = "unchanged"
    UPDATED = "updated"
    CREATED = "created"
    DRIFT = "drift"
    WOULD_UPDATE = "would-update"
    WOULD_CREATE = "would-create"


@dataclass
class AdapterPlan:
    adapter: Adapter
    targets: list[TargetPlan] = field(default_factory=list)


@dataclass
class TargetPlan:
    rel_path: str  # path relative to repo root
    rendered: str  # what we'd write
    on_disk: str | None  # current file contents (None if missing)
    status: str  # one of Status.*

    @property
    def absolute_path(self) -> Path:  # populated by planner
        return self._absolute_path

    @absolute_path.setter
    def absolute_path(self, value: Path) -> None:
        object.__setattr__(self, "_absolute_path", value)

    @property
    def drifted(self) -> bool:
        return self.status == Status.DRIFT

    @property
    def changed(self) -> bool:
        return self.status not in (Status.UNCHANGED, Status.DRIFT)


@dataclass
class SyncPlan:
    adapter_plans: list[AdapterPlan]
    cache: SyncCache

    def all_targets(self) -> list[TargetPlan]:
        return [t for ap in self.adapter_plans for t in ap.targets]


def _select_adapters(
    memory_set: MemorySet, names: list[str] | None
) -> list[Adapter]:
    registry = discover_adapters()
    if names:
        unknown = [n for n in names if n not in registry]
        if unknown:
            available = ", ".join(sorted(registry))
            raise SyncError(f"unknown adapter(s) {unknown}; available: {available}")
        return [registry[n] for n in names]
    selected = [t.value if isinstance(t, AdapterTarget) else t for t in memory_set.manifest.targets]
    if not selected:
        return []
    unknown = [n for n in selected if n not in registry]
    if unknown:
        raise SyncError(
            f"manifest targets {unknown!r} have no registered adapter; "
            f"available: {', '.join(sorted(registry))}"
        )
    return [registry[n] for n in selected]


def _read_disk(path: Path) -> str | None:
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8")


def plan_sync(
    paths: AgentPaths,
    memory_set: MemorySet,
    cache: SyncCache,
    *,
    only: list[str] | None = None,
    dry_run: bool = False,
) -> SyncPlan:
    """Compute every output file and classify it (unchanged/updated/created/drift)."""
    adapters = _select_adapters(memory_set, only)
    ctx = RenderContext(repo_root=paths.repo_root)
    plans: list[AdapterPlan] = []

    for adapter in adapters:
        rendered_files = adapter.render(memory_set, ctx)
        adapter_plan = AdapterPlan(adapter=adapter)
        for gen in rendered_files:
            target_plan = _build_target_plan(paths, gen, cache, dry_run=dry_run)
            adapter_plan.targets.append(target_plan)
        plans.append(adapter_plan)

    return SyncPlan(adapter_plans=plans, cache=cache)


def _build_target_plan(
    paths: AgentPaths, gen: GeneratedFile, cache: SyncCache, *, dry_run: bool
) -> TargetPlan:
    abs_path = paths.repo_root / gen.rel_path
    on_disk = _read_disk(abs_path)

    if on_disk is None:
        status = Status.WOULD_CREATE if dry_run else Status.CREATED
        plan = TargetPlan(
            rel_path=gen.rel_path,
            rendered=gen.content,
            on_disk=None,
            status=status,
        )
    elif cache.has_drift(gen.rel_path, on_disk):
        plan = TargetPlan(
            rel_path=gen.rel_path,
            rendered=gen.content,
            on_disk=on_disk,
            status=Status.DRIFT,
        )
    elif sha256_text(on_disk) == sha256_text(gen.content):
        plan = TargetPlan(
            rel_path=gen.rel_path,
            rendered=gen.content,
            on_disk=on_disk,
            status=Status.UNCHANGED,
        )
    else:
        status = Status.WOULD_UPDATE if dry_run else Status.UPDATED
        plan = TargetPlan(
            rel_path=gen.rel_path,
            rendered=gen.content,
            on_disk=on_disk,
            status=status,
        )

    plan.absolute_path = abs_path
    return plan


def apply_plan(plan: SyncPlan, *, force: bool) -> None:
    """Write every changed file in the plan to disk, refreshing the cache.

    Raises SyncError if any target shows drift and `force` is False.
    """
    drifted = [t for t in plan.all_targets() if t.drifted]
    if drifted and not force:
        names = ", ".join(t.rel_path for t in drifted)
        raise SyncError(
            f"refusing to overwrite manually edited file(s): {names}. "
            f"Re-run with --force, or use `agentsync pull` first."
        )

    for target in plan.all_targets():
        if target.status in (Status.UNCHANGED,):
            continue
        target.absolute_path.parent.mkdir(parents=True, exist_ok=True)
        target.absolute_path.write_text(target.rendered, encoding="utf-8")
        plan.cache.record(target.rel_path, target.rendered)
