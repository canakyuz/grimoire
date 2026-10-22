"""Python functions Grimoire registers on every SQLite connection.

SQLite's built-in ``lower()`` only folds the ASCII letters A-Z, so comparing
``lower(username)`` with Python's ``str.lower()`` misses any name that starts
with, say, "É". :data:`FOLD_FUNCTION` gives SQL the same Unicode folding Python
uses. It has a Grimoire-specific name rather than replacing ``lower()``, which
the database's own indexes are built on.

Nothing stored depends on it - no index or constraint calls it - so a
connection without it (the sqlite3 shell, a backup tool) still reads and writes
the database normally.
"""
import unicodedata
from typing import Any, Optional

FOLD_FUNCTION = "grimoire_fold"


def fold_text(value: Optional[str]) -> Optional[str]:
    """``value`` compared without regard to case or compatibility forms.

    NFKC first, so a ligature or full-width letter is its plain letters, then
    full Unicode case folding ("Émile" and "émile", "Straße" and "STRASSE").
    """
    if value is None:
        return None
    return unicodedata.normalize("NFKC", value).casefold()


def _fold_sql(value: Any) -> Any:
    # SQLite can hand any type to a function; only text is folded.
    return fold_text(value) if isinstance(value, str) else value


def register(dbapi_connection: Any) -> None:
    """Register Grimoire's SQL functions on a new sqlite3 connection."""
    dbapi_connection.create_function(FOLD_FUNCTION, 1, _fold_sql, deterministic=True)
