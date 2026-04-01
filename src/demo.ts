/**
 * RuFlo V3.5 — Demo Script
 * Run: npx ts-node src/demo.ts
 */
import { RuFloApp } from './application/RuFloApp';

async function runDemo() {
  console.log('=== RuFlo V3.5 AI Ecosystem ===\n');

  const app = new RuFloApp();
  console.log('[1/4] Bootstrapping...');
  await app.bootstrap();
  console.log('[1/4] Done.\n');

  // Show status
  const status = app.status();
  console.log('[2/4] System Status:');
  console.log(`  Security: ${status.security}`);
  console.log(`  Swarm: ${(status.swarm as any).agents}/${(status.swarm as any).maxAgents} agents (${(status.swarm as any).topology})`);
  console.log(`  Memory: ${(status.memory as any).total} entries, ${(status.memory as any).namespaces.length} namespaces`);
  console.log(`  DDD: ${(status.ddd as any).domains.length} bounded contexts\n`);

  // Show agents
  console.log('[3/4] Active Agents:');
  for (const agent of status.agents as any[]) {
    console.log(`  - ${agent.name} [${agent.role}] → ${agent.status}`);
  }

  // Demo workflow
  console.log('\n[4/4] Creating demo workflow...');
  const wfResult = app.workflows.create('demo-wf', 'Client Demo Pipeline', [
    { id: 'scan', name: 'Security Scan', agentRole: 'security', dependsOn: [] },
    { id: 'code', name: 'Generate Code', agentRole: 'coder', dependsOn: ['scan'] },
    { id: 'review', name: 'Code Review', agentRole: 'reviewer', dependsOn: ['code'] },
    { id: 'test', name: 'Run Tests', agentRole: 'tester', dependsOn: ['review'] },
  ]);

  if (wfResult.ok) {
    app.workflows.execute('demo-wf');
    app.workflows.completeStep('demo-wf', 'scan', { passed: true });
    app.workflows.execute('demo-wf');
    app.workflows.completeStep('demo-wf', 'code', { files: 5 });
    app.workflows.execute('demo-wf');
    app.workflows.completeStep('demo-wf', 'review', { approved: true });
    app.workflows.execute('demo-wf');
    app.workflows.completeStep('demo-wf', 'test', { passed: 12, failed: 0 });

    const wf = app.workflows.get('demo-wf')!;
    console.log(`  Workflow "${wf.name}": ${wf.status}`);
    for (const step of wf.steps) {
      console.log(`    [${step.status === 'completed' ? 'v' : ' '}] ${step.name}`);
    }
  }

  // Memory search demo
  console.log('\n[+] Memory Search: "security"');
  const results = app.memory.search('security');
  for (const r of results) {
    console.log(`  - [${r.score.toFixed(2)}] ${r.entry.key}: ${r.entry.value}`);
  }

  console.log('\n=== Demo Complete ===');
}

runDemo().catch(console.error);
