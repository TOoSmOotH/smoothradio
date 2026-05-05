const MAX_FIELD_LENGTH = 200;
// Strip ASCII control bytes (newlines, tabs, escapes) and DEL — these are
// the typical vectors for prompt-injection inside ID3 metadata.
const CONTROL_CHARS = /[\x00-\x1f\x7f]+/g;
const RISKY_PUNCTUATION = /[`{}\\]/g;

export type CategorizationInput = {
  artist: string;
  album: string;
  title: string;
  currentGenre: string;
  year: string;
};

export function sanitizeField(
  value: string | null | undefined,
  fallback = 'Unknown'
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const collapsed = value
    .replace(CONTROL_CHARS, ' ')
    .replace(RISKY_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!collapsed) {
    return fallback;
  }

  if (collapsed.length > MAX_FIELD_LENGTH) {
    return `${collapsed.slice(0, MAX_FIELD_LENGTH - 1)}…`;
  }

  return collapsed;
}

export function sanitizeYear(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const match = value.match(/(\d{4})/);
  if (!match) {
    return 'Unknown';
  }

  const year = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2099) {
    return 'Unknown';
  }

  return String(year);
}

export function sanitizeInput(raw: {
  artist?: string | null;
  album?: string | null;
  title?: string | null;
  currentGenre?: string | null;
  year?: string | null;
}): CategorizationInput {
  return {
    artist: sanitizeField(raw.artist),
    album: sanitizeField(raw.album),
    title: sanitizeField(raw.title),
    currentGenre: sanitizeField(raw.currentGenre, ''),
    year: sanitizeYear(raw.year),
  };
}
