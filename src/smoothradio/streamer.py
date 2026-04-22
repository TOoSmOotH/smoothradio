"""Audio streaming engine with AI-driven track selection."""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from pathlib import Path

import aiofiles

from .config import settings
from .library import TrackLibrary
from .models import CategoryFilter, Genre, Mood, StreamSession, Track

logger = logging.getLogger(__name__)


class SessionLimitExceeded(RuntimeError):
    """Raised when the stream engine has reached its concurrency cap."""


class StreamEngine:
    """Streams audio to listeners, using AI categorization to select tracks."""

    def __init__(self, library: TrackLibrary, max_sessions: int | None = None):
        self._library = library
        self._sessions: dict[str, StreamSession] = {}
        self._current_track: Track | None = None
        self._chunk_size = settings.stream_chunk_size
        self._max_sessions = (
            max_sessions if max_sessions is not None else settings.max_stream_sessions
        )

    @property
    def active_sessions(self) -> int:
        return len(self._sessions)

    def create_session(
        self,
        genres: list[Genre] | None = None,
        moods: list[Mood] | None = None,
        energy_range: tuple[float, float] = (0.0, 1.0),
    ) -> StreamSession:
        """Create a new listener session with preferences.

        Raises SessionLimitExceeded once max_stream_sessions concurrent
        listeners are active, so a burst of /stream connections cannot
        exhaust memory by growing the session dict without bound.
        """
        if self._max_sessions > 0 and len(self._sessions) >= self._max_sessions:
            raise SessionLimitExceeded(
                f"Server at capacity ({self._max_sessions} concurrent sessions)"
            )
        session = StreamSession(
            session_id=uuid.uuid4().hex,
            preferred_genres=genres or [],
            preferred_moods=moods or [],
            energy_range=energy_range,
        )
        self._sessions[session.session_id] = session
        logger.info("Created session %s", session.session_id)
        return session

    def remove_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def select_next_track(self, session: StreamSession | None = None) -> Track | None:
        """Select the next track based on session preferences and AI categories."""
        if session and (session.preferred_genres or session.preferred_moods):
            criteria = CategoryFilter(
                genres=session.preferred_genres,
                moods=session.preferred_moods,
                min_energy=session.energy_range[0],
                max_energy=session.energy_range[1],
            )
            candidates = self._library.filter_tracks(criteria)
        else:
            candidates = self._library.tracks

        if not candidates:
            candidates = self._library.tracks

        if not candidates:
            return None

        track = random.choice(candidates)
        self._current_track = track
        return track

    async def stream_track(self, track: Track):
        """Yield audio chunks from a track file."""
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
        """Continuously stream tracks for a session, selecting based on AI categories."""
        while session.session_id in self._sessions:
            track = self.select_next_track(session)
            if track is None:
                logger.warning("No tracks available for session %s", session.session_id)
                await asyncio.sleep(1)
                continue

            logger.info(
                "Streaming %s - %s (genre=%s) to session %s",
                track.metadata.artist,
                track.metadata.title,
                track.category.genre.value if track.category else "uncategorized",
                session.session_id,
            )

            async for chunk in self.stream_track(track):
                if session.session_id not in self._sessions:
                    return
                yield chunk
