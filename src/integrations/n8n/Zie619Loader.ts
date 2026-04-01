/**
 * Zie619 Workflow Loader
 * Loads and categorizes workflows from Zie619/n8n-workflows collection (4300+)
 */

import { N8nConnector, N8nWorkflow } from './N8nConnector';
import { Result, ok, err } from '../../shared/types/Result';
import * as fs from 'fs';
import * as path from 'path';

export interface WorkflowCategory {
  name: string;
  count: number;
  workflows: { id: string; name: string; tags: string[] }[];
}

export class Zie619Loader {
  private basePath: string;
  private connector: N8nConnector;

  constructor(basePath: string, connector: N8nConnector) {
    this.basePath = basePath;
    this.connector = connector;
  }

  /**
   * Scan the Zie619 repo for available workflows
   */
  scan(): WorkflowCategory[] {
    const categories: Map<string, WorkflowCategory> = new Map();

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
            const json = JSON.parse(content);
            const category = this.detectCategory(json, dir);

            if (!categories.has(category)) {
              categories.set(category, { name: category, count: 0, workflows: [] });
            }

            const cat = categories.get(category)!;
            cat.count++;
            cat.workflows.push({
              id: json.id || entry.name.replace('.json', ''),
              name: json.name || entry.name,
              tags: json.tags || [],
            });
          } catch {
            // Skip invalid JSON
          }
        }
      }
    };

    scanDir(this.basePath);
    return Array.from(categories.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Load specific workflows by category for RuFlo integration
   */
  loadByCategory(category: string, limit: number = 10): Result<N8nWorkflow[]> {
    const loaded: N8nWorkflow[] = [];
    const categories = this.scan();
    const cat = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());

    if (!cat) return err(new Error(`Category ${category} not found`));

    for (const wf of cat.workflows.slice(0, limit)) {
      const filePath = this.findWorkflowFile(wf.id);
      if (filePath) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const json = JSON.parse(content);
          const result = this.connector.importWorkflow(json);
          if (result.ok) loaded.push(result.value);
        } catch {
          // Skip
        }
      }
    }

    return ok(loaded);
  }

  /**
   * Get recommended workflows for RuFlo use cases
   */
  getRecommended(): { useCase: string; category: string; description: string }[] {
    return [
      {
        useCase: 'CI/CD Notifications',
        category: 'telegram',
        description: 'Уведомления о деплоях и PR в Telegram',
      },
      {
        useCase: 'AI Code Analysis',
        category: 'ai',
        description: 'AI-powered анализ кода через n8n пайплайны',
      },
      {
        useCase: 'Error Monitoring',
        category: 'monitoring',
        description: 'Мониторинг ошибок и алерты в Slack/Email',
      },
      {
        useCase: 'Client Reports',
        category: 'email',
        description: 'Автоматическая отправка daily report клиентам',
      },
      {
        useCase: 'GitHub Automation',
        category: 'github',
        description: 'Автоматизация GitHub: issues, PR, releases',
      },
      {
        useCase: 'Data Pipeline',
        category: 'data',
        description: 'ETL пайплайны для аналитики и отчётов',
      },
    ];
  }

  private detectCategory(json: Record<string, unknown>, dir: string): string {
    const name = ((json.name as string) || '').toLowerCase();
    const dirName = path.basename(dir).toLowerCase();

    if (name.includes('telegram') || dirName.includes('telegram')) return 'telegram';
    if (name.includes('discord') || dirName.includes('discord')) return 'discord';
    if (name.includes('gmail') || name.includes('email')) return 'email';
    if (name.includes('github') || dirName.includes('github')) return 'github';
    if (name.includes('slack')) return 'slack';
    if (name.includes('ai') || name.includes('gpt') || name.includes('openai')) return 'ai';
    if (name.includes('monitor') || name.includes('alert')) return 'monitoring';
    return 'other';
  }

  private findWorkflowFile(id: string): string | null {
    const search = (dir: string): string | null => {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = search(fullPath);
          if (found) return found;
        } else if (entry.name.includes(id) && entry.name.endsWith('.json')) {
          return fullPath;
        }
      }
      return null;
    };
    return search(this.basePath);
  }
}
