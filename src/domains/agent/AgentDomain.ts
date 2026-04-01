import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'terminated';
export type AgentRole = 'coder' | 'reviewer' | 'tester' | 'planner' | 'researcher' | 'security' | 'coordinator';

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  status: AgentStatus;
  readonly capabilities: string[];
  readonly createdAt: Date;
  metrics: { tasksCompleted: number; errorRate: number };
}

export class AgentDomain {
  private agents = new Map<string, Agent>();
  private events: DomainEvent[] = [];

  spawn(id: string, name: string, role: AgentRole, capabilities: string[] = []): Result<Agent> {
    if (this.agents.has(id)) {
      return err(new Error(`Agent ${id} already exists`));
    }

    const agent: Agent = {
      id, name, role,
      status: 'idle',
      capabilities,
      createdAt: new Date(),
      metrics: { tasksCompleted: 0, errorRate: 0 },
    };

    this.agents.set(id, agent);
    this.events.push(createEvent('AgentSpawned', id, { name, role, capabilities }));
    return ok(agent);
  }

  activate(id: string): Result<Agent> {
    const agent = this.agents.get(id);
    if (!agent) return err(new Error(`Agent ${id} not found`));
    agent.status = 'running';
    this.events.push(createEvent('AgentActivated', id, { role: agent.role }));
    return ok(agent);
  }

  terminate(id: string): Result<void> {
    const agent = this.agents.get(id);
    if (!agent) return err(new Error(`Agent ${id} not found`));
    agent.status = 'terminated';
    this.events.push(createEvent('AgentTerminated', id, { role: agent.role }));
    return ok(undefined);
  }

  list(): Agent[] {
    return Array.from(this.agents.values());
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
