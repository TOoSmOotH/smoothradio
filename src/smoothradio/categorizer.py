"""AI-powered track categorization using the Anthropic API."""

from __future__ import annotations

import json
import logging

import anthropic

from .config import settings
from .models import Genre, Mood, Track, TrackCategory, TrackMetadata

logger = logging.getLogger(__name__)

CATEGORIZATION_PROMPT = """\
You are a music categorization expert. Given the metadata of a music track, \
provide a detailed categorization.

Track metadata:
- Title: {title}
- Artist: {artist}
- Album: {album}
- Duration: {duration:.0f}s
- Format: {format}
- Bitrate: {bitrate}
- Sample Rate: {sample_rate}

Respond with ONLY a JSON object (no markdown, no explanation) matching this schema:
{{
  "genre": one of [{genres}],
  "sub_genre": "specific sub-genre string",
  "moods": list of moods from [{moods}],
  "energy_level": float 0.0-1.0 (0=calm, 1=high energy),
  "tags": ["tag1", "tag2", ...] (up to 5 descriptive tags),
  "description": "Brief 1-2 sentence description of the track's vibe",
  "bpm_estimate": estimated BPM as integer or null
}}
"""


class Categorizer:
    """Categorizes tracks using AI analysis of metadata."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self._api_key = api_key or settings.anthropic_api_key
        self._model = model or settings.categorization_model
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=self._api_key)
        return self._client

    async def categorize_track(self, track: Track) -> TrackCategory:
        """Categorize a single track using AI."""
        metadata = track.metadata
        prompt = CATEGORIZATION_PROMPT.format(
            title=metadata.title,
            artist=metadata.artist,
            album=metadata.album,
            duration=metadata.duration_seconds,
            format=metadata.format,
            bitrate=metadata.bitrate,
            sample_rate=metadata.sample_rate,
            genres=", ".join(f'"{g.value}"' for g in Genre),
            moods=", ".join(f'"{m.value}"' for m in Mood),
        )

        try:
            response = self.client.messages.create(
                model=self._model,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.content[0].text
            data = json.loads(content)
            return TrackCategory(**data)
        except (json.JSONDecodeError, anthropic.APIError) as exc:
            logger.error("AI categorization failed for %s: %s", track.id, exc)
            return _fallback_categorization(metadata)

    async def categorize_batch(self, tracks: list[Track]) -> list[TrackCategory]:
        """Categorize multiple tracks. Returns categories in same order as input."""
        results: list[TrackCategory] = []
        for track in tracks:
            category = await self.categorize_track(track)
            results.append(category)
        return results


def _fallback_categorization(metadata: TrackMetadata) -> TrackCategory:
    """Provide a basic fallback categorization when AI is unavailable."""
    return TrackCategory(
        genre=Genre.OTHER,
        sub_genre="uncategorized",
        moods=[Mood.CHILL],
        energy_level=0.5,
        tags=["uncategorized"],
        description=f"Track by {metadata.artist}",
    )
