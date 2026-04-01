import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';

export type Topology = 'hierarchical' | 'mesh' | 'hierarchical-mesh' | 'ring';
export type SwarmStatus = 'initializing' | 'running' | 'paused' | 'shutdown';

export interface SwarmConfig {
  topology: Topology;
  maxAgents: number;
  strategy: 'specialized' | 'generalist' | 'adaptive';
  consensus: 'majority' | 'raft' | 'byzantine';
}

export interface Swarm {
  readonly id: string;
  config: SwarmConfig;
  status: SwarmStatus;
  agentIds: string[];
  readonly createdAt: Date;
}

export class SwarmDomain {
  private swarms = new Map<string, Swarm>();
  private events: DomainEvent[] = [];

  init(id: string, config: SwarmConfig): Result<Swarm> {
    if (this.swarms.has(id)) {
      return err(new Error(`Swarm ${id} already exists`));
    }

    const swarm: Swarm = {
      id, config,
      status: 'initializing',
      agentIds: [],
      createdAt: new Date(),
    };

    this.swarms.set(id, swarm);
    swarm.status = 'running';
    this.events.push(createEvent('SwarmInitialized', id, { config }));
    return ok(swarm);
  }

  addAgent(swarmId: string, agentId: string): Result<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return err(new Error(`Swarm ${swarmId} not found`));
    if (swarm.agentIds.length >= swarm.config.maxAgents) {
      return err(new Error(`Swarm at max capacity: ${swarm.config.maxAgents}`));
    }
    swarm.agentIds.push(agentId);
    this.events.push(createEvent('AgentJoinedSwarm', swarmId, { agentId }));
    return ok(undefined);
  }

  removeAgent(swarmId: string, agentId: string): Result<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return err(new Error(`Swarm ${swarmId} not found`));
    swarm.agentIds = swarm.agentIds.filter((id) => id !== agentId);
    this.events.push(createEvent('AgentLeftSwarm', swarmId, { agentId }));
    return ok(undefined);
  }

  status(swarmId: string): Swarm | undefined {
    return this.swarms.get(swarmId);
  }

  listAll(): Swarm[] {
    return Array.from(this.swarms.values());
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
