import { Request, Response } from 'express';
import { db, tracks } from '@smoothradio/database';
import { eq } from '@smoothradio/database';
import { AlbumArtCache, isValidArtworkHash } from '@smoothradio/shared';

const artCache = new AlbumArtCache(process.env.ALBUM_ART_CACHE_PATH);

export const getTrackArtwork = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [track] = await db
      .select({
        artworkHash: tracks.artworkHash,
      })
      .from(tracks)
      .where(eq(tracks.id, id))
      .limit(1);

    if (!track || !track.artworkHash || !isValidArtworkHash(track.artworkHash)) {
      res.status(404).json({ error: 'Artwork not found' });
      return;
    }

    const art = await artCache.get(track.artworkHash);
    if (!art) {
      res.status(404).json({ error: 'Artwork file missing from cache' });
      return;
    }

    const etag = `"${track.artworkHash}"`;
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.set({
      'Content-Type': art.mimeType,
      'Content-Length': String(art.data.length),
      'Cache-Control': 'public, max-age=86400, immutable',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(art.data);
  } catch (error) {
    console.error('Artwork retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
