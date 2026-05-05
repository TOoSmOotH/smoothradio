import { createHash } from 'node:crypto';
import { mkdir, writeFile, access, constants, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AlbumArt } from './mp3-parser.js';

const DEFAULT_CACHE_DIR = process.env.ALBUM_ART_CACHE_PATH || '/data/album-art-cache';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
};

export interface CachedArt {
  filePath: string;
  mimeType: string;
  hash: string;
}

export class AlbumArtCache {
  private cacheDir: string;
  private initialized = false;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || DEFAULT_CACHE_DIR;
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.cacheDir, { recursive: true });
    this.initialized = true;
  }

  async store(art: AlbumArt): Promise<CachedArt> {
    await this.ensureDir();

    const hash = createHash('sha256').update(art.data).digest('hex');
    const ext = MIME_TO_EXT[art.mimeType.toLowerCase()] || '.jpg';
    const fileName = `${hash}${ext}`;
    const filePath = path.join(this.cacheDir, fileName);

    const exists = await this.fileExists(filePath);
    if (!exists) {
      await writeFile(filePath, art.data);
    }

    return { filePath, mimeType: art.mimeType, hash };
  }

  async get(hash: string): Promise<{ data: Buffer; mimeType: string } | null> {
    await this.ensureDir();

    for (const [mime, ext] of Object.entries(MIME_TO_EXT)) {
      const filePath = path.join(this.cacheDir, `${hash}${ext}`);
      if (await this.fileExists(filePath)) {
        const data = await readFile(filePath);
        return { data, mimeType: mime };
      }
    }
    return null;
  }

  getFilePath(hash: string, mimeType: string): string {
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || '.jpg';
    return path.join(this.cacheDir, `${hash}${ext}`);
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
