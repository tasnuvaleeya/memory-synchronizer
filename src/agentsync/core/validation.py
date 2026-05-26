"""Cross-file validation for an /agent directory."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from agentsync.core.frontmatter import FrontmatterError, parse_frontmatter_file
from agentsync.core.manifest import ManifestError, load_manifest
from agentsync.core.models import Manifest
from agentsync.core.paths import AgentPaths

_MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
_MD_REFERENCE_RE = re.compile(r"^\s*\[[^\]]+\]:\s*(\S+)", re.MULTILINE)


@dataclass
class ValidationIssue:
    severity: str  # "error" | "warning"
    path: Path | None
    message: str


@dataclass
class ValidationReport:
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]

    @property
    def ok(self) -> bool:
        return not self.errors

    def error(self, message: str, path: Path | None = None) -> None:
        self.issues.append(ValidationIssue("error", path, message))

    def warning(self, message: str, path: Path | None = None) -> None:
        self.issues.append(ValidationIssue("warning", path, message))


def _is_external_link(href: str) -> bool:
    return href.startswith(("http://", "https://", "mailto:", "tel:", "#"))


def _check_markdown_links(file_path: Path, body: str, report: ValidationReport) -> None:
    for match in _MD_LINK_RE.finditer(body):
        href = match.group(1).strip()
        if not href or _is_external_link(href):
            continue
        target = href.split("#", 1)[0]
        if not target:
            continue
        resolved = (file_path.parent / target).resolve()
        if not resolved.exists():
            report.warning(f"broken link to {href!r}", path=file_path)
    for match in _MD_REFERENCE_RE.finditer(body):
        href = match.group(1).strip()
        if not href or _is_external_link(href):
            continue
        target = href.split("#", 1)[0]
        resolved = (file_path.parent / target).resolve()
        if not resolved.exists():
            report.warning(f"broken reference link to {href!r}", path=file_path)


def validate_agent_dir(paths: AgentPaths) -> ValidationReport:
    report = ValidationReport()

    if not paths.agent_dir.is_dir():
        report.error(f"/agent directory not found at {paths.agent_dir}")
        return report

    try:
        manifest: Manifest = load_manifest(paths.manifest_file)
    except ManifestError as exc:
        report.error(str(exc), path=paths.manifest_file)
        return report

    declared_paths: set[str] = set()
    for entry in manifest.files:
        rel_path = entry.path
        if rel_path in declared_paths:
            report.error(
                f"duplicate manifest entry for path {rel_path!r}", path=paths.manifest_file
            )
            continue
        declared_paths.add(rel_path)

        abs_path = paths.agent_dir / rel_path
        if not abs_path.is_file():
            report.error(
                f"manifest references missing file {rel_path!r}", path=paths.manifest_file
            )
            continue

        if rel_path.endswith(".md"):
            try:
                doc = parse_frontmatter_file(abs_path)
            except FrontmatterError as exc:
                report.error(str(exc), path=abs_path)
                continue
            _check_markdown_links(abs_path, doc.body, report)

    # Warn about markdown files inside /agent that are NOT declared in the manifest.
    for md_file in sorted(paths.agent_dir.rglob("*.md")):
        rel = md_file.relative_to(paths.agent_dir).as_posix()
        if rel not in declared_paths:
            report.warning(
                f"markdown file {rel!r} is not declared in manifest.yaml",
                path=md_file,
            )

    return report
