"""Resolve repo-relative paths used by agentsync."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

AGENT_DIR_DEFAULT = "agent"
AGENTSYNC_DIR = ".agentsync"
CONFIG_FILENAME = "config.yaml"
MANIFEST_FILENAME = "manifest.yaml"


@dataclass(frozen=True)
class AgentPaths:
    repo_root: Path
    agent_dir: Path
    manifest_file: Path
    agentsync_dir: Path
    config_file: Path

    @property
    def cache_dir(self) -> Path:
        return self.agentsync_dir / "cache"


def resolve_paths(repo_root: Path | None = None, agent_dir_name: str | None = None) -> AgentPaths:
    root = (repo_root or Path.cwd()).resolve()
    name = agent_dir_name or AGENT_DIR_DEFAULT
    agent_dir = root / name
    agentsync_dir = root / AGENTSYNC_DIR
    return AgentPaths(
        repo_root=root,
        agent_dir=agent_dir,
        manifest_file=agent_dir / MANIFEST_FILENAME,
        agentsync_dir=agentsync_dir,
        config_file=agentsync_dir / CONFIG_FILENAME,
    )
