import { createEvent, DomainEvent } from '../../shared/events/DomainEvent';
import { Result, ok, err } from '../../shared/types/Result';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

// ── Types ────────────────────────────────────────

export interface PainPoint {
  area: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  automationPotential: string;
}

export interface TZAISolution {
  name: string;
  description: string;
  estimatedSavings: string;
  implementationWeeks: number;
}

export interface LeadReport {
  readonly id: string;
  companyName: string;
  website: string;
  industry: string;
  companySize: string;
  painPoints: PainPoint[];
  solutions: TZAISolution[];
  contactEmails: string[];
  jobPostings: JobPosting[];
  financialSignals: string[];
  score: number;
  analyzedAt: Date;
}

export interface JobPosting {
  title: string;
  source: 'hh.ru' | 'linkedin' | 'website';
  automationRelevance: boolean;
  keywords: string[];
}

export interface AnalyzerConfig {
  webhookUrl: string;
  hunterApiKey?: string;
  hhApiEnabled: boolean;
  timeoutMs: number;
}

type AnalysisStep = 'fetch' | 'analyze' | 'jobs' | 'financial' | 'painpoints' | 'report' | 'webhook';

// ── LeadAnalyzer Agent ───────────────────────────

export class LeadAnalyzer {
  private events: DomainEvent[] = [];
  private config: AnalyzerConfig;

  constructor(config: Partial<AnalyzerConfig> = {}) {
    this.config = {
      webhookUrl: config.webhookUrl || 'http://134.122.87.138:5678/webhook/leadfinder',
      hunterApiKey: config.hunterApiKey || process.env.HUNTER_API_KEY,
      hhApiEnabled: config.hhApiEnabled !== false,
      timeoutMs: config.timeoutMs || 15000,
    };
  }

  async analyze(websiteUrl: string): Promise<Result<LeadReport>> {
    const reportId = `lead-${Date.now()}`;
    this.emit('LeadAnalysisStarted', reportId, { website: websiteUrl });

    try {
      const domain = this.extractDomain(websiteUrl);
      if (!domain) return err(new Error(`Invalid URL: ${websiteUrl}`));

      const [siteContent, jobPostings, financialSignals] = await Promise.all([
        this.fetchSiteContent(websiteUrl),
        this.searchJobPostings(domain),
        this.findFinancialSignals(domain),
      ]);

      const companyProfile = this.analyzeCompanyProfile(siteContent, domain);
      const painPoints = this.identifyPainPoints(siteContent, jobPostings);
      const solutions = this.recommendSolutions(painPoints);
      const contactEmails = await this.findContactEmails(domain);
      const score = this.calculateLeadScore(painPoints, jobPostings, financialSignals);

      const report: LeadReport = {
        id: reportId,
        companyName: companyProfile.name,
        website: websiteUrl,
        industry: companyProfile.industry,
        companySize: companyProfile.size,
        painPoints,
        solutions,
        contactEmails,
        jobPostings,
        financialSignals,
        score,
        analyzedAt: new Date(),
      };

      this.emit('LeadAnalysisCompleted', reportId, {
        company: report.companyName,
        score,
        painPointCount: painPoints.length,
        solutionCount: solutions.length,
      });

      await this.sendToWebhook(report);
      return ok(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit('LeadAnalysisFailed', reportId, { error: message });
      return err(new Error(`Analysis failed: ${message}`));
    }
  }

  // ── Step 1: Fetch & Parse Site ─────────────────

  private async fetchSiteContent(siteUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new url.URL(siteUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(siteUrl, {
        headers: { 'User-Agent': 'TZAI-LeadAnalyzer/1.0' },
        timeout: this.config.timeoutMs,
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchSiteContent(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    });
  }

  // ── Step 2: Analyze Company Profile ────────────

  private analyzeCompanyProfile(html: string, domain: string): { name: string; industry: string; size: string } {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogName = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/i);
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const text = this.stripHtml(html).toLowerCase();

    const name = ogName?.[1] || titleMatch?.[1]?.split(/[|–—-]/)[0]?.trim() || domain.split('.')[0];
    const industry = this.detectIndustry(text);
    const size = this.detectCompanySize(text);

    return { name, industry, size };
  }

  private detectIndustry(text: string): string {
    const industries: Record<string, string[]> = {
      'IT / Software': ['software', 'saas', 'cloud', 'devops', 'api', 'platform', 'tech', 'digital'],
      'Marketing / Advertising': ['marketing', 'advertising', 'seo', 'ppc', 'branding', 'creative agency'],
      'Finance / Banking': ['fintech', 'banking', 'payment', 'insurance', 'investment', 'financial'],
      'Healthcare': ['health', 'medical', 'pharma', 'clinic', 'patient', 'telemedicine'],
      'E-commerce / Retail': ['ecommerce', 'e-commerce', 'retail', 'shop', 'store', 'marketplace'],
      'Manufacturing': ['manufacturing', 'production', 'factory', 'industrial', 'supply chain'],
      'Education': ['education', 'learning', 'training', 'university', 'courses', 'edtech'],
      'Logistics': ['logistics', 'shipping', 'delivery', 'warehouse', 'transport', 'freight'],
      'Real Estate': ['real estate', 'property', 'construction', 'building', 'architecture'],
      'Consulting': ['consulting', 'advisory', 'strategy', 'management consulting'],
    };

    let best = 'General';
    let bestCount = 0;
    for (const [industry, keywords] of Object.entries(industries)) {
      const count = keywords.filter((kw) => text.includes(kw)).length;
      if (count > bestCount) { best = industry; bestCount = count; }
    }
    return best;
  }

  private detectCompanySize(text: string): string {
    if (/\b(enterprise|global|1000\+|тыс\.?\s*сотруд)/i.test(text)) return 'Enterprise (1000+)';
    if (/\b(mid-?size|100\+|200\+|сотни\s*сотруд)/i.test(text)) return 'Mid-market (100-999)';
    if (/\b(startup|small team|команда из|10\+|50\+)/i.test(text)) return 'SMB (10-99)';
    return 'Unknown';
  }

  // ── Step 3: Job Postings Search ────────────────

  private async searchJobPostings(domain: string): Promise<JobPosting[]> {
    const results: JobPosting[] = [];
    const companyName = domain.split('.')[0];

    if (this.config.hhApiEnabled) {
      try {
        const hhResults = await this.searchHH(companyName);
        results.push(...hhResults);
      } catch { /* hh.ru unavailable — continue */ }
    }

    results.push(...this.inferLinkedInPostings(companyName));
    return results;
  }

  private async searchHH(companyName: string): Promise<JobPosting[]> {
    const apiUrl = `https://api.hh.ru/vacancies?text=${encodeURIComponent(companyName)}&per_page=10&area=1`;
    const raw = await this.httpGet(apiUrl);

    try {
      const data = JSON.parse(raw);
      const items: Array<{ name: string }> = data.items || [];
      const automationKeywords = [
        'автоматизация', 'automation', 'devops', 'data', 'analyst', 'crm',
        'erp', 'bi', 'аналитик', 'процесс', 'интеграция', 'integration',
        'python', 'excel', 'отчёт', 'report', '1с', '1c',
      ];

      return items.slice(0, 10).map((v) => {
        const title = v.name || '';
        const lower = title.toLowerCase();
        const matched = automationKeywords.filter((kw) => lower.includes(kw));
        return {
          title,
          source: 'hh.ru' as const,
          automationRelevance: matched.length > 0,
          keywords: matched,
        };
      });
    } catch {
      return [];
    }
  }

  private inferLinkedInPostings(companyName: string): JobPosting[] {
    return [{
      title: `${companyName} — LinkedIn job search pending`,
      source: 'linkedin' as const,
      automationRelevance: false,
      keywords: [],
    }];
  }

  // ── Step 4: Financial Signals ──────────────────

  private async findFinancialSignals(domain: string): Promise<string[]> {
    const signals: string[] = [];
    const companyName = domain.split('.')[0];

    try {
      const tenderUrl = `https://api.hh.ru/employers?text=${encodeURIComponent(companyName)}&per_page=3`;
      const raw = await this.httpGet(tenderUrl);
      const data = JSON.parse(raw);
      const employers: Array<{ name: string; open_vacancies: number }> = data.items || [];
      for (const emp of employers) {
        if (emp.open_vacancies > 5) {
          signals.push(`${emp.name}: ${emp.open_vacancies} open positions (active hiring = growth signal)`);
        }
      }
    } catch { /* continue without hh employer data */ }

    signals.push(`Check zakupki.gov.ru for "${companyName}" government tenders`);
    signals.push(`Check bo.nalog.ru for "${companyName}" financial reports`);

    return signals;
  }

  // ── Step 5: Pain Points ────────────────────────

  private identifyPainPoints(html: string, jobs: JobPosting[]): PainPoint[] {
    const text = this.stripHtml(html).toLowerCase();
    const points: PainPoint[] = [];

    const patterns: Array<{ area: string; keywords: string[]; description: string; solution: string }> = [
      {
        area: 'Manual Data Processing',
        keywords: ['excel', 'spreadsheet', 'manual', 'ручной', 'таблиц', 'отчёт', 'report'],
        description: 'Heavy reliance on manual data entry and spreadsheet-based workflows',
        solution: 'AI-powered data pipeline automation',
      },
      {
        area: 'Customer Support Overload',
        keywords: ['support', 'поддержк', 'helpdesk', 'ticket', 'обращен', 'клиент', 'customer'],
        description: 'High volume of repetitive customer inquiries handled manually',
        solution: 'AI chatbot + ticket routing automation',
      },
      {
        area: 'CRM / Sales Process',
        keywords: ['crm', 'sales', 'продаж', 'лид', 'lead', 'funnel', 'воронк', 'pipeline'],
        description: 'Unoptimized sales pipeline with manual lead tracking',
        solution: 'AI lead scoring + CRM automation',
      },
      {
        area: 'Content & Marketing',
        keywords: ['content', 'контент', 'seo', 'marketing', 'маркетинг', 'social media', 'smm'],
        description: 'Time-intensive content creation and marketing campaign management',
        solution: 'AI content generation + campaign automation',
      },
      {
        area: 'HR & Recruitment',
        keywords: ['hr', 'recruit', 'hiring', 'подбор', 'кадр', 'персонал', 'vacancy', 'вакансия'],
        description: 'Manual screening of candidates and slow hiring pipeline',
        solution: 'AI resume screening + interview scheduling',
      },
      {
        area: 'Document Processing',
        keywords: ['document', 'документ', 'invoice', 'счёт', 'contract', 'договор', 'pdf', 'scan'],
        description: 'Manual document handling, extraction, and classification',
        solution: 'AI document OCR + classification pipeline',
      },
      {
        area: 'Legacy System Integration',
        keywords: ['1с', '1c', 'erp', 'legacy', 'интеграц', 'api', 'integration', 'миграц'],
        description: 'Disconnected systems requiring manual data synchronization',
        solution: 'AI-assisted API integration + data sync',
      },
      {
        area: 'Quality & Monitoring',
        keywords: ['quality', 'качеств', 'monitoring', 'мониторинг', 'kpi', 'метрик', 'dashboa'],
        description: 'Lack of real-time visibility into operational metrics',
        solution: 'AI-powered analytics dashboard + anomaly detection',
      },
    ];

    for (const p of patterns) {
      const siteHits = p.keywords.filter((kw) => text.includes(kw)).length;
      const jobHits = jobs.filter((j) => j.automationRelevance && j.keywords.some((k) => p.keywords.includes(k))).length;
      const totalHits = siteHits + jobHits;

      if (totalHits >= 2) {
        points.push({
          area: p.area,
          description: p.description,
          severity: totalHits >= 4 ? 'high' : totalHits >= 3 ? 'medium' : 'low',
          automationPotential: p.solution,
        });
      }
    }

    if (points.length === 0) {
      points.push({
        area: 'General Process Automation',
        description: 'Potential for workflow automation across departments',
        severity: 'medium',
        automationPotential: 'Business process audit + targeted AI automation',
      });
    }

    return points;
  }

  // ── Step 6: Recommend Solutions ─────────────────

  private recommendSolutions(painPoints: PainPoint[]): TZAISolution[] {
    const solutionMap: Record<string, TZAISolution> = {
      'Manual Data Processing': {
        name: 'TZAI DataFlow',
        description: 'Automated data pipeline: extraction, transformation, reporting via AI agents',
        estimatedSavings: '$4,200/mo',
        implementationWeeks: 3,
      },
      'Customer Support Overload': {
        name: 'TZAI SupportBot',
        description: 'Multi-lingual AI chatbot with smart ticket routing and escalation',
        estimatedSavings: '$6,791/mo',
        implementationWeeks: 2,
      },
      'CRM / Sales Process': {
        name: 'TZAI LeadEngine',
        description: 'AI-powered lead scoring, automated follow-ups, pipeline optimization',
        estimatedSavings: '$5,500/mo',
        implementationWeeks: 4,
      },
      'Content & Marketing': {
        name: 'TZAI ContentGen',
        description: 'AI content creation, SEO optimization, multi-channel campaign automation',
        estimatedSavings: '$3,800/mo',
        implementationWeeks: 2,
      },
      'HR & Recruitment': {
        name: 'TZAI HireSmart',
        description: 'AI resume screening, candidate scoring, interview scheduling automation',
        estimatedSavings: '$4,100/mo',
        implementationWeeks: 3,
      },
      'Document Processing': {
        name: 'TZAI DocProcessor',
        description: 'OCR + AI classification pipeline for invoices, contracts, and documents',
        estimatedSavings: '$3,500/mo',
        implementationWeeks: 3,
      },
      'Legacy System Integration': {
        name: 'TZAI IntegrationHub',
        description: 'AI-assisted API connectors + data synchronization across legacy systems',
        estimatedSavings: '$7,200/mo',
        implementationWeeks: 6,
      },
      'Quality & Monitoring': {
        name: 'TZAI Insights',
        description: 'Real-time KPI dashboards with AI anomaly detection and alerting',
        estimatedSavings: '$2,900/mo',
        implementationWeeks: 2,
      },
      'General Process Automation': {
        name: 'TZAI ProcessAudit',
        description: 'Comprehensive business process audit + targeted automation roadmap',
        estimatedSavings: '$5,000/mo',
        implementationWeeks: 4,
      },
    };

    return painPoints.map((pp) => solutionMap[pp.area] || solutionMap['General Process Automation']);
  }

  // ── Step 7: Contact Discovery ──────────────────

  private async findContactEmails(domain: string): Promise<string[]> {
    if (!this.config.hunterApiKey) return [`info@${domain}`, `contact@${domain}`];

    try {
      const apiUrl = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${this.config.hunterApiKey}&limit=5&type=personal`;
      const raw = await this.httpGet(apiUrl);
      const data = JSON.parse(raw);
      const emails: Array<{ value: string; confidence: number }> = data?.data?.emails || [];
      const filtered = emails.filter((e) => e.confidence >= 70).map((e) => e.value);
      return filtered.length > 0 ? filtered : [`info@${domain}`];
    } catch {
      return [`info@${domain}`];
    }
  }

  // ── Webhook Integration ────────────────────────

  private async sendToWebhook(report: LeadReport): Promise<void> {
    const payload = JSON.stringify({
      domain: report.website,
      company: report.companyName,
      industry: report.industry,
      score: report.score,
      painPoints: report.painPoints.map((p) => p.area),
      topSolution: report.solutions[0]?.name || 'TZAI ProcessAudit',
      contactEmails: report.contactEmails,
      report,
    });

    return new Promise((resolve, reject) => {
      const parsed = new url.URL(this.config.webhookUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: this.config.timeoutMs,
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          this.emit('LeadWebhookSent', report.id, { status: res.statusCode, webhook: this.config.webhookUrl });
          resolve();
        });
      });
      req.on('error', (e) => {
        this.emit('LeadWebhookFailed', report.id, { error: e.message });
        reject(e);
      });
      req.write(payload);
      req.end();
    });
  }

  // ── Lead Scoring ───────────────────────────────

  private calculateLeadScore(painPoints: PainPoint[], jobs: JobPosting[], signals: string[]): number {
    let score = 0;
    score += painPoints.length * 15;
    score += painPoints.filter((p) => p.severity === 'high').length * 10;
    score += jobs.filter((j) => j.automationRelevance).length * 5;
    score += signals.length * 3;
    return Math.min(100, score);
  }

  // ── Batch Analysis ─────────────────────────────

  async analyzeBatch(urls: string[]): Promise<Result<LeadReport[]>> {
    const reports: LeadReport[] = [];
    const errors: string[] = [];

    for (const siteUrl of urls) {
      const result = await this.analyze(siteUrl);
      if (result.ok) {
        reports.push(result.value);
      } else {
        errors.push(`${siteUrl}: ${result.error.message}`);
      }
    }

    this.emit('LeadBatchCompleted', 'batch', {
      total: urls.length,
      success: reports.length,
      failed: errors.length,
    });

    return ok(reports);
  }

  // ── Helpers ────────────────────────────────────

  private extractDomain(siteUrl: string): string | null {
    try {
      const parsed = new url.URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async httpGet(requestUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new url.URL(requestUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(requestUrl, {
        headers: { 'User-Agent': 'TZAI-LeadAnalyzer/1.0', Accept: 'application/json' },
        timeout: this.config.timeoutMs,
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  private emit(type: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.push(createEvent(type, aggregateId, payload));
  }

  flushEvents(): DomainEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }
}
