"""Entry point for scanning the media library."""

import logging
import sys

from .config import settings
from .library import TrackLibrary

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

logger = logging.getLogger(__name__)


def main():
    library = TrackLibrary(media_dir=settings.media_dir)
    count = library.scan()
    logger.info("Discovered %d tracks in %s", count, settings.media_dir)

    for track in library.tracks:
        m = track.metadata
        logger.info(
            "  %s - %s (%s) [%.1fs, %s]",
            m.artist,
            m.title,
            m.album,
            m.duration_seconds,
            m.format,
        )


if __name__ == "__main__":
    main()
