import { loadBuckets, normalizeDecade, normalizeGenre, type Buckets } from './buckets.js';
import { sanitizeInput, type CategorizationInput } from './sanitize.js';

export type LLMConfig = {
  endpoint: string;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

export type CategorizationResult = {
  genre: string;
  decade: string;
  bucketsVersion: number;
  fromFallback: boolean;
};

export type EngineDeps = {
  fetchImpl?: typeof fetch;
  loadBucketsImpl?: typeof loadBuckets;
};

const MAX_RESPONSE_CHARS = 8 * 1024;
const SYSTEM_PROMPT =
  'You are a music classifier. Reply with exactly one JSON object: ' +
  '{"genre": <string>, "decade": <string>}. Use only the values in the ' +
  'allowed lists when possible. Do not include any other text, prose, or markdown.';

export class CategorizationEngine {
  private readonly fetchImpl: typeof fetch;
  private readonly loadBucketsImpl: typeof loadBuckets;

  constructor(private readonly config: LLMConfig, deps: EngineDeps = {}) {
    if (!isHttpUrl(config.endpoint)) {
      throw new Error('LLM endpoint must be an http(s) URL');
    }
    if (!config.model) {
      throw new Error('LLM model name is required');
    }
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.loadBucketsImpl = deps.loadBucketsImpl ?? loadBuckets;
  }

  async categorize(rawInput: {
    artist?: string | null;
    album?: string | null;
    title?: string | null;
    currentGenre?: string | null;
    year?: string | null;
  }): Promise<CategorizationResult> {
    const input = sanitizeInput(rawInput);
    const buckets = await this.loadBucketsImpl();

    const prompt = buildUserPrompt(input, buckets);
    const responseContent = await this.callOpenAI(prompt);

    const parsed = parseAiJson(responseContent);
    const genre = normalizeGenre(coerceString(parsed.genre), buckets.genres);
    const decade = normalizeDecade(coerceString(parsed.decade), input.year);

    if (genre && decade) {
      return {
        genre,
        decade,
        bucketsVersion: buckets.genres.length,
        fromFallback: false,
      };
    }

    const fallback = inferFallback(input, buckets);
    if (fallback) {
      return { ...fallback, bucketsVersion: buckets.genres.length, fromFallback: true };
    }

    throw new CategorizationError(
      'AI response could not be normalized into a (genre, decade) bucket'
    );
  }

  private async callOpenAI(userPrompt: string): Promise<string> {
    const url = buildChatCompletionsUrl(this.config.endpoint);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const body = JSON.stringify({
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new CategorizationError('LLM request timed out');
      }
      throw new CategorizationError('LLM request failed');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new CategorizationError(
        `LLM endpoint returned HTTP ${response.status}`
      );
    }

    const text = await readBoundedText(response, MAX_RESPONSE_CHARS);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new CategorizationError('LLM response was not valid JSON');
    }

    const content = extractMessageContent(payload);
    if (!content) {
      throw new CategorizationError('LLM response did not include message content');
    }

    return content;
  }
}

export class CategorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategorizationError';
  }
}

function buildUserPrompt(input: CategorizationInput, buckets: Buckets): string {
  return [
    'Classify this music track into a genre and a decade.',
    '',
    `Artist: ${input.artist}`,
    `Album: ${input.album}`,
    `Title: ${input.title}`,
    `ID3 genre tag (if any): ${input.currentGenre || 'none'}`,
    `Year (if known): ${input.year}`,
    '',
    `Allowed genres (prefer these, but you may add a new one if a song clearly does not fit): ${buckets.genres.join(', ')}`,
    `Allowed decades: ${buckets.decades.join(', ')}`,
    '',
    'Respond with a single JSON object: {"genre": "<value>", "decade": "<value>"}.',
  ].join('\n');
}

function buildChatCompletionsUrl(endpoint: string): string {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  if (/\/v\d+$/.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readBoundedText(response: Response, maxChars: number): Promise<string> {
  const text = await response.text();
  if (text.length > maxChars) {
    throw new CategorizationError('LLM response exceeded maximum size');
  }
  return text;
}

function extractMessageContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (!first || typeof first !== 'object') {
    return null;
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== 'object') {
    return null;
  }
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

function parseAiJson(raw: string): { genre?: unknown; decade?: unknown } {
  const trimmed = raw.trim();
  // Some providers wrap JSON in markdown fences; pull the first balanced object.
  const jsonString = extractFirstJsonObject(trimmed);
  if (!jsonString) {
    throw new CategorizationError('AI response did not include JSON payload');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new CategorizationError('AI response JSON was malformed');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new CategorizationError('AI response payload was not a JSON object');
  }
  return parsed as { genre?: unknown; decade?: unknown };
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
}

function coerceString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function inferFallback(
  input: CategorizationInput,
  buckets: Buckets
): { genre: string; decade: string } | null {
  const genre = normalizeGenre(input.currentGenre, buckets.genres);
  const decade = normalizeDecade('', input.year);
  if (genre && decade) {
    return { genre, decade };
  }
  return null;
}
