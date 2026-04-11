const fs = require('fs').promises;
const path = require('path');

const MP3_EXTENSION = '.mp3';

async function loadMusicMetadata() {
  return await import('music-metadata');
}

async function extractMetadata(filePath, mm) {
  const metadata = await mm.parseFile(filePath);
  const common = metadata.common || {};

  return {
    filePath,
    artist: common.artist || null,
    albumArtist: common.albumartist || null,
    album: common.album || null,
    title: common.title || null,
    genre: Array.isArray(common.genre) && common.genre.length > 0 ? common.genre[0] : null,
    year: common.year || null,
    duration: metadata.format ? metadata.format.duration || null : null,
  };
}

async function walk(dir, results, mm, onError) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (onError) onError(dir, err);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath, results, mm, onError);
      continue;
    }

    if (!entry.isFile()) continue;
    if (path.extname(entry.name).toLowerCase() !== MP3_EXTENSION) continue;

    try {
      const track = await extractMetadata(fullPath, mm);
      results.push(track);
    } catch (err) {
      if (onError) onError(fullPath, err);
    }
  }
}

async function scanDirectory(rootDir, options = {}) {
  const { onError } = options;
  const resolvedRoot = path.resolve(rootDir);

  const stat = await fs.stat(resolvedRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedRoot}`);
  }

  const mm = await loadMusicMetadata();
  const results = [];
  await walk(resolvedRoot, results, mm, onError);
  return results;
}

module.exports = {
  scanDirectory,
  extractMetadata,
};
