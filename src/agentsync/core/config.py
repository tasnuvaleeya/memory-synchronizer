"""Load and save the per-repo `.agentsync/config.yaml`."""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

from agentsync.core.models import AdapterTarget
from agentsync.core.paths import AGENT_DIR_DEFAULT


class LocalConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    version: int = Field(1, ge=1)
    agent_dir: str = AGENT_DIR_DEFAULT
    default_targets: list[AdapterTarget] = Field(default_factory=list)
    telemetry: bool = False

    @field_validator("version")
    @classmethod
    def _check_version(cls, v: int) -> int:
        if v != 1:
            raise ValueError(f"only config version 1 is supported; got {v}")
        return v


def load_local_config(path: Path) -> LocalConfig:
    if not path.is_file():
        return LocalConfig()
    text = path.read_text(encoding="utf-8")
    data = yaml.safe_load(text) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} must be a YAML mapping, got {type(data).__name__}")
    return LocalConfig.model_validate(data)


def save_local_config(path: Path, config: LocalConfig) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = config.model_dump(mode="json")
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
