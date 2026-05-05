import { db, eq, tracks } from '@smoothradio/database';

import {
  CategorizationEngine,
  CategorizationError,
  resolveLLMApiKey,
  type CategorizationResult,
  type LLMConfig,
} from './categorization/index.js';

export type AICategorizationJob = {
  trackId: string;
  filePath: string;
  artist?: string | null;
  title?: string | null;
};

const DEFAULT_TIMEOUT_MS = 30_000;

let cachedEngine: CategorizationEngine | null = null;
let cachedConfig: LLMConfig | null = null;

export function buildLLMConfig(env: NodeJS.ProcessEnv = process.env): LLMConfig {
  const endpoint = (env.LLM_ENDPOINT || 'http://localhost:11434').trim();
  const model = (env.LLM_MODEL_NAME || 'llama3').trim();
  const temperature = parseNumber(env.LLM_TEMPERATURE, 0.2, 0, 2);
  const maxTokens = parseNumber(env.LLM_MAX_TOKENS, 256, 16, 4096);
  const timeoutMs = parseNumber(env.LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 120_000);

  return {
    endpoint,
    apiKey: resolveLLMApiKey(env),
    model,
    temperature,
    maxTokens,
    timeoutMs,
  };
}

export function getEngine(): CategorizationEngine {
  if (!cachedEngine || !cachedConfig) {
    cachedConfig = buildLLMConfig();
    cachedEngine = new CategorizationEngine(cachedConfig);
  }
  return cachedEngine;
}

export function resetEngineForTesting(): void {
  cachedEngine = null;
  cachedConfig = null;
}

export async function categorizeTrack(
  trackId: string,
  filePath: string,
  artist?: string | null,
  title?: string | null
): Promise<void> {
  return processAIJob({ trackId, filePath, artist, title });
}

export async function processAIJob(job: AICategorizationJob): Promise<void> {
  const trackRow = await loadTrackRow(job.trackId);

  if (!trackRow) {
    throw new Error(`Track ${job.trackId} not found`);
  }

  const engine = getEngine();
  let result: CategorizationResult;
  try {
    result = await engine.categorize({
      artist: job.artist ?? trackRow.artist,
      album: trackRow.album,
      title: job.title ?? trackRow.title,
      currentGenre: trackRow.genre,
      year: trackRow.year !== null ? String(trackRow.year) : null,
    });
  } catch (error) {
    if (error instanceof CategorizationError) {
      console.error(`AI categorization failed for track ${job.trackId}: ${error.message}`);
    } else {
      console.error(`AI categorization failed for track ${job.trackId}`);
    }
    throw error;
  }

  await persistResult(job.trackId, result, cachedConfig!);

  console.log(
    `Categorized track ${job.trackId} as ${result.genre} / ${result.decade}` +
      (result.fromFallback ? ' (fallback)' : '')
  );
}

async function loadTrackRow(trackId: string) {
  const [row] = await db
    .select({
      artist: tracks.artist,
      album: tracks.album,
      title: tracks.title,
      genre: tracks.genre,
      year: tracks.year,
      metadata: tracks.metadata,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  return row ?? null;
}

async function persistResult(
  trackId: string,
  result: CategorizationResult,
  config: LLMConfig
): Promise<void> {
  const [row] = await db
    .select({ metadata: tracks.metadata })
    .from(tracks)
    .where(eq(tracks.id, trackId));

  const existing = (row?.metadata as Record<string, unknown> | undefined) ?? {};
  const aiBlock = (existing.ai as Record<string, unknown> | undefined) ?? {};

  const nextMetadata = {
    ...existing,
    ai: {
      ...aiBlock,
      category: { genre: result.genre, decade: result.decade },
      model: config.model,
      endpoint: config.endpoint,
      bucketsVersion: result.bucketsVersion,
      fromFallback: result.fromFallback,
      updatedAt: new Date().toISOString(),
    },
  };

  await db
    .update(tracks)
    .set({
      genre: result.genre,
      decade: result.decade,
      isCategorized: true,
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(eq(tracks.id, trackId));
}

function parseNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}
