import { DomainEvent } from './DomainEvent';

type EventHandler = (event: DomainEvent) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((e) => this.publish(e)));
  }
}
