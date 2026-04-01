import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';

export interface MemoryEntry {
  readonly key: string;
  value: string;
  namespace: string;
  tags: string[];
  vector?: number[];
  confidence: number;
  accessCount: number;
  readonly createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
}

export class MemoryDomain {
  private entries = new Map<string, MemoryEntry>();
  private events: DomainEvent[] = [];

  store(key: string, value: string, namespace: string = 'default', tags: string[] = []): Result<MemoryEntry> {
    const entry: MemoryEntry = {
      key, value, namespace, tags,
      confidence: 1.0,
      accessCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.entries.set(`${namespace}:${key}`, entry);
    this.events.push(createEvent('MemoryStored', key, { namespace, tags }));
    return ok(entry);
  }

  retrieve(key: string, namespace: string = 'default'): Result<MemoryEntry> {
    const entry = this.entries.get(`${namespace}:${key}`);
    if (!entry) return err(new Error(`Memory ${namespace}:${key} not found`));
    entry.accessCount++;
    entry.confidence = Math.min(1.0, entry.confidence + 0.03);
    return ok(entry);
  }

  search(query: string, namespace?: string, limit: number = 10): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const entry of this.entries.values()) {
      if (namespace && entry.namespace !== namespace) continue;
      const inValue = entry.value.toLowerCase().includes(queryLower);
      const inTags = entry.tags.some((t) => t.toLowerCase().includes(queryLower));
      const inKey = entry.key.toLowerCase().includes(queryLower);

      if (inValue || inTags || inKey) {
        const score = (inKey ? 0.5 : 0) + (inTags ? 0.3 : 0) + (inValue ? 0.2 : 0);
        results.push({ entry, score: score * entry.confidence });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  list(namespace?: string): MemoryEntry[] {
    const all = Array.from(this.entries.values());
    return namespace ? all.filter((e) => e.namespace === namespace) : all;
  }

  delete(key: string, namespace: string = 'default'): Result<void> {
    const fullKey = `${namespace}:${key}`;
    if (!this.entries.has(fullKey)) return err(new Error(`Memory ${fullKey} not found`));
    this.entries.delete(fullKey);
    this.events.push(createEvent('MemoryDeleted', key, { namespace }));
    return ok(undefined);
  }

  stats(): { total: number; namespaces: string[]; avgConfidence: number } {
    const entries = Array.from(this.entries.values());
    const namespaces = [...new Set(entries.map((e) => e.namespace))];
    const avgConfidence = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
      : 0;
    return { total: entries.length, namespaces, avgConfidence };
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
