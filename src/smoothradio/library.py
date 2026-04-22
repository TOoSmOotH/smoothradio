"""Track library management - scanning, storing, and querying tracks."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from .categorizer import Categorizer
from .metadata import SUPPORTED_EXTENSIONS, extract_metadata, generate_track_id
from .models import CategoryFilter, Track, TrackCategory

logger = logging.getLogger(__name__)


class TrackLibrary:
    """Manages the collection of tracks, their metadata, and categories."""

    def __init__(self, media_dir: str, categorizer: Categorizer):
        self._media_dir = Path(media_dir)
        self._categorizer = categorizer
        self._tracks: dict[str, Track] = {}
        self._categories_file = self._media_dir / ".smoothradio_categories.json"

    @property
    def tracks(self) -> list[Track]:
        return list(self._tracks.values())

    @property
    def categorized_count(self) -> int:
        return sum(1 for t in self._tracks.values() if t.is_categorized)

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

        self._load_saved_categories()
        logger.info("Scanned %d new tracks (%d total)", count, len(self._tracks))
        return count

    async def categorize_uncategorized(self, batch_size: int = 10) -> int:
        """Run AI categorization on all uncategorized tracks."""
        uncategorized = [t for t in self._tracks.values() if not t.is_categorized]
        if not uncategorized:
            return 0

        total = 0
        for i in range(0, len(uncategorized), batch_size):
            batch = uncategorized[i : i + batch_size]
            categories = await self._categorizer.categorize_batch(batch)
            for track, category in zip(batch, categories):
                track.category = category
                total += 1

        self._save_categories()
        logger.info("Categorized %d tracks", total)
        return total

    async def categorize_track(self, track_id: str) -> TrackCategory | None:
        """Categorize a single track by ID."""
        track = self._tracks.get(track_id)
        if track is None:
            return None
        category = await self._categorizer.categorize_track(track)
        track.category = category
        self._save_categories()
        return category

    def filter_tracks(self, criteria: CategoryFilter) -> list[Track]:
        """Return tracks matching the given category filter."""
        results: list[Track] = []
        for track in self._tracks.values():
            if criteria.require_categorized and not track.is_categorized:
                continue
            if not track.is_categorized:
                results.append(track)
                continue

            cat = track.category
            if criteria.genres and cat.genre not in criteria.genres:
                continue
            if criteria.moods and not set(criteria.moods).intersection(cat.moods):
                continue
            if cat.energy_level < criteria.min_energy or cat.energy_level > criteria.max_energy:
                continue
            if criteria.tags and not set(criteria.tags).intersection(cat.tags):
                continue
            results.append(track)

        return results

    def _save_categories(self) -> None:
        """Persist track categories to disk."""
        data = {}
        for track_id, track in self._tracks.items():
            if track.category:
                data[track_id] = track.category.model_dump()
        try:
            self._categories_file.parent.mkdir(parents=True, exist_ok=True)
            self._categories_file.write_text(json.dumps(data, indent=2))
        except OSError:
            logger.exception("Failed to save categories")

    def _load_saved_categories(self) -> None:
        """Load previously saved categories from disk."""
        if not self._categories_file.exists():
            return
        try:
            data = json.loads(self._categories_file.read_text())
            for track_id, cat_data in data.items():
                track = self._tracks.get(track_id)
                if track and not track.is_categorized:
                    track.category = TrackCategory(**cat_data)
        except (json.JSONDecodeError, OSError):
            logger.exception("Failed to load saved categories")
