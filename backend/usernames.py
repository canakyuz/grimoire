"""Usernames are unique regardless of case.

Signing in matches a username case-insensitively, so "Admin" and "admin" have
to be one account: two of them would leave the sign-in form picking one
arbitrarily. Every place that checks whether a name is taken goes through
:func:`username_taken`.

Names are compared with full Unicode case folding (:func:`fold_username`, the
``grimoire_fold`` SQL function from :mod:`backend.sql_functions`), so "Émile"
and "émile" are one name too. The database backs this with a unique index on
``lower(username)`` (:func:`ensure_unique_index`); SQLite's ``lower()`` only
folds A-Z, so the index is the narrower check and the application's the
stricter one. Accounts created before folding that differ only outside ASCII
are left as they are, and :func:`find_by_username` picks between them the same
way every time.
"""
import datetime
import logging
from typing import Any, Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Query, Session

from .models import User
from .sql_functions import FOLD_FUNCTION, fold_text

logger = logging.getLogger("grimoire.users")

INDEX_NAME = "ix_users_username_lower"

# SQLite's lower(): A-Z only.
_ASCII_LOWER = str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")


def fold_username(username: Optional[str]) -> Optional[str]:
    """``username`` as usernames are compared: trimmed, NFKC, case-folded."""
    return fold_text(username.strip()) if username is not None else None


def match_username(query: "Query[User]", username: str) -> Optional[User]:
    """The account in ``query`` whose username folds to the same as ``username``.

    If several do (only possible for accounts made before folding), the exact
    spelling wins, then the one SQLite's ASCII ``lower()`` matched - which is
    the account this name reached before - then the oldest, so the same name
    always reaches the same account.
    """
    typed = username.strip()
    if not typed:
        return None
    candidates = query.filter(
        getattr(func, FOLD_FUNCTION)(User.username) == fold_username(typed)
    ).all()
    if len(candidates) <= 1:
        return candidates[0] if candidates else None
    oldest = datetime.datetime.min

    def preference(user: User) -> tuple:
        return (
            user.username != typed,
            # What sign-in compared before: SQLite's lower() on the stored name.
            user.username.translate(_ASCII_LOWER) != typed.lower(),
            user.created_at or oldest,
            user.id,
        )

    return min(candidates, key=preference)


def find_by_username(db: Session, username: str) -> Optional[User]:
    """The account with this username, compared without regard to case."""
    return match_username(db.query(User), username)


def username_taken(db: Session, username: str, exclude_id: Optional[str] = None) -> bool:
    """Whether another account already has this username in any case."""
    found = find_by_username(db, username)
    return found is not None and found.id != exclude_id


def ensure_unique_index(conn: Any) -> bool:
    """Create the case-insensitive unique index, unless duplicates prevent it.

    Returns whether the index exists afterwards. Accounts that differ only in
    case (possible before this check existed) are logged rather than failing
    start-up; the index is created on the first start after they are renamed.
    """
    exists = conn.execute(
        text("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = :n"),
        {"n": INDEX_NAME},
    ).first()
    if exists:
        return True
    duplicates = conn.execute(
        text(
            "SELECT lower(username), group_concat(username, ', ') FROM users "
            "GROUP BY lower(username) HAVING count(*) > 1"
        )
    ).all()
    if duplicates:
        for _, names in duplicates:
            logger.warning(
                "Accounts whose usernames differ only in case: %s. Rename all but "
                "one in Settings > Users; usernames are case-insensitive.",
                names,
            )
        return False
    conn.execute(text(f"CREATE UNIQUE INDEX {INDEX_NAME} ON users (lower(username))"))
    return True
