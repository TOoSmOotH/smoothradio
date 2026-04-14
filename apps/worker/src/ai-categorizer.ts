import { readFile } from 'node:fs/promises';

import {
  LLMFactory,
  type LLMProviderConfig,
  parseID3Tags,
} from '@smoothradio/shared';
import { db, eq, tracks } from '@smoothradio/database';

type SupportedProvider = LLMProviderConfig['providerType'];

const DEFAULT_DECADES = [
  '1920s',
  '1930s',
  '1940s',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
  '2030s',
];

const GENRE_ALIASES: Record<string, string> = {
  'classic rock': 'Rock',
  'hard rock': 'Rock',
  'pop music': 'Pop',
  'hip hop': 'Hip-Hop',
  'r&b': 'R&B',
  'rhythm and blues': 'R&B',
  'electronic dance': 'Electronic',
  'synth pop': 'Electronic',
  'swing jazz': 'Jazz',
  'vocal jazz': 'Jazz',
};

const LLM_PROVIDER =
  (process.env.LLM_PROVIDER as SupportedProvider) || 'ollama';
const LLM_ENDPOINT = process.env.LLM_ENDPOINT || 'http://localhost:11434';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || 'llama3';
const configuredTemperature = Number(process.env.LLM_TEMPERATURE || '0.4');
const configuredMaxTokens = Number(process.env.LLM_MAX_TOKENS || '500');

const llmConfig: LLMProviderConfig = {
  providerType: LLM_PROVIDER,
  endpoint: LLM_ENDPOINT,
  apiKey: LLM_API_KEY || undefined,
  modelName: LLM_MODEL_NAME,
  temperature: Number.isNaN(configuredTemperature) ? 0.4 : configuredTemperature,
  maxTokens: Number.isNaN(configuredMaxTokens) ? 500 : configuredMaxTokens,
};

const llmProvider = LLMFactory.createProvider(llmConfig);

export type AICategorizationJob = {
  trackId: string;
  filePath: string;
  artist?: string | null;
  title?: string | null;
};

export async function categorizeTrack(
  trackId: string,
  filePath: string,
  artist?: string | null,
  title?: string | null
): Promise<void> {
  return processAIJob({
    trackId,
    filePath,
    artist,
    title,
  });
}

export async function processAIJob(job: AICategorizationJob): Promise<void> {
  console.log(`Processing AI job for track: ${job.trackId}`);

  try {
    const buffer = await readFile(job.filePath);
    const metadata = parseID3Tags(buffer);

    const artist = job.artist || metadata.artist || 'Unknown';
    const title = job.title || metadata.title || 'Unknown';
    const album = metadata.album || 'Unknown';
    const currentGenre = metadata.genre || 'Unknown';
    const year = metadata.year || undefined;

    const prompt = buildPrompt({
      artist,
      title,
      album,
      currentGenre,
      year,
    });

    const response = await llmProvider.generate([
      {
        role: 'system',
        content:
          'You are a music expert. Return ONLY a valid JSON object with "genre" and "decade".',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const rawResult = parseAiJson(response.content);
    const normalized = normalizeResult(rawResult, year);

    await db
      .update(tracks)
      .set({
        genre: normalized.genre,
        decade: normalized.decade,
        isCategorized: true,
        metadata: await buildTrackMetadata(job.trackId, normalized),
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, job.trackId));

    console.log(
      `Categorized: ${artist} - ${title} as ${normalized.genre} (${normalized.decade})`
    );
  } catch (error) {
    console.error(`AI categorization failed for ${job.filePath}:`, error);
    throw error;
  }
}

function buildPrompt(input: {
  artist: string;
  title: string;
  album: string;
  currentGenre: string;
  year?: string;
}): string {
  return `Analyze this MP3 track and return a JSON object with "genre" and "decade".

Artist: ${input.artist}
Title: ${input.title}
Album: ${input.album}
Genre from ID3: ${input.currentGenre}
Year: ${input.year || 'Unknown'}

Return ONLY a valid JSON object with:
- genre: The most appropriate genre (ex: "Jazz", "Rock", "Pop")
- decade: The decade (ex: "1920s", "1930s", ... "2020s")

Allowed decades: ${DEFAULT_DECADES.join(', ')}

Example response:
{"genre":"Jazz","decade":"1950s"}`;
}

function parseAiJson(raw: string): { genre?: unknown; decade?: unknown } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not include JSON payload');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI response payload was not a JSON object');
  }

  return parsed as { genre?: unknown; decade?: unknown };
}

function normalizeResult(
  raw: { genre?: unknown; decade?: unknown },
  yearFromTags?: string
): { genre: string; decade: string } {
  const genre = normalizeGenre(
    typeof raw.genre === 'string' ? raw.genre : ''
  );
  const decade = normalizeDecade(
    typeof raw.decade === 'string' ? raw.decade : '',
    yearFromTags
  );

  if (!genre || genre === 'Unknown') {
    throw new Error('AI response missing "genre"');
  }

  if (!decade || decade === 'Unknown') {
    throw new Error('AI response missing "decade"');
  }

  return { genre, decade };
}

function normalizeGenre(rawGenre: string): string {
  const clean = rawGenre.trim().toLowerCase();
  if (!clean) {
    return 'Unknown';
  }

  if (GENRE_ALIASES[clean]) {
    return GENRE_ALIASES[clean];
  }

  return clean
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1))
    .join(' ');
}

function normalizeDecade(rawDecade: string, fallbackYear?: string): string {
  if (rawDecade) {
    const decadeMatch = rawDecade.toLowerCase().match(/(19\d0|20\d0)s/);
    if (decadeMatch) {
      const candidate = decadeMatch[0];
      if (DEFAULT_DECADES.includes(candidate)) {
        return candidate;
      }
    }
  }

  const inferred = inferDecade(fallbackYear);
  if (inferred) {
    return inferred;
  }

  return 'Unknown';
}

function inferDecade(yearValue?: string): string | null {
  if (!yearValue) {
    return null;
  }

  const yearMatch = yearValue.match(/(\d{4})/);
  if (!yearMatch) {
    return null;
  }

  const year = Number.parseInt(yearMatch[1], 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2090) {
    return null;
  }

  const decade = `${Math.floor(year / 10) * 10}s`;
  return DEFAULT_DECADES.includes(decade) ? decade : 'Unknown';
}

async function buildTrackMetadata(
  trackId: string,
  latest: { genre: string; decade: string }
): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ metadata: tracks.metadata })
    .from(tracks)
    .where(eq(tracks.id, trackId));

  const existingMetadata =
    (row?.metadata as Record<string, unknown> | undefined) ?? {};

  return {
    ...existingMetadata,
    ai: {
      ...(existingMetadata.ai as Record<string, unknown> | undefined),
      category: latest,
      model: LLM_MODEL_NAME,
      provider: LLM_PROVIDER,
      updatedAt: new Date().toISOString(),
    },
  };
}
