"""Audio streaming engine with track selection."""

from __future__ import annotations

import asyncio
import logging
import random
import uuid

import aiofiles

from .config import settings
from .library import TrackLibrary
from .models import StreamSession, Track

logger = logging.getLogger(__name__)


class StreamEngine:
    """Streams audio files to listeners."""

    def __init__(self, library: TrackLibrary):
        self._library = library
        self._sessions: dict[str, StreamSession] = {}
        self._chunk_size = settings.stream_chunk_size

    def create_session(self) -> StreamSession:
        """Create a new listener session."""
        session = StreamSession(session_id=uuid.uuid4().hex)
        self._sessions[session.session_id] = session
        logger.info("Created session %s", session.session_id)
        return session

    def remove_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def select_next_track(self) -> Track | None:
        """Select the next track randomly from the library."""
        candidates = self._library.tracks
        if not candidates:
            return None
        return random.choice(candidates)

    async def stream_track(self, track: Track):
        """Yield audio chunks from a single track file."""
        path = track.path
        if not path.exists():
            logger.error("Track file not found: %s", path)
            return

        async with aiofiles.open(str(path), "rb") as f:
            while True:
                chunk = await f.read(self._chunk_size)
                if not chunk:
                    break
                yield chunk

    async def stream_radio(self, session: StreamSession):
        """Continuously stream tracks for a session."""
        while session.session_id in self._sessions:
            track = self.select_next_track()
            if track is None:
                logger.warning("No tracks available for session %s", session.session_id)
                await asyncio.sleep(1)
                continue

            logger.info(
                "Streaming %s - %s to session %s",
                track.metadata.artist,
                track.metadata.title,
                session.session_id,
            )

            async for chunk in self.stream_track(track):
                if session.session_id not in self._sessions:
                    return
                yield chunk
