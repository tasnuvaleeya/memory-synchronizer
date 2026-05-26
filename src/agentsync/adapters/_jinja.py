"""Shared Jinja2 environment for adapter templates."""

from __future__ import annotations

from functools import cache

from jinja2 import Environment, PackageLoader, StrictUndefined, select_autoescape


@cache
def get_environment() -> Environment:
    env = Environment(
        loader=PackageLoader("agentsync.adapters", "templates"),
        autoescape=select_autoescape(default=False),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )
    env.globals["WILDCARD"] = "*"
    return env


def render_template(template_name: str, **context: object) -> str:
    return get_environment().get_template(template_name).render(**context)
