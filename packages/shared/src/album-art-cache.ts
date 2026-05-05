import { createHash } from 'node:crypto';
import { mkdir, writeFile, access, constants, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AlbumArt } from './mp3-parser.js';

const DEFAULT_CACHE_DIR = process.env.ALBUM_ART_CACHE_PATH || '/data/album-art-cache';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MIME_ALIASES: Record<string, AllowedMimeType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/x-png': 'image/png',
  'image/webp': 'image/webp',
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export function normalizeMimeType(mimeType: string | null | undefined): AllowedMimeType | null {
  if (!mimeType) return null;
  const normalized = mimeType.trim().toLowerCase();
  return MIME_ALIASES[normalized] ?? null;
}

export function isValidArtworkHash(hash: string | null | undefined): hash is string {
  return typeof hash === 'string' && HASH_PATTERN.test(hash);
}

export interface CachedArt {
  filePath: string;
  mimeType: AllowedMimeType;
  hash: string;
}

export class AlbumArtCache {
  private cacheDir: string;
  private initialized = false;

  constructor(cacheDir?: string) {
    this.cacheDir = path.resolve(cacheDir || DEFAULT_CACHE_DIR);
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.cacheDir, { recursive: true });
    this.initialized = true;
  }

  async store(art: AlbumArt): Promise<CachedArt | null> {
    const safeMime = normalizeMimeType(art.mimeType);
    if (!safeMime) {
      return null;
    }

    await this.ensureDir();

    const hash = createHash('sha256').update(art.data).digest('hex');
    const ext = MIME_TO_EXT[safeMime];
    const fileName = `${hash}${ext}`;
    const filePath = path.join(this.cacheDir, fileName);

    const exists = await this.fileExists(filePath);
    if (!exists) {
      await writeFile(filePath, art.data);
    }

    return { filePath, mimeType: safeMime, hash };
  }

  async get(hash: string): Promise<{ data: Buffer; mimeType: AllowedMimeType } | null> {
    if (!isValidArtworkHash(hash)) {
      return null;
    }

    await this.ensureDir();

    for (const mime of ALLOWED_MIME_TYPES) {
      const ext = MIME_TO_EXT[mime];
      const filePath = path.join(this.cacheDir, `${hash}${ext}`);
      if (await this.fileExists(filePath)) {
        const data = await readFile(filePath);
        return { data, mimeType: mime };
      }
    }
    return null;
  }

  getFilePath(hash: string, mimeType: string): string | null {
    if (!isValidArtworkHash(hash)) {
      return null;
    }
    const safeMime = normalizeMimeType(mimeType);
    if (!safeMime) {
      return null;
    }
    return path.join(this.cacheDir, `${hash}${MIME_TO_EXT[safeMime]}`);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
