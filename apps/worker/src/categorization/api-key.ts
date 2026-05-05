import { SecretStore } from '@smoothradio/crypto';

export function resolveLLMApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const plain = env.LLM_API_KEY?.trim();
  if (plain) {
    return plain;
  }

  const encrypted = env.LLM_API_KEY_ENCRYPTED?.trim();
  if (!encrypted) {
    return null;
  }

  const storeKey = env.SECRET_STORE_KEY?.trim();
  if (!storeKey) {
    throw new Error('SECRET_STORE_KEY is required to decrypt LLM_API_KEY_ENCRYPTED');
  }

  return new SecretStore(storeKey).decrypt(encrypted);
}
