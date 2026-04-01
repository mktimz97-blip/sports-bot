import { v4 as uuid } from 'uuid';

export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;
}

export function createEvent(
  type: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return {
    id: uuid(),
    type,
    aggregateId,
    timestamp: new Date(),
    payload,
  };
}
