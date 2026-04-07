"""FastAPI streaming server with file serving."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .library import TrackLibrary
from .streamer import StreamEngine

logger = logging.getLogger(__name__)

library = TrackLibrary(media_dir=settings.media_dir)
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


# --- Library API Endpoints ---


@app.get("/api/tracks")
async def list_tracks():
    """List all tracks in the library."""
    tracks = library.tracks
    return {
        "count": len(tracks),
        "tracks": [
            {
                "id": t.id,
                "title": t.metadata.title,
                "artist": t.metadata.artist,
                "album": t.metadata.album,
                "duration": t.metadata.duration_seconds,
                "format": t.metadata.format,
            }
            for t in tracks
        ],
    }


@app.get("/api/tracks/{track_id}")
async def get_track(track_id: str):
    """Get details for a specific track."""
    track = library.get_track(track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return {
        "id": track.id,
        "metadata": track.metadata.model_dump(exclude={"file_path"}),
    }


@app.post("/api/library/scan")
async def rescan_library():
    """Rescan the media directory for new tracks."""
    count = library.scan()
    return {"new_tracks": count, "total_tracks": len(library.tracks)}


@app.get("/api/library/stats")
async def library_stats():
    """Get library statistics."""
    tracks = library.tracks
    format_counts: dict[str, int] = {}
    for t in tracks:
        fmt = t.metadata.format
        format_counts[fmt] = format_counts.get(fmt, 0) + 1

    return {
        "total_tracks": len(tracks),
        "formats": format_counts,
    }


# --- Streaming Endpoints ---


@app.get("/stream")
async def stream_radio():
    """Stream continuous radio.

    Connect to this endpoint to receive a continuous audio stream.
    Tracks are selected randomly from the library.
    """
    session = stream_engine.create_session()

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

    if not track.path.exists():
        raise HTTPException(status_code=404, detail="Track file not found on disk")

    return StreamingResponse(
        stream_engine.stream_track(track),
        media_type="audio/mpeg",
        headers={"X-Track-Id": track.id},
    )


@app.get("/download/{track_id}")
async def download_track(track_id: str):
    """Download a track file directly."""
    track = library.get_track(track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = track.path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Track file not found on disk")

    # Ensure the file is within the configured media directory
    media_path = Path(settings.media_dir).resolve()
    resolved = file_path.resolve()
    if not str(resolved).startswith(str(media_path)):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        path=str(resolved),
        filename=file_path.name,
        media_type="audio/mpeg",
    )


# --- Static File Serving ---

static_path = Path(settings.static_dir)
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
