import {
  access,
  constants,
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import path from 'node:path';

import { aiQueue, type ScanJob } from '@smoothradio/shared';
import { db, tracks } from '@smoothradio/database';
import { parseID3Tags, extractAlbumArt, AlbumArtCache, type MP3Metadata } from '@smoothradio/shared';

const albumArtCache = new AlbumArtCache(process.env.ALBUM_ART_CACHE_PATH);

export interface ScanSummary {
  rootPath: string;
  scanned: number;
  queued: number;
  skipped: number;
  errors: number;
}

const DEFAULT_EXTENSIONS = ['.mp3'];
const AI_JOB_ATTEMPTS = (() => {
  const parsed = Number.parseInt(process.env.AI_JOB_ATTEMPTS || '3', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();

const AI_JOB_BACKOFF_MS = (() => {
  const parsed = Number.parseInt(process.env.AI_JOB_BACKOFF_MS || '5000', 10);
  return Number.isFinite(parsed) ? Math.max(1000, parsed) : 5000;
})();

type ScanOptions = {
  recursive: boolean;
  maxDepth: number | undefined;
  includeHidden: boolean;
  extensions: string[];
};

export async function processScanJob(job: ScanJob): Promise<ScanSummary> {
  const rootPath = path.resolve(job.rootPath);
  const options: ScanOptions = {
    recursive: job.recursive !== false,
    maxDepth:
      typeof job.maxDepth === 'number' && job.maxDepth > 0
        ? job.maxDepth
        : undefined,
    includeHidden: job.includeHidden === true,
    extensions: normalizeExtensions(job.fileExtensions),
  };

  const summary: ScanSummary = {
    rootPath,
    scanned: 0,
    queued: 0,
    skipped: 0,
    errors: 0,
  };

  await access(rootPath, constants.R_OK);

  const filePaths = await listMp3Files(rootPath, options);
  for (const filePath of filePaths) {
    summary.scanned += 1;
    try {
      const fileBuffer = await readFile(filePath);
      const metadata = parseID3Tags(fileBuffer);
      const artResult = await extractAndCacheArt(fileBuffer);
      const track = await upsertTrack(filePath, metadata, artResult);

      if (!track.isCategorized) {
        await aiQueue.add(
          'categorize-track',
          {
            trackId: track.id,
            filePath,
            artist: metadata.artist ?? null,
            title: metadata.title ?? null,
          },
          {
            jobId: track.id,
            attempts: AI_JOB_ATTEMPTS,
            backoff: {
              type: 'exponential',
              delay: AI_JOB_BACKOFF_MS,
            },
          }
        );
        summary.queued += 1;
      } else {
        summary.skipped += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}

interface ArtResult {
  hash: string;
  mimeType: string;
}

async function extractAndCacheArt(buffer: Buffer): Promise<ArtResult | null> {
  const art = extractAlbumArt(buffer);
  if (!art) return null;
  const cached = await albumArtCache.store(art);
  return { hash: cached.hash, mimeType: cached.mimeType };
}

async function upsertTrack(
  filePath: string,
  metadata: MP3Metadata,
  artResult: ArtResult | null
): Promise<{ id: string; isCategorized: boolean }> {
  const now = new Date();
  const values = {
    filePath,
    fileName: path.basename(filePath),
    title: sanitize(metadata.title),
    artist: sanitize(metadata.artist),
    album: sanitize(metadata.album),
    genre: sanitize(metadata.genre),
    year: parseYear(metadata.year),
    duration: metadata.duration,
    artworkHash: artResult?.hash ?? null,
    artworkMimeType: artResult?.mimeType ?? null,
    metadata: {
      ...metadata,
      scannedAt: now.toISOString(),
    },
    updatedAt: now,
  };

  const [track] = await db
    .insert(tracks)
    .values(values)
    .onConflictDoUpdate({
      target: tracks.filePath,
      set: {
        fileName: values.fileName,
        title: values.title,
        artist: values.artist,
        album: values.album,
        genre: values.genre,
        year: values.year,
        duration: values.duration,
        artworkHash: values.artworkHash,
        artworkMimeType: values.artworkMimeType,
        metadata: values.metadata,
        updatedAt: now,
      },
    })
    .returning({ id: tracks.id, isCategorized: tracks.isCategorized });

  if (!track) {
    throw new Error(`Failed to upsert track record for ${filePath}`);
  }

  return track;
}

async function listMp3Files(rootPath: string, options: ScanOptions): Promise<string[]> {
  const rootStats = await stat(rootPath);

  if (!rootStats.isDirectory()) {
    if (rootStats.isFile() && hasSupportedExtension(rootPath, options.extensions)) {
      return [rootPath];
    }

    return [];
  }

  const files: string[] = [];

  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!options.includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const resolved = path.join(rootPath, entry.name);

    if (entry.isDirectory() && options.recursive) {
      const nested = await listMp3FilesRecursive(resolved, options, 1);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && hasSupportedExtension(resolved, options.extensions)) {
      files.push(resolved);
    }
  }

  return files;
}

async function listMp3FilesRecursive(
  currentPath: string,
  options: ScanOptions,
  depth: number
): Promise<string[]> {
  if (
    typeof options.maxDepth === 'number' &&
    depth > options.maxDepth
  ) {
    return [];
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!options.includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const resolved = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await listMp3FilesRecursive(
        resolved,
        options,
        depth + 1
      );
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && hasSupportedExtension(resolved, options.extensions)) {
      files.push(resolved);
    }
  }

  return files;
}

function normalizeExtensions(rawExtensions?: string[]): string[] {
  if (!rawExtensions || rawExtensions.length === 0) {
    return DEFAULT_EXTENSIONS;
  }

  const deduped = rawExtensions
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .map((value) => (value.startsWith('.') ? value : `.${value}`));

  return deduped.length > 0 ? [...new Set(deduped)] : DEFAULT_EXTENSIONS;
}

function hasSupportedExtension(filePath: string, extensions: string[]): boolean {
  const normalized = path.extname(filePath).toLowerCase();
  return extensions.includes(normalized);
}

function parseYear(value?: string): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{4})/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2090) {
    return null;
  }

  return year;
}

function sanitize(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
