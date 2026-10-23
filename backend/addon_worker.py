"""Standalone worker for running a community add-on's Python script.

Entry point for the spawned child process created by
``backend.addons.scripts._run``. It deliberately imports **nothing** from the
rest of the ``backend`` package, not even ``config`` (which would be safe to
import, issue #585): the third-party code it runs needs none of Grimoire's
settings, and should not find them already loaded in its process.

The add-on script is loaded from its own directory and handed a JSON request on
stdin, per the contract in ``docs/scripts.md`` of the community-add-ons repo. Its
JSON response is written to ``result_path``; an empty result file signals a crash
to the parent.
"""

import importlib.util
import io
import json
import os
import re
import sys
from collections.abc import Iterable, MutableMapping


def _load_script(script_path: str):
    """Import an add-on script from its path, under a private module name."""
    spec = importlib.util.spec_from_file_location("grimoire_addon_script", script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load add-on script at {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(script_path: str, request_json: str) -> dict:
    """Execute the script's ``main()`` with the request on stdin.

    Scripts follow a stdin/stdout JSON contract, so stdin and stdout are
    redirected around the call. Whatever the script prints on stdout is its
    response; anything it writes to stderr is left alone so it reaches the
    server log for the operator to read.
    """
    module = _load_script(script_path)
    entry = getattr(module, "main", None)
    if not callable(entry):
        return {"error": "add-on script defines no main()"}

    real_stdin, real_stdout = sys.stdin, sys.stdout
    captured = io.StringIO()
    sys.stdin = io.StringIO(request_json)
    sys.stdout = captured
    try:
        entry()
    finally:
        sys.stdin, sys.stdout = real_stdin, real_stdout

    raw = captured.getvalue().strip()
    if not raw:
        return {"error": "add-on script produced no output"}
    try:
        result = json.loads(raw)
    except ValueError:
        return {"error": "add-on script produced invalid JSON"}
    if not isinstance(result, dict):
        return {"error": "add-on script did not return an object"}
    return result


# Grimoire's own credentials, by name. The worker inherits the server's
# environment (multiprocessing offers no env= to start it with another), and
# the third-party script it runs needs none of them. Not a sandbox - the
# script can still read DATA_PATH - but nothing is handed to it for free.
# CREDENTIAL covers ADDON_INDEX_CREDENTIALS (private add-on index tokens); a
# _KEY name covers SECRET_KEY-style settings and keys a deployment passes in.
_SECRET_NAME = (
    "SECRET", "TOKEN", "PASSWORD", "PASSWD", "CREDENTIAL", "API_KEY", "PRIVATE_KEY", "DSN",
)
_SECRET_VARS = ("VALKEY_URL", "DATABASE_URL")  # URLs that carry a password
# A URL with a password in it (scheme://user:pass@host), whatever it is called:
# a proxy, or a Redis or database URL a deployment adds.
_URL_WITH_PASSWORD = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://[^/@\s]*:[^/@\s]*@")

# An add-on may name the variables its script needs (``script.env`` in its
# manifest - a source's API token, say), and those survive the scrub. Never
# Grimoire's own: these names and prefixes cover every credential it reads.
_RESERVED_VARS = frozenset({"SECRET_KEY", "DATABASE_URL", "VALKEY_URL"})
_RESERVED_PREFIXES = ("GRIMOIRE_", "OIDC_", "ADDON_")
ENV_NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")


def is_reserved_env(name: str) -> bool:
    """Whether ``name`` is one of Grimoire's own settings, never passed to a script."""
    upper = name.upper()
    return upper in _RESERVED_VARS or upper.startswith(_RESERVED_PREFIXES)


def _is_secret(name: str, value: str) -> bool:
    upper = name.upper()
    return (
        name in _SECRET_VARS
        or any(part in upper for part in _SECRET_NAME)
        or upper.endswith("_KEY")
        or "_KEY_" in upper
        or bool(_URL_WITH_PASSWORD.match(value))
    )


def scrub_environment(
    environ: MutableMapping[str, str] = os.environ, keep: Iterable[str] = ()
) -> list[str]:
    """Remove credentials from ``environ``; returns the names removed.

    ``keep`` names variables the add-on declared it needs; they stay, unless
    they are Grimoire's own.
    """
    kept = {name for name in keep if not is_reserved_env(name)}
    removed = [
        name
        for name, value in list(environ.items())
        if name not in kept and _is_secret(name, value)
    ]
    for name in removed:
        environ.pop(name, None)
    return removed


def main(
    script_path: str, request_json: str, result_path: str, keep_env: Iterable[str] = ()
) -> None:
    """Child-process entry point.  Always writes a result file unless it dies.

    Script failures are reported as an ``error`` response rather than allowed to
    propagate: an uncaught exception here would leave the result file empty,
    which the parent reads as a crash. Distinguishing "the script raised" from
    "the process died" gives the operator a far more useful message.
    """
    scrub_environment(keep=keep_env)
    try:
        result = run(script_path, request_json)
    except BaseException as exc:  # noqa: BLE001 - report, never crash silently
        result = {"error": f"{type(exc).__name__}: {exc}"}

    try:
        with open(result_path, "w", encoding="utf-8") as fh:
            json.dump(result, fh)
    except OSError:
        # Nothing useful left to do; the empty result file tells the parent.
        pass


if __name__ == "__main__":
    if len(sys.argv) == 4:
        main(sys.argv[1], sys.argv[2], sys.argv[3])
    else:  # pragma: no cover - defensive; the parent always passes three args
        sys.exit(f"usage: {os.path.basename(__file__)} SCRIPT REQUEST_JSON RESULT_PATH")
