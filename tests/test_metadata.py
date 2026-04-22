from pathlib import Path

import smoothradio.metadata as metadata


class _DummyInfo:
    def __init__(self, length=123.4, bitrate=192000, sample_rate=44100):
        self.length = length
        self.bitrate = bitrate
        self.sample_rate = sample_rate


class _DummyAudio:
    def __init__(self, info=None):
        self.info = info or _DummyInfo()


def test_generate_track_id_is_stable_and_short():
    p = "/tmp/music/song.mp3"
    a = metadata.generate_track_id(p)
    b = metadata.generate_track_id(p)

    assert a == b
    assert len(a) == 16


def test_extract_metadata_returns_none_for_unsupported_extension(tmp_path):
    file_path = tmp_path / "not-audio.txt"
    file_path.write_text("x")

    assert metadata.extract_metadata(file_path) is None


def test_extract_metadata_returns_none_when_mutagen_cannot_read(tmp_path, monkeypatch):
    file_path = tmp_path / "song.mp3"
    file_path.write_text("x")

    monkeypatch.setattr(metadata, "MutagenFile", lambda _: None)

    assert metadata.extract_metadata(file_path) is None


def test_extract_metadata_builds_track_metadata_from_audio_info(tmp_path, monkeypatch):
    file_path = tmp_path / "nested" / "song.mp3"
    file_path.parent.mkdir(parents=True)
    file_path.write_text("x")

    dummy_audio = _DummyAudio(_DummyInfo(length=200.0, bitrate=320000, sample_rate=48000))

    monkeypatch.setattr(metadata, "MutagenFile", lambda _: dummy_audio)
    monkeypatch.setattr(metadata, "_get_tag", lambda _audio, _path: "Track Title")
    monkeypatch.setattr(metadata, "_get_artist", lambda _audio: "Artist")
    monkeypatch.setattr(metadata, "_get_album", lambda _audio: "Album")
    monkeypatch.setattr(metadata, "_get_year", lambda _audio: 1998)

    result = metadata.extract_metadata(file_path)

    assert result is not None
    assert result.file_path == str(file_path)
    assert result.title == "Track Title"
    assert result.artist == "Artist"
    assert result.album == "Album"
    assert result.year == 1998
    assert result.duration_seconds == 200.0
    assert result.bitrate == 320000
    assert result.sample_rate == 48000
    assert result.format == "mp3"


def test_extract_metadata_returns_none_on_unexpected_exception(tmp_path, monkeypatch):
    file_path = tmp_path / "song.mp3"
    file_path.write_text("x")

    def _boom(_):
        raise RuntimeError("boom")

    monkeypatch.setattr(metadata, "MutagenFile", _boom)

    assert metadata.extract_metadata(file_path) is None


def test_get_year_parses_mp3_tdrc_tag(monkeypatch):
    class FakeMP3:
        def __init__(self, tags):
            self.tags = tags

    monkeypatch.setattr(metadata, "MP3", FakeMP3)

    audio = FakeMP3(tags={"TDRC": "1997-04-03"})

    assert metadata._get_year(audio) == 1997


def test_get_year_returns_none_for_invalid_values(monkeypatch):
    class FakeMP3:
        def __init__(self, tags):
            self.tags = tags

    monkeypatch.setattr(metadata, "MP3", FakeMP3)

    audio = FakeMP3(tags={"TDRC": "not-a-year"})

    assert metadata._get_year(audio) is None


def test_get_year_parses_flac_style_date(monkeypatch):
    class FakeFlac(dict):
        pass

    monkeypatch.setattr(metadata, "FLAC", FakeFlac)
    monkeypatch.setattr(metadata, "OggVorbis", type("FakeOgg", (), {}))

    audio = FakeFlac(date=["2001-06-01"])

    assert metadata._get_year(audio) == 2001
