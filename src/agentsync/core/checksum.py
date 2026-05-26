"""Deterministic checksum helpers used for drift detection and provenance."""

from __future__ import annotations

import hashlib


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def short_sha(text: str, length: int = 12) -> str:
    return sha256_text(text)[:length]
