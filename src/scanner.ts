import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { extractMetadata } from "./metadata.js";
import type {
  ScannedTrack,
  ScanResult,
  ScanError,
  ScanOptions,
} from "./types.js";

const DEFAULT_EXTENSIONS = [".mp3", ".flac", ".ogg", ".m4a", ".wav", ".aac", ".wma", ".opus"];
const DEFAULT_CONCURRENCY = 4;

async function collectAudioFiles(
  directory: string,
  extensions: string[],
  recursive: boolean
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory() && recursive) {
      const nested = await collectAudioFiles(fullPath, extensions, recursive);
      files.push(...nested);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function processFile(filePath: string): Promise<ScannedTrack> {
  const [metadata, fileStat] = await Promise.all([
    extractMetadata(filePath),
    stat(filePath),
  ]);

  return {
    filePath,
    fileName: basename(filePath),
    fileSize: fileStat.size,
    lastModified: fileStat.mtime,
    metadata,
  };
}

async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<{ results: R[]; errors: { item: T; error: string }[] }> {
  const results: R[] = [];
  const errors: { item: T; error: string }[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        results.push(await fn(item));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ item, error: message });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);

  return { results, errors };
}

export async function scanDirectory(
  directory: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const {
    recursive = true,
    extensions = DEFAULT_EXTENSIONS,
    onProgress,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  const normalizedExtensions = extensions.map((e) =>
    e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
  );

  const audioPaths = await collectAudioFiles(
    directory,
    normalizedExtensions,
    recursive
  );

  let scannedCount = 0;
  const { results: tracks, errors: rawErrors } = await processInBatches(
    audioPaths,
    concurrency,
    async (filePath) => {
      const track = await processFile(filePath);
      scannedCount++;
      onProgress?.(scannedCount, audioPaths.length);
      return track;
    }
  );

  const errors: ScanError[] = rawErrors.map(({ item, error }) => ({
    filePath: item,
    error,
  }));

  const totalDuration = tracks.reduce(
    (sum, t) => sum + (t.metadata.duration ?? 0),
    0
  );

  return {
    tracks,
    errors,
    scannedAt: new Date(),
    totalFiles: audioPaths.length,
    totalDuration,
  };
}
