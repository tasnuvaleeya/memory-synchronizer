"""Track checksums of the last sync so drift detection can spot manual edits."""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

from agentsync import SCHEMA_VERSION, __version__
from agentsync.core.checksum import sha256_text

CACHE_FILENAME = "last-sync.json"


@dataclass
class SyncCache:
    """Per-repo cache mapping generated file paths → last sync checksum."""

    version: int = SCHEMA_VERSION
    agentsync_version: str = __version__
    files: dict[str, str] = field(default_factory=dict)  # rel_path -> sha256

    def record(self, rel_path: str, content: str) -> None:
        self.files[rel_path] = sha256_text(content)

    def forget(self, rel_path: str) -> None:
        self.files.pop(rel_path, None)

    def forget_many(self, rel_paths: Iterable[str]) -> None:
        for p in rel_paths:
            self.forget(p)

    def expected_sha(self, rel_path: str) -> str | None:
        return self.files.get(rel_path)

    def has_drift(self, rel_path: str, on_disk_content: str | None) -> bool:
        """A file has drift if its on-disk hash differs from what we last wrote.

        If we have no cache entry for the path, we have no claim to make and
        return False (treat as a fresh write).
        """
        expected = self.expected_sha(rel_path)
        if expected is None:
            return False
        if on_disk_content is None:
            # File was deleted after we generated it — not drift, just missing.
            return False
        return sha256_text(on_disk_content) != expected


def cache_file(agentsync_dir: Path) -> Path:
    return agentsync_dir / "cache" / CACHE_FILENAME


def load_sync_cache(agentsync_dir: Path) -> SyncCache:
    path = cache_file(agentsync_dir)
    if not path.is_file():
        return SyncCache()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Corrupt cache → start fresh.
        return SyncCache()
    if not isinstance(raw, dict):
        return SyncCache()
    files = raw.get("files", {})
    if not isinstance(files, dict):
        files = {}
    return SyncCache(
        version=int(raw.get("version", SCHEMA_VERSION)),
        agentsync_version=str(raw.get("agentsync_version", __version__)),
        files={str(k): str(v) for k, v in files.items() if isinstance(v, str)},
    )


def save_sync_cache(agentsync_dir: Path, cache: SyncCache) -> None:
    path = cache_file(agentsync_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": cache.version,
        "agentsync_version": cache.agentsync_version,
        "files": dict(sorted(cache.files.items())),
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
