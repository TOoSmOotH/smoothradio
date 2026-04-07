import { parseFile } from "music-metadata";
import type { TrackMetadata } from "./types.js";

const DEFAULT_METADATA: TrackMetadata = {
  title: null,
  artist: null,
  album: null,
  albumArtist: null,
  genre: [],
  year: null,
  trackNumber: null,
  discNumber: null,
  duration: null,
  bitrate: null,
  sampleRate: null,
  channels: null,
  codec: null,
  lossless: false,
};

export async function extractMetadata(
  filePath: string
): Promise<TrackMetadata> {
  const parsed = await parseFile(filePath, { skipCovers: true });
  const { common, format } = parsed;

  return {
    ...DEFAULT_METADATA,
    title: common.title ?? null,
    artist: common.artist ?? null,
    album: common.album ?? null,
    albumArtist: common.albumartist ?? null,
    genre: common.genre ?? [],
    year: common.year ?? null,
    trackNumber: common.track?.no ?? null,
    discNumber: common.disk?.no ?? null,
    duration: format.duration ?? null,
    bitrate: format.bitrate ?? null,
    sampleRate: format.sampleRate ?? null,
    channels: format.numberOfChannels ?? null,
    codec: format.codec ?? null,
    lossless: format.lossless ?? false,
  };
}
