"""FastAPI streaming server with AI categorization endpoints."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse

from .categorizer import Categorizer
from .config import settings
from .library import TrackLibrary
from .models import CategoryFilter, Genre, Mood, TrackCategory
from .streamer import StreamEngine

logger = logging.getLogger(__name__)

categorizer = Categorizer()
library = TrackLibrary(media_dir=settings.media_dir, categorizer=categorizer)
stream_engine = StreamEngine(library)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Scan media library on startup."""
    count = library.scan()
    logger.info("Library loaded with %d tracks", count)
    yield


app = FastAPI(
    title="SmoothRadio",
    description="AI-powered streaming radio server",
    version="0.1.0",
    lifespan=lifespan,
)


# --- Library & Categorization Endpoints ---


@app.get("/api/tracks")
async def list_tracks(
    genre: Genre | None = None,
    mood: Mood | None = None,
    min_energy: float = Query(0.0, ge=0.0, le=1.0),
    max_energy: float = Query(1.0, ge=0.0, le=1.0),
    categorized_only: bool = True,
):
    """List tracks, optionally filtered by AI category."""
    criteria = CategoryFilter(
        genres=[genre] if genre else [],
        moods=[mood] if mood else [],
        min_energy=min_energy,
        max_energy=max_energy,
        require_categorized=categorized_only,
    )
    tracks = library.filter_tracks(criteria)
    return {
        "count": len(tracks),
        "tracks": [
            {
                "id": t.id,
                "title": t.metadata.title,
                "artist": t.metadata.artist,
                "album": t.metadata.album,
                "duration": t.metadata.duration_seconds,
                "category": t.category.model_dump() if t.category else None,
            }
            for t in tracks
        ],
    }


@app.get("/api/tracks/{track_id}")
async def get_track(track_id: str):
    """Get details for a specific track including its AI categorization."""
    track = library.get_track(track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return {
        "id": track.id,
        "metadata": track.metadata.model_dump(),
        "category": track.category.model_dump() if track.category else None,
    }


@app.post("/api/tracks/{track_id}/categorize")
async def categorize_track(track_id: str):
    """Trigger AI categorization for a specific track."""
    category = await library.categorize_track(track_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"track_id": track_id, "category": category.model_dump()}


@app.post("/api/categorize")
async def categorize_all():
    """Run AI categorization on all uncategorized tracks."""
    count = await library.categorize_uncategorized(
        batch_size=settings.categorization_batch_size
    )
    return {
        "categorized": count,
        "total_tracks": len(library.tracks),
        "total_categorized": library.categorized_count,
    }


@app.get("/api/library/stats")
async def library_stats():
    """Get library statistics including categorization coverage."""
    tracks = library.tracks
    categorized = [t for t in tracks if t.is_categorized]
    genre_counts: dict[str, int] = {}
    for t in categorized:
        genre = t.category.genre.value
        genre_counts[genre] = genre_counts.get(genre, 0) + 1

    return {
        "total_tracks": len(tracks),
        "categorized": len(categorized),
        "uncategorized": len(tracks) - len(categorized),
        "genres": genre_counts,
    }


@app.post("/api/library/scan")
async def rescan_library():
    """Rescan the media directory for new tracks."""
    count = library.scan()
    return {"new_tracks": count, "total_tracks": len(library.tracks)}


# --- Streaming Endpoints ---


@app.get("/stream")
async def stream_radio(
    genre: Genre | None = None,
    mood: Mood | None = None,
    min_energy: float = Query(0.0, ge=0.0, le=1.0),
    max_energy: float = Query(1.0, ge=0.0, le=1.0),
):
    """Stream radio filtered by AI-categorized preferences.

    Connect to this endpoint to receive a continuous audio stream.
    The server selects tracks based on their AI categorization matching
    the requested genre, mood, and energy level.
    """
    session = stream_engine.create_session(
        genres=[genre] if genre else None,
        moods=[mood] if mood else None,
        energy_range=(min_energy, max_energy),
    )

    async def generate():
        try:
            async for chunk in stream_engine.stream_radio(session):
                yield chunk
        finally:
            stream_engine.remove_session(session.session_id)

    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Session-Id": session.session_id,
        },
    )


@app.get("/stream/{track_id}")
async def stream_track(track_id: str):
    """Stream a specific track by ID."""
    track = library.get_track(track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    return StreamingResponse(
        stream_engine.stream_track(track),
        media_type="audio/mpeg",
        headers={"X-Track-Id": track.id},
    )
