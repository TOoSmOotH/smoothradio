import { describe, it, expect } from 'vitest';

import {
  sanitizeField,
  sanitizeInput,
  sanitizeYear,
} from '../../apps/worker/src/categorization/sanitize';

describe('categorization sanitize helpers', () => {
  it('sanitizeField removes control chars and risky punctuation', () => {
    const raw = '  A\nrtist\t`{name}\\  ';
    expect(sanitizeField(raw)).toBe('A rtist name');
  });

  it('sanitizeField falls back for null and blank values', () => {
    expect(sanitizeField(null)).toBe('Unknown');
    expect(sanitizeField('   ', 'N/A')).toBe('N/A');
  });

  it('sanitizeYear keeps valid years and rejects invalid ranges', () => {
    expect(sanitizeYear('released in 1997 remaster')).toBe('1997');
    expect(sanitizeYear('1899')).toBe('Unknown');
    expect(sanitizeYear('2105')).toBe('Unknown');
    expect(sanitizeYear(undefined)).toBe('Unknown');
  });

  it('sanitizeInput applies defaults and normalization', () => {
    const input = sanitizeInput({
      artist: '  Miles\nDavis ',
      album: null,
      title: '  So What  ',
      currentGenre: undefined,
      year: '1959-08-17',
    });

    expect(input).toEqual({
      artist: 'Miles Davis',
      album: 'Unknown',
      title: 'So What',
      currentGenre: '',
      year: '1959',
    });
  });
});
