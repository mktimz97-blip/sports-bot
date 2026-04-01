/**
 * n8n Integration Connector
 * Connects RuFlo workflows to n8n automation engine
 */

import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';

export interface N8nConfig {
  baseUrl: string;
  apiKey: string;
  webhookPath: string;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  active: boolean;
  tags: string[];
}

export interface N8nNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  position: [number, number];
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  status: 'waiting' | 'running' | 'success' | 'error';
  startedAt: Date;
  finishedAt?: Date;
  data?: unknown;
}

export class N8nConnector {
  private config: N8nConfig;
  private workflows = new Map<string, N8nWorkflow>();
  private executions: N8nExecution[] = [];
  private events: DomainEvent[] = [];

  constructor(config: N8nConfig) {
    this.config = config;
  }

  /**
   * Import a workflow JSON (from Zie619 collection or custom)
   */
  importWorkflow(json: Record<string, unknown>): Result<N8nWorkflow> {
    const workflow: N8nWorkflow = {
      id: (json.id as string) || `wf-${Date.now()}`,
      name: (json.name as string) || 'Imported Workflow',
      nodes: (json.nodes as N8nNode[]) || [],
      connections: (json.connections as Record<string, unknown>) || {},
      active: false,
      tags: (json.tags as string[]) || [],
    };

    this.workflows.set(workflow.id, workflow);
    this.events.push(createEvent('N8nWorkflowImported', workflow.id, {
      name: workflow.name,
      nodeCount: workflow.nodes.length,
    }));
    return ok(workflow);
  }

  /**
   * Activate a workflow
   */
  activate(workflowId: string): Result<N8nWorkflow> {
    const wf = this.workflows.get(workflowId);
    if (!wf) return err(new Error(`Workflow ${workflowId} not found`));
    wf.active = true;
    this.events.push(createEvent('N8nWorkflowActivated', workflowId, { name: wf.name }));
    return ok(wf);
  }

  /**
   * Trigger a workflow execution
   */
  trigger(workflowId: string, inputData?: unknown): Result<N8nExecution> {
    const wf = this.workflows.get(workflowId);
    if (!wf) return err(new Error(`Workflow ${workflowId} not found`));

    const execution: N8nExecution = {
      id: `exec-${Date.now()}`,
      workflowId,
      status: 'running',
      startedAt: new Date(),
      data: inputData,
    };

    this.executions.push(execution);
    this.events.push(createEvent('N8nExecutionStarted', execution.id, {
      workflowId,
      workflowName: wf.name,
    }));

    // Simulate completion
    execution.status = 'success';
    execution.finishedAt = new Date();
    this.events.push(createEvent('N8nExecutionCompleted', execution.id, {
      workflowId,
      status: 'success',
    }));

    return ok(execution);
  }

  /**
   * Call n8n webhook endpoint
   */
  async callWebhook(path: string, payload: unknown): Promise<Result<unknown>> {
    const url = `${this.config.baseUrl}/webhook/${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return ok(data);
    } catch (e) {
      return err(new Error(`n8n webhook failed: ${(e as Error).message}`));
    }
  }

  listWorkflows(): N8nWorkflow[] {
    return Array.from(this.workflows.values());
  }

  listExecutions(workflowId?: string): N8nExecution[] {
    if (workflowId) return this.executions.filter((e) => e.workflowId === workflowId);
    return [...this.executions];
  }

  stats(): { workflows: number; active: number; executions: number; successRate: number } {
    const all = this.listWorkflows();
    const execs = this.executions;
    const successes = execs.filter((e) => e.status === 'success').length;
    return {
      workflows: all.length,
      active: all.filter((w) => w.active).length,
      executions: execs.length,
      successRate: execs.length > 0 ? successes / execs.length : 0,
    };
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
