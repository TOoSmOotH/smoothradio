"""Audio file metadata extraction using mutagen."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis
from mutagen.mp4 import MP4

from .models import TrackMetadata

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".mp3", ".flac", ".ogg", ".m4a", ".mp4", ".wav"}


def generate_track_id(file_path: str) -> str:
    """Generate a stable ID from file path."""
    return hashlib.sha256(file_path.encode()).hexdigest()[:16]


def extract_metadata(file_path: Path) -> TrackMetadata | None:
    """Extract metadata from an audio file."""
    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return None

    try:
        audio = MutagenFile(str(file_path))
        if audio is None:
            logger.warning("Could not read audio file: %s", file_path)
            return None

        title = _get_tag(audio, file_path)
        artist = _get_artist(audio)
        album = _get_album(audio)
        duration = audio.info.length if audio.info else 0.0
        bitrate = getattr(audio.info, "bitrate", 0) if audio.info else 0
        sample_rate = getattr(audio.info, "sample_rate", 0) if audio.info else 0

        return TrackMetadata(
            file_path=str(file_path),
            title=title,
            artist=artist,
            album=album,
            duration_seconds=duration,
            bitrate=bitrate,
            sample_rate=sample_rate,
            format=file_path.suffix.lstrip(".").lower(),
        )
    except Exception:
        logger.exception("Error extracting metadata from %s", file_path)
        return None


def _get_tag(audio: MutagenFile, file_path: Path) -> str:
    """Extract title tag, falling back to filename."""
    if isinstance(audio, MP3):
        tags = audio.tags
        if tags and "TIT2" in tags:
            return str(tags["TIT2"])
    elif isinstance(audio, MP4):
        if "\xa9nam" in audio:
            return str(audio["\xa9nam"][0])
    elif isinstance(audio, (FLAC, OggVorbis)):
        if "title" in audio:
            return str(audio["title"][0])

    return file_path.stem


def _get_artist(audio: MutagenFile) -> str:
    """Extract artist tag."""
    if isinstance(audio, MP3):
        tags = audio.tags
        if tags and "TPE1" in tags:
            return str(tags["TPE1"])
    elif isinstance(audio, MP4):
        if "\xa9ART" in audio:
            return str(audio["\xa9ART"][0])
    elif isinstance(audio, (FLAC, OggVorbis)):
        if "artist" in audio:
            return str(audio["artist"][0])
    return "Unknown"


def _get_album(audio: MutagenFile) -> str:
    """Extract album tag."""
    if isinstance(audio, MP3):
        tags = audio.tags
        if tags and "TALB" in tags:
            return str(tags["TALB"])
    elif isinstance(audio, MP4):
        if "\xa9alb" in audio:
            return str(audio["\xa9alb"][0])
    elif isinstance(audio, (FLAC, OggVorbis)):
        if "album" in audio:
            return str(audio["album"][0])
    return "Unknown"
