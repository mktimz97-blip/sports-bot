/**
 * Qwen 3.5 Connector via OpenRouter (OpenAI-compatible)
 * Low-cost cloud inference for Tier 2 tasks (code transforms, docs, reviews)
 *
 * ADR-026: 3-Tier Model Routing
 *   Tier 1: Agent Booster (WASM)     — <1ms, $0
 *   Tier 2: Qwen 3.5 (OpenRouter)    — ~1-3s, ~$0.0004/req  ← THIS
 *   Tier 3: Claude Opus/Sonnet       — 2-5s, $$$
 *
 * API: https://openrouter.ai/api/v1 (OpenAI-compatible)
 * Auth: OPENROUTER_API_KEY env variable
 */

import { Result, ok, err } from '../../shared/types/Result';
import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';

export interface QwenConfig {
  baseUrl: string;       // OpenRouter endpoint
  model: string;         // qwen/qwen3.5-122b-a10b via OpenRouter
  apiKey: string;        // from env OPENROUTER_API_KEY
  maxTokens: number;
  temperature: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  cost: number;
}

export interface LlmStats {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  savedVsCloud: number;  // $ saved vs using Claude
}

const DEFAULT_CONFIG: QwenConfig = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'qwen/qwen3.5-122b-a10b',
  apiKey: '',
  maxTokens: 2048,
  temperature: 0.3,
};

export class QwenConnector {
  private config: QwenConfig;
  private stats: LlmStats = { totalRequests: 0, totalTokens: 0, avgLatencyMs: 0, savedVsCloud: 0 };
  private events: DomainEvent[] = [];
  private isAvailable = false;

  constructor(config: Partial<QwenConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || '',
    };
  }

  /**
   * Check if DashScope API is reachable and authenticated
   */
  async healthCheck(): Promise<Result<boolean>> {
    if (!this.config.apiKey) {
      this.isAvailable = false;
      this.events.push(createEvent('QwenHealthCheck', 'system', {
        available: false,
        reason: 'OPENROUTER_API_KEY not set',
      }));
      return ok(false);
    }

    try {
      const resp = await fetch(`${this.config.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      this.isAvailable = resp.ok;

      this.events.push(createEvent('QwenHealthCheck', 'system', {
        available: resp.ok,
        model: this.config.model,
        endpoint: this.config.baseUrl,
      }));

      return ok(resp.ok);
    } catch {
      this.isAvailable = false;
      return ok(false);
    }
  }

  /**
   * Generate text with Qwen via DashScope (OpenAI-compatible chat/completions)
   */
  async generate(prompt: string, systemPrompt?: string): Promise<Result<LlmResponse>> {
    if (!this.config.apiKey) {
      return err(new Error('OPENROUTER_API_KEY not set — add it to .env'));
    }

    const start = Date.now();

    try {
      const resp = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt || 'You are a helpful coding assistant.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        return err(new Error(`OpenRouter API error ${resp.status}: ${body.substring(0, 200)}`));
      }

      const data = await resp.json() as {
        choices: { message: { content: string } }[];
        usage?: { total_tokens?: number; completion_tokens?: number };
      };
      const latencyMs = Date.now() - start;
      const text = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens || Math.ceil(text.length / 4);

      // Qwen-plus cost ~$0.0004/1K tokens vs Claude ~$0.003-0.015
      const qwenCost = tokensUsed * 0.0000004;
      const claudeCost = tokensUsed * 0.000003;
      this.stats.totalRequests++;
      this.stats.totalTokens += tokensUsed;
      this.stats.savedVsCloud += (claudeCost - qwenCost);
      this.stats.avgLatencyMs = (this.stats.avgLatencyMs * (this.stats.totalRequests - 1) + latencyMs) / this.stats.totalRequests;

      const response: LlmResponse = {
        text,
        model: this.config.model,
        tokensUsed,
        latencyMs,
        cost: qwenCost,
      };

      this.events.push(createEvent('QwenGenerated', 'system', {
        tokensUsed,
        latencyMs,
        promptLength: prompt.length,
        cost: qwenCost,
      }));

      return ok(response);
    } catch (e) {
      return err(new Error(`OpenRouter request failed: ${(e as Error).message}`));
    }
  }

  /**
   * Code-specific tasks (Tier 2 use cases)
   */
  async codeTask(task: 'review' | 'docs' | 'test' | 'refactor' | 'explain', code: string): Promise<Result<LlmResponse>> {
    const prompts: Record<string, string> = {
      review: `Review this code for bugs and improvements:\n\n${code}`,
      docs: `Generate JSDoc documentation for this code:\n\n${code}`,
      test: `Generate unit tests for this code:\n\n${code}`,
      refactor: `Suggest refactoring improvements for:\n\n${code}`,
      explain: `Explain this code in simple terms:\n\n${code}`,
    };

    return this.generate(prompts[task], 'You are a senior TypeScript developer. Be concise.');
  }

  getStats(): LlmStats {
    return { ...this.stats };
  }

  getAvailability(): boolean {
    return this.isAvailable;
  }

  getConfig(): QwenConfig {
    return { ...this.config };
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
