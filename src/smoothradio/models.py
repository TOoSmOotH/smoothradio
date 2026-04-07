"""Data models for SmoothRadio."""

from __future__ import annotations

from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field


class Genre(str, Enum):
    """Music genre categories."""

    JAZZ = "jazz"
    BLUES = "blues"
    CLASSICAL = "classical"
    ELECTRONIC = "electronic"
    HIP_HOP = "hip_hop"
    POP = "pop"
    ROCK = "rock"
    RNB = "rnb"
    SOUL = "soul"
    AMBIENT = "ambient"
    LOFI = "lofi"
    WORLD = "world"
    OTHER = "other"


class Mood(str, Enum):
    """Mood categories for tracks."""

    CHILL = "chill"
    ENERGETIC = "energetic"
    MELANCHOLIC = "melancholic"
    UPBEAT = "upbeat"
    RELAXING = "relaxing"
    INTENSE = "intense"
    ROMANTIC = "romantic"
    FOCUS = "focus"


class TrackMetadata(BaseModel):
    """Raw metadata extracted from an audio file."""

    file_path: str
    title: str = "Unknown"
    artist: str = "Unknown"
    album: str = "Unknown"
    duration_seconds: float = 0.0
    bitrate: int = 0
    sample_rate: int = 0
    format: str = "unknown"


class TrackCategory(BaseModel):
    """AI-generated categorization for a track."""

    genre: Genre
    sub_genre: str = ""
    moods: list[Mood] = Field(default_factory=list)
    energy_level: float = Field(ge=0.0, le=1.0, description="0=calm, 1=high energy")
    tags: list[str] = Field(default_factory=list)
    description: str = ""
    bpm_estimate: int | None = None


class Track(BaseModel):
    """A fully categorized track ready for streaming."""

    id: str
    metadata: TrackMetadata
    category: TrackCategory | None = None

    @property
    def is_categorized(self) -> bool:
        return self.category is not None

    @property
    def path(self) -> Path:
        return Path(self.metadata.file_path)


class StreamSession(BaseModel):
    """An active listener's streaming session."""

    session_id: str
    preferred_genres: list[Genre] = Field(default_factory=list)
    preferred_moods: list[Mood] = Field(default_factory=list)
    energy_range: tuple[float, float] = (0.0, 1.0)


class CategoryFilter(BaseModel):
    """Filter criteria for selecting tracks by category."""

    genres: list[Genre] = Field(default_factory=list)
    moods: list[Mood] = Field(default_factory=list)
    min_energy: float = 0.0
    max_energy: float = 1.0
    tags: list[str] = Field(default_factory=list)
    require_categorized: bool = True
