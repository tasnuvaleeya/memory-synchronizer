"""Implementation of `agentsync init`."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Annotated

import typer
import yaml
from rich.console import Console

from agentsync.cli._exit import ExitCode
from agentsync.core.config import LocalConfig, save_local_config
from agentsync.core.models import AdapterTarget
from agentsync.core.paths import resolve_paths
from agentsync.templates import TEMPLATES_ROOT

console = Console()

DEFAULT_TARGETS: tuple[AdapterTarget, ...] = (
    AdapterTarget.CLAUDE,
    AdapterTarget.AGENTS_MD,
    AdapterTarget.CURSOR,
)


def _parse_targets(raw: str | None) -> list[AdapterTarget]:
    if not raw:
        return list(DEFAULT_TARGETS)
    out: list[AdapterTarget] = []
    seen: set[str] = set()
    for piece in raw.split(","):
        piece = piece.strip()
        if not piece or piece in seen:
            continue
        seen.add(piece)
        try:
            out.append(AdapterTarget(piece))
        except ValueError as exc:
            valid = ", ".join(t.value for t in AdapterTarget)
            raise typer.BadParameter(
                f"unknown adapter target {piece!r}; valid: {valid}"
            ) from exc
    return out


def _copy_template_tree(src: Path, dest: Path, *, force: bool) -> list[Path]:
    """Copy every file under `src` into `dest`, returning the relative paths written."""
    written: list[Path] = []
    for entry in sorted(src.rglob("*")):
        if entry.is_dir():
            continue
        rel = entry.relative_to(src)
        target = dest / rel
        if target.exists() and not force:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(entry, target)
        written.append(rel)
    return written


def init_command(
    targets: Annotated[
        str | None,
        typer.Option(
            "--targets",
            "-t",
            help="Comma-separated adapter targets. Defaults to claude,agents-md,cursor.",
        ),
    ] = None,
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="Overwrite existing files in /agent."),
    ] = False,
    repo_root: Annotated[
        Path | None,
        typer.Option(
            "--repo",
            help="Repo root (defaults to the current working directory).",
            exists=False,
            file_okay=False,
            dir_okay=True,
        ),
    ] = None,
) -> None:
    selected_targets = _parse_targets(targets)
    paths = resolve_paths(repo_root)

    if paths.agent_dir.exists() and any(paths.agent_dir.iterdir()) and not force:
        console.print(
            f"[yellow]warning:[/yellow] {paths.agent_dir} already exists and is not empty. "
            "Re-run with --force to overwrite."
        )
        raise typer.Exit(ExitCode.USER_ERROR)

    template_src = Path(str(TEMPLATES_ROOT.joinpath("starter")))
    if not template_src.is_dir():
        console.print("[red]error:[/red] starter templates missing from package")
        raise typer.Exit(ExitCode.INTERNAL)

    paths.agent_dir.mkdir(parents=True, exist_ok=True)
    written = _copy_template_tree(template_src, paths.agent_dir, force=force)

    # Move the .agentsyncignore template up to the repo root (if it landed in agent_dir).
    moved_to_root: set[Path] = set()
    misplaced_ignore = paths.agent_dir / ".agentsyncignore"
    repo_ignore = paths.repo_root / ".agentsyncignore"
    if misplaced_ignore.is_file() and not repo_ignore.exists():
        shutil.move(str(misplaced_ignore), str(repo_ignore))
        moved_to_root.add(Path(".agentsyncignore"))

    # Rewrite the starter manifest with the targets the user actually asked for,
    # so `agentsync sync` honours --targets out of the box.
    manifest_path = paths.agent_dir / "manifest.yaml"
    if manifest_path.is_file():
        manifest_data = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
        manifest_data["targets"] = [t.value for t in selected_targets]
        manifest_path.write_text(
            yaml.safe_dump(manifest_data, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )

    config = LocalConfig(default_targets=list(selected_targets))
    save_local_config(paths.config_file, config)

    console.print(f"[green]initialized[/green] {paths.agent_dir.relative_to(paths.repo_root)}/")
    for rel in written:
        if rel in moved_to_root:
            console.print(f"  + {rel.as_posix()}")
        else:
            console.print(f"  + agent/{rel.as_posix()}")
    console.print(
        f"  + {paths.config_file.relative_to(paths.repo_root).as_posix()} "
        f"(targets: {', '.join(t.value for t in selected_targets)})"
    )
    console.print("\nNext: edit the files in [bold]agent/[/bold] then run "
                  "[bold]agentsync validate[/bold].")
