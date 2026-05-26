"""Core models, parsers, and discovery helpers."""

from agentsync.core.config import LocalConfig, load_local_config, save_local_config
from agentsync.core.frontmatter import (
    FrontmatterError,
    parse_frontmatter_file,
    split_frontmatter,
)
from agentsync.core.ignore import IgnoreMatcher, load_ignore_matcher
from agentsync.core.manifest import load_manifest
from agentsync.core.models import (
    AdapterTarget,
    Frontmatter,
    Manifest,
    ManifestFile,
    ManifestGeneration,
    ManifestProject,
    Source,
)
from agentsync.core.paths import AgentPaths, resolve_paths

__all__ = [
    "AdapterTarget",
    "AgentPaths",
    "Frontmatter",
    "FrontmatterError",
    "IgnoreMatcher",
    "LocalConfig",
    "Manifest",
    "ManifestFile",
    "ManifestGeneration",
    "ManifestProject",
    "Source",
    "load_ignore_matcher",
    "load_local_config",
    "load_manifest",
    "parse_frontmatter_file",
    "resolve_paths",
    "save_local_config",
    "split_frontmatter",
]
