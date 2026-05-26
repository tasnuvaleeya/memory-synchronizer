"""Standard exit codes used across the CLI."""

from enum import IntEnum


class ExitCode(IntEnum):
    OK = 0
    USER_ERROR = 1
    DRIFT = 2
    INTERNAL = 3
