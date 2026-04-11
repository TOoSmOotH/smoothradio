import json
from pathlib import Path

import smoothradio.library as library
from smoothradio.models import Genre, Mood, TrackCategory, TrackMetadata


class DummyCategorizer:
    async def categorize_track(self, track):
        return TrackCategory(
            genre=Genre.OTHER,
            sub_genre="uncategorized",
            decade=None,
            moods=[Mood.CHILL],
            energy_level=0.5,
            tags=["x"],
            description="x",
        )

    async def categorize_batch(self, tracks):
        return [await self.categorize_track(t) for t in tracks]


def _mk_meta(path: Path) -> TrackMetadata:
    return TrackMetadata(
        file_path=str(path),
        title=path.stem,
        artist="Artist",
        album="Album",
        year=2005,
        duration_seconds=180.0,
        bitrate=192000,
        sample_rate=44100,
        format=path.suffix.lstrip("."),
    )


def test_scan_recursively_finds_supported_files_and_dedupes(tmp_path, monkeypatch):
    (tmp_path / "a.mp3").write_text("x")
    (tmp_path / "nested").mkdir()
    (tmp_path / "nested" / "b.flac").write_text("x")
    (tmp_path / "nested" / "ignore.txt").write_text("x")

    def fake_extract(path: Path):
        return _mk_meta(path)

    monkeypatch.setattr(library, "extract_metadata", fake_extract)
    monkeypatch.setattr(library, "generate_track_id", lambda p: f"id:{Path(p).name}")

    lib = library.TrackLibrary(str(tmp_path), DummyCategorizer())

    assert lib.scan() == 2
    assert len(lib.tracks) == 2

    # Running again should not duplicate existing tracks
    assert lib.scan() == 0
    assert len(lib.tracks) == 2


def test_scan_returns_zero_for_missing_media_directory(tmp_path):
    missing = tmp_path / "does-not-exist"
    lib = library.TrackLibrary(str(missing), DummyCategorizer())

    assert lib.scan() == 0
    assert lib.tracks == []


def test_scan_skips_files_with_unreadable_metadata(tmp_path, monkeypatch):
    (tmp_path / "ok.mp3").write_text("x")
    (tmp_path / "bad.mp3").write_text("x")

    def fake_extract(path: Path):
        if path.name == "bad.mp3":
            return None
        return _mk_meta(path)

    monkeypatch.setattr(library, "extract_metadata", fake_extract)
    monkeypatch.setattr(library, "generate_track_id", lambda p: f"id:{Path(p).name}")

    lib = library.TrackLibrary(str(tmp_path), DummyCategorizer())

    assert lib.scan() == 1
    assert [t.metadata.file_path for t in lib.tracks] == [str(tmp_path / "ok.mp3")]


def test_scan_loads_saved_categories_for_discovered_tracks(tmp_path, monkeypatch):
    track_path = tmp_path / "song.mp3"
    track_path.write_text("x")

    track_id = "track-1"
    category_payload = {
        track_id: {
            "genre": "rock",
            "sub_genre": "alt rock",
            "decade": 1990,
            "moods": ["energetic"],
            "energy_level": 0.8,
            "tags": ["guitar"],
            "description": "Loud and driven",
            "bpm_estimate": 140,
        }
    }
    (tmp_path / ".smoothradio_categories.json").write_text(json.dumps(category_payload))

    monkeypatch.setattr(library, "extract_metadata", lambda p: _mk_meta(p))
    monkeypatch.setattr(library, "generate_track_id", lambda _p: track_id)

    lib = library.TrackLibrary(str(tmp_path), DummyCategorizer())

    assert lib.scan() == 1
    track = lib.get_track(track_id)
    assert track is not None
    assert track.category is not None
    assert track.category.genre == Genre.ROCK
    assert track.category.moods == [Mood.ENERGETIC]


def test_scan_ignores_corrupt_saved_categories_file(tmp_path, monkeypatch):
    (tmp_path / "song.mp3").write_text("x")
    (tmp_path / ".smoothradio_categories.json").write_text("{not-json")

    monkeypatch.setattr(library, "extract_metadata", lambda p: _mk_meta(p))
    monkeypatch.setattr(library, "generate_track_id", lambda _p: "track-1")

    lib = library.TrackLibrary(str(tmp_path), DummyCategorizer())

    assert lib.scan() == 1
    track = lib.get_track("track-1")
    assert track is not None
    assert track.category is None
