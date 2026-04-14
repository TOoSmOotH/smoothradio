import { Request, Response } from 'express';
import fs from 'node:fs';
import { createReadStream, statSync } from 'node:fs';
import { db, tracks } from '@smoothradio/database';
import { eq } from '@smoothradio/database';

export const streamTrack = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);

    if (!track || !track.filePath) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }

    const stats = statSync(track.filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).json({ error: 'Requested range not satisfiable' });
        return;
      }

      const chunksize = (end - start) + 1;
      const file = createReadStream(track.filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      });

      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      });
      createReadStream(track.filePath).pipe(res);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
