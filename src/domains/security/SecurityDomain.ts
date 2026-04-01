import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ScanStatus = 'pending' | 'scanning' | 'passed' | 'failed';

export interface ScanResult {
  readonly id: string;
  status: ScanStatus;
  threats: { level: ThreatLevel; description: string; file?: string }[];
  scannedAt: Date;
}

export interface SecurityPolicy {
  allowedOrigins: string[];
  maxAgentPermissions: string[];
  inputValidation: boolean;
  auditLogging: boolean;
}

export class SecurityDomain {
  private scans: ScanResult[] = [];
  private policy: SecurityPolicy = {
    allowedOrigins: ['localhost', '127.0.0.1'],
    maxAgentPermissions: ['read', 'write', 'execute'],
    inputValidation: true,
    auditLogging: true,
  };
  private events: DomainEvent[] = [];

  scan(id: string): Result<ScanResult> {
    const result: ScanResult = {
      id,
      status: 'scanning',
      threats: [],
      scannedAt: new Date(),
    };

    result.status = result.threats.length === 0 ? 'passed' : 'failed';
    this.scans.push(result);
    this.events.push(createEvent('SecurityScanCompleted', id, {
      status: result.status,
      threatCount: result.threats.length,
    }));
    return ok(result);
  }

  validateInput(input: string): Result<string> {
    if (!this.policy.inputValidation) return ok(input);
    const sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, '');
    if (sanitized !== input) {
      this.events.push(createEvent('InputSanitized', 'system', { original: input.length, sanitized: sanitized.length }));
    }
    return ok(sanitized);
  }

  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  updatePolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    this.events.push(createEvent('PolicyUpdated', 'system', { updates }));
  }

  lastScan(): ScanResult | undefined {
    return this.scans[this.scans.length - 1];
  }

  auditLog(): ScanResult[] {
    return [...this.scans];
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
