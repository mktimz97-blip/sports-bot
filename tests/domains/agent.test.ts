import { AgentDomain } from '../../src/domains/agent/AgentDomain';

describe('AgentDomain', () => {
  let domain: AgentDomain;

  beforeEach(() => {
    domain = new AgentDomain();
  });

  it('should spawn an agent', () => {
    const result = domain.spawn('a1', 'test-coder', 'coder', ['typescript']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('test-coder');
      expect(result.value.role).toBe('coder');
      expect(result.value.status).toBe('idle');
    }
  });

  it('should reject duplicate agent ids', () => {
    domain.spawn('a1', 'first', 'coder');
    const result = domain.spawn('a1', 'duplicate', 'tester');
    expect(result.ok).toBe(false);
  });

  it('should activate an agent', () => {
    domain.spawn('a1', 'coder', 'coder');
    const result = domain.activate('a1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('running');
  });

  it('should terminate an agent', () => {
    domain.spawn('a1', 'coder', 'coder');
    domain.terminate('a1');
    expect(domain.get('a1')?.status).toBe('terminated');
  });

  it('should list all agents', () => {
    domain.spawn('a1', 'coder', 'coder');
    domain.spawn('a2', 'tester', 'tester');
    expect(domain.list()).toHaveLength(2);
  });

  it('should produce domain events', () => {
    domain.spawn('a1', 'coder', 'coder');
    domain.activate('a1');
    const events = domain.flushEvents();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('AgentSpawned');
    expect(events[1].type).toBe('AgentActivated');
  });
});
