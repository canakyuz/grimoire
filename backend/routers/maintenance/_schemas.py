"""Pydantic schemas for the maintenance API."""
from pydantic import BaseModel, Field


class CollectionCounts(BaseModel):
    """A count per library collection."""

    books: int
    maps: int
    tokens: int
    audio: int
    models: int


class CleanupCounts(CollectionCounts):
    """Per-collection counts of DB rows removed for missing files."""

    systems: int


class CleanupResponse(BaseModel):
    removed: CleanupCounts


class CleanupPreviewResponse(BaseModel):
    """What a cleanup would remove, worked out without removing anything."""

    missing: CollectionCounts = Field(
        description="Rows per collection whose file is no longer on disk."
    )
    total: CollectionCounts = Field(description="All rows per collection.")
    library_unavailable: bool = Field(
        description=(
            "The library folder is missing or empty while the database still holds "
            "items - most likely an unmounted share. A cleanup is refused unless forced."
        )
    )


class SidecarSettings(BaseModel):
    """Metadata sidecar export configuration (issue #300)."""

    formats: list[str] = Field(
        default_factory=list,
        description="Enabled sidecar formats: opf, nfo, json, yaml. Empty disables export.",
    )
    covers: bool = Field(
        default=False, description="Write the cover image next to the metadata file."
    )
    overwrite_foreign: bool = Field(
        default=False,
        description="Allow a backfill to replace sidecars Grimoire did not write.",
    )


class SidecarExportResponse(BaseModel):
    """Outcome of a sidecar backfill run."""

    written: int
    skipped_foreign: int
    skipped_missing: int
    failed: int
    covers: int
    read_only: bool
    errors: list[str]
