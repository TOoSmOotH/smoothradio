"""Data models for SmoothRadio."""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel


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


class Track(BaseModel):
    """A track in the library with its metadata."""

    id: str
    metadata: TrackMetadata

    @property
    def path(self) -> Path:
        return Path(self.metadata.file_path)
