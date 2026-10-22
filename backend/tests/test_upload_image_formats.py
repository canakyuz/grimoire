"""Uploaded images decode only as PNG, JPEG, WebP or GIF.

Every image upload checks the browser's Content-Type, but that is only the
client's word. These tests send files in other formats Pillow can read (TIFF,
PPM, MSP, BMP) under an accepted image type and check each route refuses them
with its usual 400, while the four supported formats still go through. Images
the library already holds are the operator's own files and keep every format
the library supports.
"""

import base64
import io
import os
import uuid

import pytest
from PIL import Image

from backend.config import CAMPAIGN_UPLOAD_DIR, SessionLocal
from backend.models import CampaignFile, CampaignMember
from backend.routers.campaigns import uploads
from backend.services import image_source
from backend.services.characters.importing import decode_portrait
from backend.services.upload_images import (
    UPLOAD_IMAGE_FORMATS,
    is_upload_image,
    open_upload_image,
)
from backend.tests.conftest import make_audio, make_campaign, make_game_system, make_map


def _encode(fmt: str, size=(12, 8)) -> bytes:
    # MSP only stores 1-bit images; the rest take plain RGB.
    mode = "1" if fmt == "MSP" else "RGB"
    buf = io.BytesIO()
    Image.new(mode, size, 1 if mode == "1" else (200, 40, 40)).save(buf, fmt)
    return buf.getvalue()


SUPPORTED = [
    ("PNG", "image/png"),
    ("JPEG", "image/jpeg"),
    ("WEBP", "image/webp"),
    ("GIF", "image/gif"),
]
# Each sent under a type the route accepts, as a hostile client would.
REFUSED = [
    ("TIFF", "image/png"),
    ("PPM", "image/jpeg"),
    ("MSP", "image/gif"),
    ("BMP", "image/webp"),
]


# --------------------------------------------------------------------------- #
# The shared helper
# --------------------------------------------------------------------------- #


class TestHelper:
    def test_the_allow_list_is_the_four_web_formats(self):
        assert UPLOAD_IMAGE_FORMATS == ("PNG", "JPEG", "WEBP", "GIF")

    @pytest.mark.parametrize("fmt", [f for f, _ in SUPPORTED])
    def test_supported_formats_pass(self, fmt):
        data = _encode(fmt)
        assert is_upload_image(data)
        assert open_upload_image(data).format == fmt

    @pytest.mark.parametrize("fmt", [f for f, _ in REFUSED])
    def test_other_formats_fail(self, fmt):
        data = _encode(fmt)
        assert not is_upload_image(data)
        with pytest.raises(OSError):
            open_upload_image(data)

    def test_no_restriction_opens_anything_pillow_reads(self):
        tiff = _encode("TIFF")
        assert is_upload_image(tiff, None)
        assert open_upload_image(tiff, None).format == "TIFF"

    def test_garbage_is_not_an_image(self):
        assert not is_upload_image(b"MZ not an image")

    def test_source_formats(self):
        # A campaign file came from a user; library sources are the operator's.
        assert image_source.source_formats("campaign_file") == UPLOAD_IMAGE_FORMATS
        for kind in ("map", "token", "book", "audio"):
            assert image_source.source_formats(kind) is None

    def test_validate_image_defaults_to_upload_formats(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            image_source.validate_image(_encode("TIFF"))
        assert exc.value.status_code == 400
        image_source.validate_image(_encode("TIFF"), None)
        image_source.validate_image(_encode("PNG"))


class TestBannerThumb:
    def test_refuses_a_format_uploads_do_not_accept(self):
        assert uploads._make_banner_thumb(_encode("TIFF")) is None

    def test_a_library_source_may_be_any_format(self):
        thumb = uploads._make_banner_thumb(_encode("TIFF"), None)
        assert thumb is not None
        assert Image.open(io.BytesIO(thumb)).format == "WEBP"


# --------------------------------------------------------------------------- #
# Campaign uploads
# --------------------------------------------------------------------------- #


@pytest.fixture
def campaign(admin_id):
    return make_campaign(admin_id)


@pytest.fixture
def member(campaign, admin_id):
    db = SessionLocal()
    try:
        m = CampaignMember(campaign_id=campaign.id, user_id=admin_id, status="accepted")
        db.add(m)
        db.commit()
        return m.id
    finally:
        db.close()


def _post(client, headers, url, data, ctype, name="upload.png"):
    return client.post(url, files={"file": (name, data, ctype)}, headers=headers)


class TestCampaignUploads:
    @pytest.mark.parametrize("fmt,ctype", SUPPORTED)
    def test_banner_accepts_supported_formats(self, client, admin_headers, campaign, fmt, ctype):
        url = f"/api/campaigns/{campaign.id}/banner"
        resp = _post(client, admin_headers, url, _encode(fmt), ctype)
        assert resp.status_code == 200, resp.text
        got = client.get(url, headers=admin_headers)
        assert got.status_code == 200
        assert Image.open(io.BytesIO(got.content)).format == "WEBP"

    @pytest.mark.parametrize("fmt,ctype", REFUSED)
    def test_banner_refuses_other_formats(self, client, admin_headers, campaign, fmt, ctype):
        url = f"/api/campaigns/{campaign.id}/banner"
        resp = _post(client, admin_headers, url, _encode(fmt), ctype)
        assert resp.status_code == 400
        assert resp.json()["detail"] == "File is not a valid image"

    @pytest.mark.parametrize("part", ["art", "token", "sheet"])
    def test_member_pictures_refuse_tiff_and_ppm(
        self, client, admin_headers, campaign, member, part
    ):
        url = f"/api/campaigns/{campaign.id}/members/{member}/{part}"
        for fmt, ctype in (("TIFF", "image/png"), ("PPM", "image/jpeg")):
            assert _post(client, admin_headers, url, _encode(fmt), ctype).status_code == 400
        assert _post(client, admin_headers, url, _encode("PNG"), "image/png").status_code == 200

    def test_campaign_image_refuses_tiff_and_ppm(self, client, admin_headers, campaign):
        url = f"/api/campaigns/{campaign.id}/images"
        for fmt, ctype in (("TIFF", "image/png"), ("PPM", "image/jpeg")):
            assert _post(client, admin_headers, url, _encode(fmt), ctype).status_code == 400
        assert _post(client, admin_headers, url, _encode("JPEG"), "image/jpeg").status_code == 201

    def test_a_stored_banner_in_another_format_is_served_without_a_thumbnail(
        self, client, admin_headers, campaign
    ):
        """A banner stored before uploads were restricted is not decoded again."""
        os.makedirs(uploads._BANNER_DIR, exist_ok=True)
        filename = f"{campaign.id}.png"
        with open(os.path.join(uploads._BANNER_DIR, filename), "wb") as f:
            f.write(_encode("TIFF"))
        db = SessionLocal()
        try:
            from backend.models import Campaign

            db.query(Campaign).filter_by(id=campaign.id).update({"banner_path": filename})
            db.commit()
        finally:
            db.close()

        resp = client.get(f"/api/campaigns/{campaign.id}/banner", headers=admin_headers)
        assert resp.status_code == 200
        assert not os.path.isfile(uploads._banner_thumb_path(campaign.id))


class TestBannerFromSource:
    def _campaign_file(self, campaign_id: str, data: bytes) -> str:
        """A campaign file named like a PNG, holding whatever bytes it was given."""
        stored = f"{uuid.uuid4().hex}.png"
        path = os.path.join(CAMPAIGN_UPLOAD_DIR, "files", stored)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        db = SessionLocal()
        try:
            cf = CampaignFile(
                campaign_id=campaign_id,
                stored_path=stored,
                filename="art.png",
                mime_type="image/png",
                size_bytes=len(data),
                is_image=True,
            )
            db.add(cf)
            db.commit()
            return cf.id
        finally:
            db.close()

    def test_a_campaign_file_in_another_format_is_refused(self, client, admin_headers, campaign):
        cf_id = self._campaign_file(campaign.id, _encode("TIFF"))
        resp = client.post(
            f"/api/campaigns/{campaign.id}/banner/from-source",
            json={"source_type": "campaign_file", "source_id": cf_id},
            headers=admin_headers,
        )
        assert resp.status_code == 400

    def test_a_png_campaign_file_still_works(self, client, admin_headers, campaign):
        cf_id = self._campaign_file(campaign.id, _encode("PNG"))
        resp = client.post(
            f"/api/campaigns/{campaign.id}/banner/from-source",
            json={"source_type": "campaign_file", "source_id": cf_id},
            headers=admin_headers,
        )
        assert resp.status_code == 200

    def test_a_tiff_library_map_still_works(self, client, admin_headers, campaign, tmp_path):
        path = str(tmp_path / "keep.tiff")
        with open(path, "wb") as f:
            f.write(_encode("TIFF"))
        m = make_map(filename="upload-formats-keep.tiff", filepath=path)
        resp = client.post(
            f"/api/campaigns/{campaign.id}/banner/from-source",
            json={"source_type": "map", "source_id": m.id},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["banner_path"].endswith(".webp")


# --------------------------------------------------------------------------- #
# Covers
# --------------------------------------------------------------------------- #


class TestCovers:
    def test_system_cover_refuses_tiff_and_ppm(self, client, admin_headers):
        system = make_game_system()
        url = f"/api/systems/{system.id}/cover"
        for fmt, ctype in (("TIFF", "image/png"), ("PPM", "image/jpeg")):
            assert _post(client, admin_headers, url, _encode(fmt), ctype).status_code == 400
        assert _post(client, admin_headers, url, _encode("WEBP"), "image/webp").status_code == 200

    def test_system_cover_from_a_tiff_library_map_still_works(
        self, client, admin_headers, tmp_path
    ):
        path = str(tmp_path / "cover.tiff")
        with open(path, "wb") as f:
            f.write(_encode("TIFF"))
        m = make_map(filename="upload-formats-cover.tiff", filepath=path)
        system = make_game_system()
        resp = client.post(
            f"/api/systems/{system.id}/cover/from-source",
            json={"source_type": "map", "source_id": m.id},
            headers=admin_headers,
        )
        assert resp.status_code == 200

    def test_audio_cover_refuses_tiff_and_ppm(self, client, admin_headers):
        track = make_audio()
        url = f"/api/audio/{track.id}/cover"
        for fmt, ctype in (("TIFF", "image/png"), ("PPM", "image/jpeg")):
            assert _post(client, admin_headers, url, _encode(fmt), ctype).status_code == 400
        assert _post(client, admin_headers, url, _encode("GIF"), "image/gif").status_code == 200

    def test_audio_cover_from_a_tiff_library_map_still_works(
        self, client, admin_headers, tmp_path
    ):
        path = str(tmp_path / "audio-cover.tiff")
        with open(path, "wb") as f:
            f.write(_encode("TIFF"))
        m = make_map(filename="upload-formats-audio.tiff", filepath=path)
        track = make_audio()
        resp = client.post(
            f"/api/audio/{track.id}/cover/from-source",
            json={"source_type": "map", "source_id": m.id},
            headers=admin_headers,
        )
        assert resp.status_code == 200


# --------------------------------------------------------------------------- #
# Character importing
# --------------------------------------------------------------------------- #


class TestImportedPortrait:
    def _data_url(self, data: bytes) -> str:
        return "data:image/png;base64," + base64.b64encode(data).decode("ascii")

    def test_a_png_portrait_is_kept(self):
        assert decode_portrait(self._data_url(_encode("PNG"))) is not None

    @pytest.mark.parametrize("fmt", ["TIFF", "PPM"])
    def test_another_format_is_dropped(self, fmt):
        assert decode_portrait(self._data_url(_encode(fmt))) is None
