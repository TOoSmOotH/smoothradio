import { describe, it, expect, vi } from 'vitest';

import {
  CategorizationEngine,
  CategorizationError,
  type Buckets,
  type LLMConfig,
} from '../../apps/worker/src/categorization';

const baseConfig: LLMConfig = {
  endpoint: 'http://localhost:8080',
  apiKey: 'test-key',
  model: 'test-model',
  temperature: 0.2,
  maxTokens: 128,
  timeoutMs: 1000,
};

const buckets: Buckets = {
  genres: ['Rock', 'Pop', 'Hip-Hop', 'Jazz'],
  decades: ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'],
};

describe('CategorizationEngine', () => {
  it('categorizes using AI response and normalizes fields', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"genre":"hip hop","decade":"1990s"}' } }],
        }),
        { status: 200 }
      )
    );

    const engine = new CategorizationEngine(baseConfig, {
      fetchImpl,
      loadBucketsImpl: async () => buckets,
    });

    const result = await engine.categorize({
      artist: 'Nas',
      album: 'Illmatic',
      title: 'N.Y. State of Mind',
      currentGenre: 'Rap',
      year: '1994',
    });

    expect(result).toEqual({
      genre: 'Hip-Hop',
      decade: '1990s',
      bucketsVersion: buckets.genres.length,
      fromFallback: false,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('uses fallback from input genre/year when AI output is unusable', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"genre":"","decade":""}' } }],
        }),
        { status: 200 }
      )
    );

    const engine = new CategorizationEngine(baseConfig, {
      fetchImpl,
      loadBucketsImpl: async () => buckets,
    });

    const result = await engine.categorize({
      artist: 'Unknown',
      album: 'Unknown',
      title: 'Unknown',
      currentGenre: 'classic rock',
      year: '1978',
    });

    expect(result).toEqual({
      genre: 'Rock',
      decade: '1970s',
      bucketsVersion: buckets.genres.length,
      fromFallback: true,
    });
  });

  it('throws CategorizationError on non-OK endpoint response', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));

    const engine = new CategorizationEngine(baseConfig, {
      fetchImpl,
      loadBucketsImpl: async () => buckets,
    });

    await expect(
      engine.categorize({ artist: 'a', album: 'b', title: 'c', currentGenre: 'd', year: '2001' })
    ).rejects.toThrow(CategorizationError);
  });

  it('throws for invalid endpoint at construction time', () => {
    expect(
      () => new CategorizationEngine({ ...baseConfig, endpoint: 'not-a-url' }, { loadBucketsImpl: async () => buckets })
    ).toThrow('LLM endpoint must be an http(s) URL');
  });
});
