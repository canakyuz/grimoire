"""Opening user-uploaded images through a closed set of Pillow formats.

Every route that takes a picture from a user's device - campaign banners,
character art, tokens and sheets, character portraits and sheet image fields,
system and audio covers, the login button icon, a portrait embedded in an
imported character - promises PNG, JPEG, WebP or GIF, and checks the browser's
Content-Type against that list. The Content-Type is only the client's word,
though: left to itself, ``Image.open`` tries every format Pillow knows (TIFF,
PPM, MSP, PCX, ...), so a file of any of them sent as ``image/png`` would be
decoded, thumbnailed and served back. Passing ``formats=`` keeps Pillow to the
decoders the feature actually needs and leaves the rest unreachable from an
upload.

Images the server already holds (the library's own maps, tokens and covers)
are not opened through here: those are the operator's files, and the library
supports formats such as BMP and TIFF that uploads do not.
"""

import io
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:  # Pillow is imported lazily, as every caller here does.
    from PIL import Image

# Pillow format names (``Image.format``) an uploaded image may decode as. An
# animated PNG reports as PNG, and a camera JPEG carrying extra pictures (MPO)
# is still opened by the JPEG decoder, so both stay accepted.
UPLOAD_IMAGE_FORMATS: tuple[str, ...] = ("PNG", "JPEG", "WEBP", "GIF")


def open_upload_image(
    data: bytes, formats: Optional[tuple[str, ...]] = UPLOAD_IMAGE_FORMATS
) -> "Image.Image":
    """Open ``data`` as one of ``formats``; raise if it is anything else.

    ``formats=None`` lifts the restriction, for bytes the server already holds.
    Raises ``PIL.UnidentifiedImageError`` (an ``OSError``) when the bytes are
    not an image in one of the allowed formats.
    """
    from PIL import Image

    return Image.open(io.BytesIO(data), formats=formats)


def is_upload_image(
    data: bytes, formats: Optional[tuple[str, ...]] = UPLOAD_IMAGE_FORMATS
) -> bool:
    """True when ``data`` really is an image in one of ``formats``.

    Uses ``verify()``, which checks the file's structure without decoding all of
    its pixels, so it stays cheap on a large upload.
    """
    try:
        open_upload_image(data, formats).verify()
    except Exception:
        return False
    return True
