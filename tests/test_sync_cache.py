from __future__ import annotations

from pathlib import Path

from agentsync.core.sync_cache import (
    SyncCache,
    cache_file,
    load_sync_cache,
    save_sync_cache,
)


def test_round_trip(tmp_path: Path):
    cache = SyncCache()
    cache.record("CLAUDE.md", "hello\n")
    cache.record(".cursorrules", "rules\n")
    save_sync_cache(tmp_path, cache)
    loaded = load_sync_cache(tmp_path)
    assert loaded.files == cache.files


def test_corrupt_cache_resets_to_empty(tmp_path: Path):
    path = cache_file(tmp_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("not json{", encoding="utf-8")
    cache = load_sync_cache(tmp_path)
    assert cache.files == {}


def test_has_drift(tmp_path: Path):
    cache = SyncCache()
    cache.record("a.txt", "hello\n")
    assert cache.has_drift("a.txt", "different content") is True
    assert cache.has_drift("a.txt", "hello\n") is False
    # Unknown file → no claim.
    assert cache.has_drift("never-recorded.txt", "anything") is False
