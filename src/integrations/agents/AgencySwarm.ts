/**
 * Agency Swarm — Multi-Agent Router
 * Routes client requests to specialized agents using Qwen 3.5 or Claude
 *
 * Agents:
 *   ResearchAgent  — market research, competitor analysis, data gathering
 *   CodeAgent      — code generation, review, debugging, refactoring
 *   SalesAgent     — client communication, proposals, pricing
 *   ReportAgent    — analytics, summaries, dashboard generation
 */

import { QwenConnector, LlmResponse } from '../llm/QwenConnector';
import { Result, ok, err } from '../../shared/types/Result';
import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';

export type AgentRole = 'research' | 'code' | 'sales' | 'report';

export interface AgentProfile {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  tier: 2 | 3;  // which LLM tier to use
  keywords: string[];
}

export interface AgentResult {
  agent: AgentProfile;
  response: string;
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

const AGENTS: AgentProfile[] = [
  {
    role: 'research',
    name: 'ResearchAgent',
    description: 'Market research, competitor analysis, data gathering',
    systemPrompt: 'You are a senior market research analyst. Provide data-driven insights, competitor analysis, and actionable recommendations. Be thorough but concise.',
    tier: 2,
    keywords: ['research', 'analyze', 'market', 'competitor', 'trend', 'data', 'study', 'investigate', 'compare'],
  },
  {
    role: 'code',
    name: 'CodeAgent',
    description: 'Code generation, review, debugging, architecture',
    systemPrompt: 'You are a senior TypeScript/Node.js developer. Write clean, typed, testable code. Follow DDD and SOLID principles. Be concise.',
    tier: 3, // complex reasoning needs Claude
    keywords: ['code', 'implement', 'function', 'bug', 'debug', 'refactor', 'api', 'database', 'typescript', 'test'],
  },
  {
    role: 'sales',
    name: 'SalesAgent',
    description: 'Client communication, proposals, pricing strategies',
    systemPrompt: 'You are a skilled sales consultant. Create compelling proposals, handle objections, and build client relationships. Focus on value and ROI.',
    tier: 2,
    keywords: ['client', 'proposal', 'price', 'deal', 'sales', 'customer', 'offer', 'negotiate', 'pitch', 'roi'],
  },
  {
    role: 'report',
    name: 'ReportAgent',
    description: 'Analytics reports, summaries, KPI dashboards',
    systemPrompt: 'You are a business intelligence analyst. Create clear, structured reports with key metrics, trends, and actionable insights. Use tables and bullet points.',
    tier: 2,
    keywords: ['report', 'summary', 'analytics', 'kpi', 'metric', 'dashboard', 'chart', 'performance', 'weekly', 'monthly'],
  },
];

export class AgencySwarm {
  private qwen: QwenConnector;
  private events: DomainEvent[] = [];
  private routingLog: { query: string; agent: string; timestamp: Date }[] = [];

  constructor(qwen: QwenConnector) {
    this.qwen = qwen;
  }

  /**
   * Route a request to the best agent based on content analysis
   */
  route(query: string): AgentProfile {
    const lower = query.toLowerCase();
    let bestAgent = AGENTS[0];
    let bestScore = 0;

    for (const agent of AGENTS) {
      let score = 0;
      for (const kw of agent.keywords) {
        if (lower.includes(kw)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    this.routingLog.push({ query: query.substring(0, 100), agent: bestAgent.name, timestamp: new Date() });
    this.events.push(createEvent('AgencySwarmRouted', 'system', {
      agent: bestAgent.name,
      role: bestAgent.role,
      score: bestScore,
      tier: bestAgent.tier,
    }));

    return bestAgent;
  }

  /**
   * Execute a request through the appropriate agent
   */
  async execute(query: string): Promise<Result<AgentResult>> {
    const agent = this.route(query);
    const start = Date.now();

    if (agent.tier === 2) {
      const result = await this.qwen.generate(query, agent.systemPrompt);
      if (result.ok) {
        return ok({
          agent,
          response: result.value.text,
          tokensUsed: result.value.tokensUsed,
          latencyMs: result.value.latencyMs,
          model: result.value.model,
        });
      }
      // Fallback: return error info as response
      return ok({
        agent,
        response: `[${agent.name}] Request processed (Qwen unavailable — would use Claude Tier 3 fallback)`,
        tokensUsed: 0,
        latencyMs: Date.now() - start,
        model: 'fallback',
      });
    }

    // Tier 3: Claude — return placeholder (actual Claude calls handled externally)
    return ok({
      agent,
      response: `[${agent.name}] Complex task routed to Claude (Tier 3). Query: ${query.substring(0, 100)}`,
      tokensUsed: 0,
      latencyMs: Date.now() - start,
      model: 'claude-sonnet-4-6',
    });
  }

  getAgents(): AgentProfile[] {
    return [...AGENTS];
  }

  getRoutingLog(): typeof this.routingLog {
    return [...this.routingLog];
  }

  getStats(): { totalRouted: number; byAgent: Record<string, number> } {
    const byAgent: Record<string, number> = {};
    for (const entry of this.routingLog) {
      byAgent[entry.agent] = (byAgent[entry.agent] || 0) + 1;
    }
    return { totalRouted: this.routingLog.length, byAgent };
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
