import express from 'express';
import { randomUUID } from 'node:crypto';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import expressRateLimit from 'express-rate-limit';

import { db, tracks } from '@smoothradio/database';
import { SecretStore } from '@smoothradio/crypto';
import { scanQueue, type ScanJob } from '@smoothradio/shared';
import { register, login } from './controllers/auth';
import { streamTrack } from './controllers/stream';
import { getTrackArtwork } from './controllers/artwork';
import { trackListeningEvent } from './controllers/events';
import { getArtistRecommendations } from './controllers/discovery';
import { createAICuratedPlaylist } from './controllers/playlist';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;
const defaultScanPath = process.env.MUSIC_LIBRARY_PATH?.trim();

const scanJobAttempts = (() => {
  const parsed = Number.parseInt(process.env.SCAN_JOB_ATTEMPTS || '3', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();

const scanJobBackoffMs = (() => {
  const parsed = Number.parseInt(process.env.SCAN_JOB_BACKOFF_MS || '2000', 10);
  return Number.isFinite(parsed) ? Math.max(500, parsed) : 2000;
})();

const secretStore = new SecretStore(
  process.env.SECRET_STORE_KEY || 'default-secret-key'
);

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/auth/', limiter);
app.use('/playlists/', limiter);

app.post('/auth/register', register);
app.post('/auth/login', login);

app.post('/playlists/curate', authenticate, createAICuratedPlaylist);
app.get('/discovery/recommendations', authenticate, getArtistRecommendations);
app.post('/events/listen', authenticate, trackListeningEvent);
app.get('/stream/:id', authenticate, streamTrack);
app.get('/tracks/:id/artwork', authenticate, getTrackArtwork);

function normalizeExtensions(rawExtensions?: unknown): string[] | undefined {
  if (!Array.isArray(rawExtensions)) {
    return undefined;
  }

  const cleaned = rawExtensions
    .map((item) =>
      typeof item === 'string'
        ? item.trim().toLowerCase()
        : ''
    )
    .filter((item) => item.length > 0)
    .map((item) => (item.startsWith('.') ? item : `.${item}`));

  return cleaned.length > 0 ? [...new Set(cleaned)] : undefined;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function parseLimit(raw: unknown): number {
  if (typeof raw !== 'string' || raw.length === 0) {
    return 100;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 100;
  }

  return Math.min(value, 500);
}

function parseOffset(raw: unknown): number {
  if (typeof raw !== 'string' || raw.length === 0) {
    return 0;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

app.get('/', (req, res) => {
  res.json({
    name: 'SmoothRadio API',
    version: '1.0.0',
    status: 'running',
    encryptedKey: secretStore.encrypt('test-key'),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/scan', async (req, res) => {
  const body = req.body ?? {};

  const candidatePath =
    typeof body.path === 'string' && body.path.trim().length > 0
      ? body.path.trim()
      : typeof body.rootPath === 'string' && body.rootPath.trim().length > 0
        ? body.rootPath.trim()
        : null;

  const rootPath = candidatePath
    ? path.resolve(candidatePath)
    : defaultScanPath
      ? path.resolve(defaultScanPath)
      : null;

  if (!rootPath) {
    res.status(400).json({
      error: 'Missing scan path',
      message: 'Provide `path` in request body or set MUSIC_LIBRARY_PATH',
    });
    return;
  }

  try {
    await access(rootPath, constants.R_OK);

    const rawMaxDepth =
      typeof body.maxDepth === 'number'
        ? body.maxDepth
        : typeof body.maxDepth === 'string'
          ? Number.parseInt(body.maxDepth, 10)
          : undefined;

    const maxDepth =
      typeof rawMaxDepth === 'number' && Number.isFinite(rawMaxDepth) && rawMaxDepth > 0
        ? Math.floor(rawMaxDepth)
        : undefined;

    const jobRequest: ScanJob = {
      rootPath,
      recursive: normalizeBoolean(body.recursive, true),
      maxDepth,
      includeHidden: normalizeBoolean(body.includeHidden, false),
      fileExtensions: normalizeExtensions(body.fileExtensions),
      requestId:
        typeof body.requestId === 'string' && body.requestId.trim().length > 0
          ? body.requestId.trim()
          : randomUUID(),
    };

    const job = await scanQueue.add('scan-root', jobRequest, {
      attempts: scanJobAttempts,
      backoff: {
        type: 'exponential',
        delay: scanJobBackoffMs,
      },
    });

    res.status(202).json({
      status: 'queued',
      queue: 'scans',
      jobId: job.id,
      requestId: jobRequest.requestId,
      rootPath: jobRequest.rootPath,
      recursive: jobRequest.recursive,
      maxDepth: jobRequest.maxDepth,
      includeHidden: jobRequest.includeHidden,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';

    if (message.toLowerCase().includes('eacces') || message.toLowerCase().includes('enoent')) {
      res.status(400).json({
        error: 'Cannot access scan path',
        message: `${rootPath} is not readable`,
      });
      return;
    }

    console.error('Failed to queue scan job', error);
    res.status(500).json({
      error: 'Failed to queue scan job',
      message,
    });
  }
});

app.get('/tracks', authenticate, async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);

  try {
    const rows = await db
      .select()
      .from(tracks)
      .limit(limit)
      .offset(offset);

    res.json({
      count: rows.length,
      limit,
      offset,
      items: rows,
    });
  } catch (error) {
    console.error('Failed to read tracks', error);
    res.status(500).json({
      error: 'Failed to read tracks',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
