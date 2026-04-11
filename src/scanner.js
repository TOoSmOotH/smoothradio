const fs = require('fs').promises;
const path = require('path');

const MP3_EXTENSION = '.mp3';
const DEFAULT_MAX_DEPTH = 32;

async function loadMusicMetadata() {
  return await import('music-metadata');
}

// Sanitize a metadata string coming from an untrusted file.
// ID3/Vorbis tags are attacker-controlled, so they must not be trusted
// as commands (IRC/Twitch bridges interpret a leading "/" as a command)
// or as HTML (web dashboards rendering tags would be vulnerable to XSS).
// Downstream consumers should still escape for their specific context.
function sanitizeTagString(value) {
  if (value == null) return null;
  const str = String(value);

  // Strip control characters (including NUL, CR, LF, BEL) that can corrupt
  // log lines, terminal output, or IRC protocol framing.
  let cleaned = str.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove HTML tag-like sequences to defang trivial XSS payloads.
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  cleaned = cleaned.trim();

  // Neutralize leading command prefixes so tag content cannot be
  // interpreted as an IRC/Twitch slash command by a downstream bridge.
  if (cleaned.startsWith('/') || cleaned.startsWith('!') || cleaned.startsWith('.')) {
    cleaned = ' ' + cleaned;
  }

  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeYear(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function sanitizeDuration(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function extractMetadata(filePath, mm) {
  const metadata = await mm.parseFile(filePath);
  const common = metadata.common || {};
  const genre = Array.isArray(common.genre) && common.genre.length > 0 ? common.genre[0] : null;

  return {
    filePath,
    artist: sanitizeTagString(common.artist),
    albumArtist: sanitizeTagString(common.albumartist),
    album: sanitizeTagString(common.album),
    title: sanitizeTagString(common.title),
    genre: sanitizeTagString(genre),
    year: sanitizeYear(common.year),
    duration: sanitizeDuration(metadata.format ? metadata.format.duration : null),
  };
}

// Iterative walk using an explicit stack. A recursive walk would be
// vulnerable to stack exhaustion on pathological directory layouts
// (extremely deep nesting). The `maxDepth` guard bounds traversal even
// when the filesystem itself is adversarial.
async function walk(rootDir, results, mm, onError, maxDepth) {
  const stack = [{ dir: rootDir, depth: 0 }];

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();

    if (depth > maxDepth) {
      if (onError) onError(dir, new Error(`max depth ${maxDepth} exceeded`));
      continue;
    }

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (onError) onError(dir, err);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        stack.push({ dir: fullPath, depth: depth + 1 });
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
}

async function scanDirectory(rootDir, options = {}) {
  const { onError, maxDepth = DEFAULT_MAX_DEPTH } = options;
  const resolvedRoot = path.resolve(rootDir);

  const stat = await fs.stat(resolvedRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedRoot}`);
  }

  const mm = await loadMusicMetadata();
  const results = [];
  await walk(resolvedRoot, results, mm, onError, maxDepth);
  return results;
}

module.exports = {
  scanDirectory,
  extractMetadata,
  sanitizeTagString,
};
