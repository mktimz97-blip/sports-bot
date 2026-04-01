/**
 * NVIDIA Nemotron Ultra 253B Connector via OpenRouter
 * Emotional analysis and empathetic response generation
 *
 * Model: nvidia/llama-3.1-nemotron-ultra-253b-v1
 * Use cases: sentiment analysis, emotional tone detection, client-facing responses
 */

import { Result, ok, err } from '../../shared/types/Result';
import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';

export interface EmotionAnalysis {
  tone: string;
  confidence: number;
  suggestedStyle: string;
}

export interface NemotronResponse {
  text: string;
  emotion?: EmotionAnalysis;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface NemotronConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxTokens: number;
}

const DEFAULT_CONFIG: NemotronConfig = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  apiKey: '',
  maxTokens: 1024,
};

export class NemotronConnector {
  private config: NemotronConfig;
  private events: DomainEvent[] = [];
  private requestCount = 0;

  constructor(config: Partial<NemotronConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || '',
    };
  }

  async analyzeEmotion(text: string): Promise<Result<EmotionAnalysis>> {
    if (!this.config.apiKey) {
      return err(new Error('OPENROUTER_API_KEY not set'));
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
            {
              role: 'system',
              content: 'Analyze the emotional tone of the user message. Respond ONLY with valid JSON (no markdown): {"tone": "string", "confidence": 0.0-1.0, "suggestedStyle": "string describing ideal response approach"}',
            },
            { role: 'user', content: text },
          ],
          max_tokens: 200,
          temperature: 0.2,
        }),
      });

      if (!resp.ok) {
        return err(new Error(`Nemotron API error: ${resp.status}`));
      }

      const data = await resp.json() as {
        choices: { message: { content: string | null; reasoning?: string } }[];
        usage?: { total_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - start;
      this.requestCount++;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch?.[0] || content) as EmotionAnalysis;

        this.events.push(createEvent('NemotronEmotionAnalyzed', 'system', {
          tone: parsed.tone,
          confidence: parsed.confidence,
          latencyMs,
        }));

        return ok(parsed);
      } catch {
        return ok({ tone: 'neutral', confidence: 0.5, suggestedStyle: 'professional and helpful' });
      }
    } catch (e) {
      return err(new Error(`Nemotron request failed: ${(e as Error).message}`));
    }
  }

  async generateEmpathetic(originalResponse: string, emotion: EmotionAnalysis): Promise<Result<NemotronResponse>> {
    if (!this.config.apiKey) {
      return err(new Error('OPENROUTER_API_KEY not set'));
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
            {
              role: 'system',
              content: `Rewrite this response to match the emotional context. Customer tone: ${emotion.tone} (confidence: ${emotion.confidence}). Style: ${emotion.suggestedStyle}. Keep the factual content but adjust tone and empathy level. Be concise.`,
            },
            { role: 'user', content: originalResponse },
          ],
          max_tokens: this.config.maxTokens,
          temperature: 0.4,
        }),
      });

      if (!resp.ok) {
        return err(new Error(`Nemotron API error: ${resp.status}`));
      }

      const data = await resp.json() as {
        choices: { message: { content: string | null } }[];
        usage?: { total_tokens?: number };
      };

      const text = data.choices?.[0]?.message?.content || originalResponse;
      const latencyMs = Date.now() - start;
      const tokensUsed = data.usage?.total_tokens || Math.ceil(text.length / 4);
      this.requestCount++;

      this.events.push(createEvent('NemotronEmpatheticGenerated', 'system', {
        originalLength: originalResponse.length,
        empatheticLength: text.length,
        tone: emotion.tone,
        latencyMs,
      }));

      return ok({ text, emotion, model: this.config.model, tokensUsed, latencyMs });
    } catch (e) {
      return err(new Error(`Nemotron request failed: ${(e as Error).message}`));
    }
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
