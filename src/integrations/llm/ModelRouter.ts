/**
 * 3-Tier Model Router (ADR-026)
 * Routes tasks to the cheapest capable model
 *
 * Tier 1: Agent Booster (WASM) — <1ms, $0, simple transforms
 * Tier 2: Qwen 3.5 (local)    — ~2s,  $0, simple reasoning
 * Tier 3: Claude Opus/Sonnet   — 2-5s, $$$, complex reasoning
 */

import { QwenConnector, LlmResponse } from './QwenConnector';
import { Result, ok, err } from '../../shared/types/Result';

export type Tier = 1 | 2 | 3;

export interface RoutingDecision {
  tier: Tier;
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: string;
}

export interface TaskComplexity {
  score: number;          // 0-100
  hasCodeGeneration: boolean;
  hasArchitecture: boolean;
  hasSecurity: boolean;
  tokenEstimate: number;
}

export class ModelRouter {
  private qwen: QwenConnector;
  private routingLog: { task: string; decision: RoutingDecision; timestamp: Date }[] = [];

  constructor(qwen: QwenConnector) {
    this.qwen = qwen;
  }

  /**
   * Analyze task complexity and route to appropriate tier
   */
  route(taskDescription: string): RoutingDecision {
    const complexity = this.analyzeComplexity(taskDescription);

    // Tier 1: Simple transforms (<10% complexity)
    if (complexity.score < 10 && !complexity.hasCodeGeneration && !complexity.hasSecurity) {
      const decision: RoutingDecision = {
        tier: 1,
        model: 'agent-booster-wasm',
        reason: 'Simple transform — handled by WASM booster',
        estimatedCost: 0,
        estimatedLatency: '<1ms',
      };
      this.log(taskDescription, decision);
      return decision;
    }

    // Tier 2: Qwen local (<30% complexity, no architecture/security)
    if (complexity.score < 30 && !complexity.hasArchitecture && !complexity.hasSecurity && this.qwen.getAvailability()) {
      const decision: RoutingDecision = {
        tier: 2,
        model: this.qwen.getConfig().model,
        reason: 'Simple reasoning — routed to local Qwen',
        estimatedCost: 0,
        estimatedLatency: '~2s',
      };
      this.log(taskDescription, decision);
      return decision;
    }

    // Tier 3: Claude for everything else
    const decision: RoutingDecision = {
      tier: 3,
      model: complexity.score > 70 ? 'claude-opus-4-6' : 'claude-sonnet-4-6',
      reason: `Complex task (${complexity.score}%) — requires cloud LLM`,
      estimatedCost: complexity.score > 70 ? 0.015 : 0.003,
      estimatedLatency: '2-5s',
    };
    this.log(taskDescription, decision);
    return decision;
  }

  /**
   * Execute a task through the router
   */
  async execute(taskDescription: string, code?: string): Promise<Result<{ decision: RoutingDecision; response?: LlmResponse }>> {
    const decision = this.route(taskDescription);

    if (decision.tier === 1) {
      return ok({ decision });
    }

    if (decision.tier === 2 && code) {
      const taskType = this.detectCodeTask(taskDescription);
      const result = await this.qwen.codeTask(taskType, code);
      if (result.ok) return ok({ decision, response: result.value });
      // Fallback to Tier 3 if Qwen fails
      decision.tier = 3;
      decision.model = 'claude-sonnet-4-6';
      decision.reason += ' (Qwen fallback)';
    }

    return ok({ decision });
  }

  private analyzeComplexity(task: string): TaskComplexity {
    const lower = task.toLowerCase();
    let score = 20; // baseline

    if (lower.includes('architect') || lower.includes('design system')) score += 40;
    if (lower.includes('security') || lower.includes('vulnerability')) score += 30;
    if (lower.includes('generate') || lower.includes('create')) score += 15;
    if (lower.includes('refactor')) score += 10;
    if (lower.includes('explain') || lower.includes('document')) score -= 10;
    if (lower.includes('rename') || lower.includes('format')) score -= 15;
    if (lower.includes('add type') || lower.includes('const')) score -= 15;

    return {
      score: Math.max(0, Math.min(100, score)),
      hasCodeGeneration: /generat|creat|implement|build/i.test(task),
      hasArchitecture: /architect|design|system|ddd|domain/i.test(task),
      hasSecurity: /secur|vulner|audit|cve|inject/i.test(task),
      tokenEstimate: Math.ceil(task.length / 4) * 3,
    };
  }

  private detectCodeTask(task: string): 'review' | 'docs' | 'test' | 'refactor' | 'explain' {
    const lower = task.toLowerCase();
    if (lower.includes('review')) return 'review';
    if (lower.includes('doc')) return 'docs';
    if (lower.includes('test')) return 'test';
    if (lower.includes('refactor')) return 'refactor';
    return 'explain';
  }

  private log(task: string, decision: RoutingDecision): void {
    this.routingLog.push({ task, decision, timestamp: new Date() });
  }

  getLog(): typeof this.routingLog {
    return [...this.routingLog];
  }

  getSavings(): { totalRouted: number; tier1: number; tier2: number; tier3: number; savedUsd: number } {
    const tier1 = this.routingLog.filter((r) => r.decision.tier === 1).length;
    const tier2 = this.routingLog.filter((r) => r.decision.tier === 2).length;
    const tier3 = this.routingLog.filter((r) => r.decision.tier === 3).length;
    const saved = tier1 * 0.0002 + tier2 * 0.0002; // what cloud would cost

    return { totalRouted: this.routingLog.length, tier1, tier2, tier3, savedUsd: saved };
  }
}
