import { Request, Response } from 'express';
import { db, tracks } from '@smoothradio/database';
import { eq, and } from '@smoothradio/database';

export const getArtistRecommendations = async (req: Request, res: Response) => {
  const { artist } = req.query;

  if (!artist || typeof artist !== 'string') {
    res.status(400).json({ error: 'Artist name is required' });
    return;
  }

  try {
    // Basic recommendation logic: find tracks with similar genres to the given artist
    const [targetTracks] = await db.select()
      .from(tracks)
      .where(eq(tracks.artist, artist))
      .limit(1);

    if (!targetTracks || !targetTracks.genre) {
      res.status(404).json({ error: 'Artist not found or has no genre' });
      return;
    }

    const genre = targetTracks.genre;

    const recommendations = await db.select()
      .from(tracks)
      .where(and(
        eq(tracks.genre, genre),
        // Avoid recommending the same artist
        // Note: Drizzle 'notEq' or similar is needed, but for simplicity we filter in JS or use a raw query
      ))
      .limit(20);

    const filtered = recommendations.filter(t => t.artist !== artist);

    res.json({
      artist,
      genre,
      recommendations: filtered
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
