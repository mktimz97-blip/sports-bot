/**
 * Qwen 3.5 Local LLM Connector via Ollama
 * Cheap local inference for Tier 2 tasks (simple code transforms, docs, etc.)
 *
 * ADR-026: 3-Tier Model Routing
 *   Tier 1: Agent Booster (WASM) — <1ms, $0
 *   Tier 2: Qwen 3.5 (local)    — ~2s,  $0   ← THIS
 *   Tier 3: Claude Opus/Sonnet   — 2-5s, $$$
 */

import { Result, ok, err } from '../../shared/types/Result';
import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';

export interface QwenConfig {
  baseUrl: string;       // Ollama API, default http://localhost:11434
  model: string;         // qwen3:8b or qwen3:0.6b
  maxTokens: number;
  temperature: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  cost: number;          // Always $0 for local
}

export interface LlmStats {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  savedVsCloud: number;  // $ saved vs using cloud API
}

const DEFAULT_CONFIG: QwenConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen3:8b',
  maxTokens: 2048,
  temperature: 0.3,
};

export class QwenConnector {
  private config: QwenConfig;
  private stats: LlmStats = { totalRequests: 0, totalTokens: 0, avgLatencyMs: 0, savedVsCloud: 0 };
  private events: DomainEvent[] = [];
  private isAvailable = false;

  constructor(config: Partial<QwenConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if Ollama + Qwen is running
   */
  async healthCheck(): Promise<Result<boolean>> {
    try {
      const resp = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!resp.ok) return ok(false);

      const data = await resp.json() as { models?: { name: string }[] };
      const models = data.models || [];
      const hasQwen = models.some((m) => m.name.includes('qwen'));
      this.isAvailable = hasQwen;

      this.events.push(createEvent('QwenHealthCheck', 'system', {
        available: hasQwen,
        models: models.map((m) => m.name),
      }));

      return ok(hasQwen);
    } catch {
      this.isAvailable = false;
      return ok(false);
    }
  }

  /**
   * Generate text with Qwen (Tier 2 handler)
   */
  async generate(prompt: string, systemPrompt?: string): Promise<Result<LlmResponse>> {
    const start = Date.now();

    try {
      const resp = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          system: systemPrompt || 'You are a helpful coding assistant.',
          options: {
            num_predict: this.config.maxTokens,
            temperature: this.config.temperature,
          },
          stream: false,
        }),
      });

      if (!resp.ok) {
        return err(new Error(`Qwen API error: ${resp.status}`));
      }

      const data = await resp.json() as { response: string; eval_count?: number };
      const latencyMs = Date.now() - start;
      const tokensUsed = data.eval_count || Math.ceil(data.response.length / 4);

      // Cloud equivalent cost (Claude Haiku ~$0.0002/req)
      const cloudCost = 0.0002;
      this.stats.totalRequests++;
      this.stats.totalTokens += tokensUsed;
      this.stats.savedVsCloud += cloudCost;
      this.stats.avgLatencyMs = (this.stats.avgLatencyMs * (this.stats.totalRequests - 1) + latencyMs) / this.stats.totalRequests;

      const response: LlmResponse = {
        text: data.response,
        model: this.config.model,
        tokensUsed,
        latencyMs,
        cost: 0,
      };

      this.events.push(createEvent('QwenGenerated', 'system', {
        tokensUsed,
        latencyMs,
        promptLength: prompt.length,
      }));

      return ok(response);
    } catch (e) {
      return err(new Error(`Qwen generation failed: ${(e as Error).message}`));
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
