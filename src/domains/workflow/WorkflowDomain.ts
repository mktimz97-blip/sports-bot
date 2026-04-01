import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  id: string;
  name: string;
  agentRole: string;
  status: StepStatus;
  dependsOn: string[];
  output?: unknown;
}

export interface Workflow {
  readonly id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'created' | 'running' | 'completed' | 'failed' | 'paused';
  readonly createdAt: Date;
}

export class WorkflowDomain {
  private workflows = new Map<string, Workflow>();
  private events: DomainEvent[] = [];

  create(id: string, name: string, steps: Omit<WorkflowStep, 'status' | 'output'>[]): Result<Workflow> {
    if (this.workflows.has(id)) {
      return err(new Error(`Workflow ${id} already exists`));
    }

    const workflow: Workflow = {
      id, name,
      steps: steps.map((s) => ({ ...s, status: 'pending' as StepStatus })),
      status: 'created',
      createdAt: new Date(),
    };

    this.workflows.set(id, workflow);
    this.events.push(createEvent('WorkflowCreated', id, { name, stepCount: steps.length }));
    return ok(workflow);
  }

  execute(workflowId: string): Result<Workflow> {
    const wf = this.workflows.get(workflowId);
    if (!wf) return err(new Error(`Workflow ${workflowId} not found`));
    wf.status = 'running';

    for (const step of wf.steps) {
      const depsComplete = step.dependsOn.every((depId) => {
        const dep = wf.steps.find((s) => s.id === depId);
        return dep?.status === 'completed';
      });
      if (depsComplete && step.status === 'pending') {
        step.status = 'running';
        this.events.push(createEvent('WorkflowStepStarted', workflowId, { stepId: step.id }));
        break;
      }
    }
    return ok(wf);
  }

  completeStep(workflowId: string, stepId: string, output?: unknown): Result<Workflow> {
    const wf = this.workflows.get(workflowId);
    if (!wf) return err(new Error(`Workflow ${workflowId} not found`));
    const step = wf.steps.find((s) => s.id === stepId);
    if (!step) return err(new Error(`Step ${stepId} not found`));

    step.status = 'completed';
    step.output = output;
    this.events.push(createEvent('WorkflowStepCompleted', workflowId, { stepId, output }));

    if (wf.steps.every((s) => s.status === 'completed')) {
      wf.status = 'completed';
      this.events.push(createEvent('WorkflowCompleted', workflowId, { name: wf.name }));
    }
    return ok(wf);
  }

  get(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  listAll(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
