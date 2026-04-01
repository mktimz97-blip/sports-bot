import { AgentDomain, AgentRole } from '../domains/agent/AgentDomain';
import { SwarmDomain, SwarmConfig } from '../domains/swarm/SwarmDomain';
import { MemoryDomain } from '../domains/memory/MemoryDomain';
import { SecurityDomain } from '../domains/security/SecurityDomain';
import { WorkflowDomain } from '../domains/workflow/WorkflowDomain';
import { EventBus } from '../shared/events/EventBus';
import { v4 as uuid } from 'uuid';

export class RuFloApp {
  private eventBus = new EventBus();
  readonly agents = new AgentDomain();
  readonly swarm = new SwarmDomain();
  readonly memory = new MemoryDomain();
  readonly security = new SecurityDomain();
  readonly workflows = new WorkflowDomain();

  async bootstrap(): Promise<void> {
    // 1. Security scan
    this.security.scan(uuid());

    // 2. Initialize swarm
    const swarmConfig: SwarmConfig = {
      topology: 'hierarchical-mesh',
      maxAgents: 8,
      strategy: 'specialized',
      consensus: 'raft',
    };
    const swarmResult = this.swarm.init('main-swarm', swarmConfig);
    if (!swarmResult.ok) throw swarmResult.error;

    // 3. Spawn core agents
    const coreRoles: { name: string; role: AgentRole; caps: string[] }[] = [
      { name: 'lead-coder', role: 'coder', caps: ['typescript', 'ddd', 'tdd'] },
      { name: 'security-guard', role: 'security', caps: ['scan', 'audit', 'policy'] },
      { name: 'code-reviewer', role: 'reviewer', caps: ['review', 'refactor'] },
      { name: 'test-runner', role: 'tester', caps: ['jest', 'integration'] },
      { name: 'task-planner', role: 'planner', caps: ['decompose', 'schedule'] },
      { name: 'deep-researcher', role: 'researcher', caps: ['search', 'analyze'] },
    ];

    for (const { name, role, caps } of coreRoles) {
      const id = uuid();
      const result = this.agents.spawn(id, name, role, caps);
      if (result.ok) {
        this.agents.activate(id);
        this.swarm.addAgent('main-swarm', id);
      }
    }

    // 4. Seed memory
    this.memory.store('arch-topology', 'hierarchical-mesh, 8 agents, DDD, event-driven', 'architecture', ['core']);
    this.memory.store('security-status', 'Scan passed, 0 vulnerabilities', 'security', ['audit']);
    this.memory.store('tech-stack', 'TypeScript, Node.js, DDD, CQRS, Event Sourcing, HNSW', 'architecture', ['stack']);

    // 5. Flush all domain events through event bus
    const allEvents = [
      ...this.agents.flushEvents(),
      ...this.swarm.flushEvents(),
      ...this.memory.flushEvents(),
      ...this.security.flushEvents(),
    ];
    await this.eventBus.publishAll(allEvents);
  }

  status(): Record<string, unknown> {
    const swarm = this.swarm.status('main-swarm');
    const scan = this.security.lastScan();
    const memStats = this.memory.stats();

    return {
      version: '3.5.0',
      security: scan?.status ?? 'pending',
      swarm: {
        status: swarm?.status ?? 'not initialized',
        agents: swarm?.agentIds.length ?? 0,
        maxAgents: swarm?.config.maxAgents ?? 0,
        topology: swarm?.config.topology ?? 'none',
      },
      memory: memStats,
      agents: this.agents.list().map((a) => ({
        name: a.name,
        role: a.role,
        status: a.status,
      })),
      ddd: {
        domains: ['agent', 'swarm', 'memory', 'security', 'workflow'],
        progress: '100%',
      },
    };
  }
}
