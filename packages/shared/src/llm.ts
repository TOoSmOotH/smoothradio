export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProviderConfig {
  providerType: 'vllm' | 'openai' | 'anthropic' | 'ollama';
  endpoint: string;
  apiKey?: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  generate(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>
  ): Promise<LLMResponse>;

  getVersion?(): Promise<string>;
}

export abstract class AbstractLLMProvider implements LLMProvider {
  constructor(protected config: LLMProviderConfig) {}

  abstract generate(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>
  ): Promise<LLMResponse>;

  protected async post(
    endpoint: string,
    payload: unknown,
    headers: Record<string, string> = {}
  ): Promise<unknown> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    return response.json();
  }
}

export class OpenAIProvider extends AbstractLLMProvider {
  async generate(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>
  ): Promise<LLMResponse> {
    const model = config?.modelName || this.config.modelName;
    const endpoint = `${this.config.endpoint}/chat/completions`;

    const payload = {
      model,
      messages,
      temperature: config?.temperature ?? this.config.temperature,
      max_tokens: config?.maxTokens ?? this.config.maxTokens,
    };

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await this.post(endpoint, payload, headers);

    const data = response as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    return {
      content: choice.message?.content || '',
      model: data.model || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}

export class AnthropicProvider extends AbstractLLMProvider {
  async generate(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>
  ): Promise<LLMResponse> {
    const model = config?.modelName || this.config.modelName;
    const endpoint = `${this.config.endpoint}/messages`;

    const anthropicMessages = this.convertMessages(messages);

    const payload = {
      model,
      messages: anthropicMessages,
      temperature: config?.temperature ?? this.config.temperature,
      max_tokens: config?.maxTokens ?? this.config.maxTokens,
    };

    const headers: Record<string, string> = {
      'x-api-key': this.config.apiKey || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };

    const response = await this.post(endpoint, payload, headers);

    const data = response as {
      content?: Array<{ text?: string }>;
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const content = data.content?.[0]?.text || '';

    return {
      content,
      model: data.model || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  private convertMessages(messages: LLMMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));
  }
}

export class OllamaProvider extends AbstractLLMProvider {
  async generate(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>
  ): Promise<LLMResponse> {
    const model = config?.modelName || this.config.modelName;
    const endpoint = `${this.config.endpoint}/api/chat`;

    const messagesFormatted = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const payload = {
      model,
      messages: messagesFormatted,
      options: {
        temperature: config?.temperature ?? this.config.temperature,
        num_predict: config?.maxTokens ?? this.config.maxTokens,
      },
    };

    const response = await this.post(endpoint, payload);

    const data = response as {
      message?: { content?: string };
      model?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message?.content || '',
      model: data.model || '',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }
}

export class VLLMProvider extends AbstractLLMProvider {
  async generate(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>
  ): Promise<LLMResponse> {
    const model = config?.modelName || this.config.modelName;
    const endpoint = `${this.config.endpoint}/v1/chat/completions`;

    const payload = {
      model,
      messages,
      temperature: config?.temperature ?? this.config.temperature,
      max_tokens: config?.maxTokens ?? this.config.maxTokens,
    };

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await this.post(endpoint, payload, headers);

    const data = response as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    return {
      content: choice.message?.content || '',
      model: data.model || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}

export class LLMFactory {
  static createProvider(config: LLMProviderConfig): LLMProvider {
    switch (config.providerType) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'vllm':
        return new VLLMProvider(config);
      default:
        throw new Error(`Unsupported provider type: ${config.providerType}`);
    }
  }
}
