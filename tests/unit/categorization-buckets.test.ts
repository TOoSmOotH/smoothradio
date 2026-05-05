import { describe, it, expect } from 'vitest';

import {
  normalizeDecade,
  normalizeGenre,
} from '../../apps/worker/src/categorization/buckets';

describe('categorization bucket normalization', () => {
  const allowedGenres = ['Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Electronic'];

  it('normalizes known aliases to canonical genres', () => {
    expect(normalizeGenre('hip hop', allowedGenres)).toBe('Hip-Hop');
    expect(normalizeGenre('EDM', allowedGenres)).toBe('Electronic');
  });

  it('uses containment matching against allowed genres', () => {
    expect(normalizeGenre('indie rock', allowedGenres)).toBe('Rock');
  });

  it('title-cases unknown non-empty genres', () => {
    expect(normalizeGenre('post punk revival', allowedGenres)).toBe('Post Punk Revival');
  });

  it('returns null for empty genre input', () => {
    expect(normalizeGenre('   ', allowedGenres)).toBeNull();
  });

  it('normalizes decade from explicit decade token', () => {
    expect(normalizeDecade('Sound: 1980s synth', '2003')).toBe('1980s');
  });

  it('falls back to year when decade is missing', () => {
    expect(normalizeDecade('', '2003 remaster')).toBe('2000s');
  });

  it('returns null when both decade and fallback year are invalid', () => {
    expect(normalizeDecade('future', 'abcd')).toBeNull();
  });
});
