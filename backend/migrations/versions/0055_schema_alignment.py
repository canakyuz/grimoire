"""schema alignment: bring the migrated schema in line with the models

A database built by the migrations had drifted from the models in a few places
(``alembic check`` on a fresh head reported them). Where the models describe
what the code relies on, this revision changes the database; where the
database was right, the models were changed instead (no schema change here):
``game_systems.parent_id`` stays a soft reference, ``content_entries.pack_id``
keeps its ``ON DELETE CASCADE``, ``content_packs.pack_id`` keeps its unique
constraint plus a plain index, and ``licenses.name`` stays ``VARCHAR(150)``.

Database changes:

* ``characters.campaign_id`` gets the foreign key 0038 left out, with
  ``ON DELETE SET NULL``: a character outlives the game it was played in and
  goes back to being the player's own. Characters already pointing at a
  deleted campaign are unlinked first, and lose ``gm_can_edit`` as a character
  moved out of a campaign does.
* ``rulesets.owner_id`` gets the foreign key 0039 could not add. Deleting a
  user deletes their personal rulesets and merging moves them, so the key only
  makes that rule hold. Personal rulesets whose owner is already gone are
  unreachable, and are deleted with their entries first.
* ``share_links.token_hash`` and ``token_sealed`` become NOT NULL, as 0047
  meant them to be. A link without them can never match a request, so any
  such row is deleted first.
* The ``variant_parent_id`` indexes 0025 named ``ix_<table>_variant_parent``
  take the ``ix_<table>_variant_parent_id`` name the models (and 0028's
  ``models_3d``) use.

SQLite cannot add a constraint or tighten a column in place, so the three
tables are rebuilt through batch copies. Migrations run with
``PRAGMA foreign_keys=ON``, which cannot be switched off inside the migration's
transaction, so only tables it is safe to copy that way are rebuilt: nothing
references ``characters`` or ``share_links``, and the only reference to
``rulesets`` is ``ruleset_entries``, whose ``ON DELETE CASCADE`` would empty it
when the old table is dropped - so its rows are set aside and restored around
the copy. ``game_systems``, which books and campaigns reference, is why
``parent_id`` stays soft. A temp table left by an interrupted run is dropped
first, and each change is skipped once present. Idempotent.

Revision ID: 2369ce04d145
Revises: 243b40052a01
Create Date: 2026-10-22 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "2369ce04d145"
down_revision: Union[str, None] = "243b40052a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CHARACTER_CAMPAIGN_FK = "fk_characters_campaign_id_campaigns"
_RULESET_OWNER_FK = "fk_rulesets_owner_id_users"
_KEPT_ENTRIES = "_alembic_keep_ruleset_entries"
_VARIANT_TABLES = ("books", "generic_maps", "tokens", "audio")


def _has_table(table: str) -> bool:
    return inspect(op.get_bind()).has_table(table)


def _foreign_keys(table: str) -> list[dict]:
    return inspect(op.get_bind()).get_foreign_keys(table)


def _has_fk(table: str, column: str, referred: str) -> bool:
    return any(
        fk["constrained_columns"] == [column] and fk["referred_table"] == referred
        for fk in _foreign_keys(table)
    )


def _has_named_fk(table: str, name: str) -> bool:
    return any(fk.get("name") == name for fk in _foreign_keys(table))


def _nullable(table: str, column: str) -> bool:
    return next(c["nullable"] for c in inspect(op.get_bind()).get_columns(table) if c["name"] == column)


def _indexes(table: str) -> set:
    return {i["name"] for i in inspect(op.get_bind()).get_indexes(table)}


def _drop_stale_temp(table: str) -> None:
    """Drop a ``_alembic_tmp_<table>`` an interrupted batch copy left behind."""
    op.execute(f'DROP TABLE IF EXISTS "_alembic_tmp_{table}"')


def _rebuild_rulesets(alter) -> None:
    """Run a batch copy of ``rulesets`` without losing ``ruleset_entries``.

    Dropping the old table with foreign keys on deletes every entry through
    the entries' ``ON DELETE CASCADE``; with them off it deletes nothing. The
    entries are set aside first and put back afterwards, keeping their ids,
    and the restore skips rows still there, so either way they survive.
    """
    bind = op.get_bind()
    op.execute(f'DROP TABLE IF EXISTS "{_KEPT_ENTRIES}"')
    has_entries = _has_table("ruleset_entries")
    if has_entries:
        op.execute(f'CREATE TABLE "{_KEPT_ENTRIES}" AS SELECT * FROM ruleset_entries')
    _drop_stale_temp("rulesets")
    with op.batch_alter_table("rulesets") as batch:
        alter(batch)
    if has_entries:
        columns = ", ".join(
            f'"{c["name"]}"' for c in inspect(bind).get_columns("ruleset_entries")
        )
        op.execute(
            f"INSERT OR IGNORE INTO ruleset_entries ({columns}) "
            f'SELECT {columns} FROM "{_KEPT_ENTRIES}"'
        )
        op.execute(f'DROP TABLE "{_KEPT_ENTRIES}"')


def _upgrade_characters() -> None:
    if not _has_table("characters"):
        return
    _drop_stale_temp("characters")
    op.execute(
        "UPDATE characters SET campaign_id = NULL, gm_can_edit = 0 "
        "WHERE campaign_id IS NOT NULL "
        "AND campaign_id NOT IN (SELECT id FROM campaigns)"
    )
    if not _has_fk("characters", "campaign_id", "campaigns"):
        with op.batch_alter_table("characters") as batch:
            batch.create_foreign_key(
                _CHARACTER_CAMPAIGN_FK,
                "campaigns",
                ["campaign_id"],
                ["id"],
                ondelete="SET NULL",
            )


def _upgrade_rulesets() -> None:
    if not _has_table("rulesets") or _has_fk("rulesets", "owner_id", "users"):
        return
    # Rows the copy would refuse under the table's keys: a personal ruleset whose
    # owner is gone, and (were foreign keys ever off) one whose campaign is gone,
    # which the campaign's cascade would have taken. Neither reaches anyone.
    unreachable = (
        "SELECT id FROM rulesets WHERE "
        "(owner_id IS NOT NULL AND owner_id NOT IN (SELECT id FROM users)) OR "
        "(campaign_id IS NOT NULL AND campaign_id NOT IN (SELECT id FROM campaigns))"
    )
    if _has_table("ruleset_entries"):
        op.execute(f"DELETE FROM ruleset_entries WHERE ruleset_id IN ({unreachable})")
    op.execute(f"DELETE FROM rulesets WHERE id IN ({unreachable})")
    # Attribution only: a departed author is cleared, as deleting a user does.
    op.execute(
        "UPDATE rulesets SET created_by_id = NULL WHERE created_by_id IS NOT NULL "
        "AND created_by_id NOT IN (SELECT id FROM users)"
    )
    _rebuild_rulesets(
        lambda batch: batch.create_foreign_key(
            _RULESET_OWNER_FK, "users", ["owner_id"], ["id"]
        )
    )


def _upgrade_share_links() -> None:
    if not _has_table("share_links"):
        return
    if not (_nullable("share_links", "token_hash") or _nullable("share_links", "token_sealed")):
        return
    _drop_stale_temp("share_links")
    op.execute("DELETE FROM share_links WHERE token_hash IS NULL OR token_sealed IS NULL")
    with op.batch_alter_table("share_links") as batch:
        batch.alter_column("token_hash", existing_type=sa.String(length=64), nullable=False)
        batch.alter_column("token_sealed", existing_type=sa.Text(), nullable=False)


def _rename_variant_indexes(old_suffix: str, new_suffix: str) -> None:
    for table in _VARIANT_TABLES:
        if not _has_table(table):
            continue
        indexes = _indexes(table)
        old, new = f"ix_{table}_{old_suffix}", f"ix_{table}_{new_suffix}"
        if old in indexes:
            op.drop_index(old, table_name=table)
        if new not in indexes:
            op.create_index(new, table, ["variant_parent_id"])


def upgrade() -> None:
    _upgrade_characters()
    _upgrade_rulesets()
    _upgrade_share_links()
    _rename_variant_indexes("variant_parent", "variant_parent_id")


def downgrade() -> None:
    _rename_variant_indexes("variant_parent_id", "variant_parent")
    if _has_table("share_links") and not _nullable("share_links", "token_hash"):
        _drop_stale_temp("share_links")
        with op.batch_alter_table("share_links") as batch:
            batch.alter_column("token_hash", existing_type=sa.String(length=64), nullable=True)
            batch.alter_column("token_sealed", existing_type=sa.Text(), nullable=True)
    if _has_table("rulesets") and _has_named_fk("rulesets", _RULESET_OWNER_FK):
        _rebuild_rulesets(
            lambda batch: batch.drop_constraint(_RULESET_OWNER_FK, type_="foreignkey")
        )
    if _has_table("characters") and _has_named_fk("characters", _CHARACTER_CAMPAIGN_FK):
        _drop_stale_temp("characters")
        with op.batch_alter_table("characters") as batch:
            batch.drop_constraint(_CHARACTER_CAMPAIGN_FK, type_="foreignkey")
