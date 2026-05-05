import { describe, it, expect } from 'vitest';

import { SecretStore } from '../../packages/crypto/src/secret-store';
import { buildLLMConfig } from '../../apps/worker/src/ai-categorizer';
import { resolveLLMApiKey } from '../../apps/worker/src/categorization/api-key';

describe('LLM API key resolution and config building', () => {
  it('prefers plaintext LLM_API_KEY over encrypted value', () => {
    const env = {
      LLM_API_KEY: 'plain-key',
      LLM_API_KEY_ENCRYPTED: 'ignored',
      SECRET_STORE_KEY: 'secret',
    } as NodeJS.ProcessEnv;

    expect(resolveLLMApiKey(env)).toBe('plain-key');
  });

  it('decrypts encrypted key when SECRET_STORE_KEY is provided', () => {
    const encrypted = new SecretStore('store-key').encrypt('decrypted-key');
    const env = {
      LLM_API_KEY_ENCRYPTED: encrypted,
      SECRET_STORE_KEY: 'store-key',
    } as NodeJS.ProcessEnv;

    expect(resolveLLMApiKey(env)).toBe('decrypted-key');
  });

  it('throws when encrypted key is set without SECRET_STORE_KEY', () => {
    const env = {
      LLM_API_KEY_ENCRYPTED: 'abc123',
    } as NodeJS.ProcessEnv;

    expect(() => resolveLLMApiKey(env)).toThrow(
      'SECRET_STORE_KEY is required to decrypt LLM_API_KEY_ENCRYPTED'
    );
  });

  it('buildLLMConfig clamps numeric values and sets defaults', () => {
    const env = {
      LLM_ENDPOINT: '  http://localhost:8000  ',
      LLM_MODEL_NAME: '  gpt-test  ',
      LLM_TEMPERATURE: '3.5',
      LLM_MAX_TOKENS: '7',
      LLM_TIMEOUT_MS: '500',
    } as NodeJS.ProcessEnv;

    expect(buildLLMConfig(env)).toEqual({
      endpoint: 'http://localhost:8000',
      apiKey: null,
      model: 'gpt-test',
      temperature: 2,
      maxTokens: 16,
      timeoutMs: 1000,
    });
  });
});
