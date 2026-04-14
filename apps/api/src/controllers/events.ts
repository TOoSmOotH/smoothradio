import { Request, Response } from 'express';
import { db, listeningEvents } from '@smoothradio/database';
import { AuthRequest } from '../middleware/auth';

export const trackListeningEvent = async (req: AuthRequest, res: Response) => {
  const { trackId, durationSeconds } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  if (!trackId) {
    res.status(400).json({ error: 'trackId is required' });
    return;
  }

  try {
    await db.insert(listeningEvents).values({
      userId,
      trackId,
      durationSeconds: durationSeconds ? Number.parseInt(durationSeconds, 10) : null,
    });

    res.status(201).json({ status: 'event tracked' });
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
