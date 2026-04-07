"""Track library management - scanning, storing, and querying tracks."""

from __future__ import annotations

import logging
from pathlib import Path

from .metadata import SUPPORTED_EXTENSIONS, extract_metadata, generate_track_id
from .models import Track

logger = logging.getLogger(__name__)


class TrackLibrary:
    """Manages the collection of tracks and their metadata."""

    def __init__(self, media_dir: str):
        self._media_dir = Path(media_dir)
        self._tracks: dict[str, Track] = {}

    @property
    def tracks(self) -> list[Track]:
        return list(self._tracks.values())

    def get_track(self, track_id: str) -> Track | None:
        return self._tracks.get(track_id)

    def scan(self) -> int:
        """Scan media directory for audio files and extract metadata."""
        if not self._media_dir.exists():
            logger.warning("Media directory does not exist: %s", self._media_dir)
            return 0

        count = 0
        for path in self._media_dir.rglob("*"):
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            metadata = extract_metadata(path)
            if metadata is None:
                continue
            track_id = generate_track_id(str(path))
            if track_id not in self._tracks:
                self._tracks[track_id] = Track(id=track_id, metadata=metadata)
                count += 1

        logger.info("Scanned %d new tracks (%d total)", count, len(self._tracks))
        return count
