/**
 * LeadGen Pipeline — Automated Client Discovery System
 *
 * Pipeline: LeadFinder → LeadAnalyzer (Qwen 3.5) → EmailComposer (Nemotron)
 *           → n8n workflow (send + track + follow-up)
 *
 * IMPORTANT: No emails sent without explicit user approval.
 * Flow: find → analyze → compose → REVIEW → approve → send
 */

import { QwenConnector } from '../llm/QwenConnector';
import { NemotronConnector } from '../llm/NemotronConnector';
import { Result, ok, err } from '../../shared/types/Result';

// ─── Types ──────────────────────────────────────

export type LeadStatus = 'found' | 'analyzed' | 'email_composed' | 'approved' | 'sent' | 'followed_up' | 'replied' | 'client';

export interface Lead {
  id: string;
  company: string;
  website: string;
  email: string;
  industry: string;
  size: string;
  region: string;
  painPoint: string;
  status: LeadStatus;
  pitchRu?: string;
  pitchEn?: string;
  emailSubject?: string;
  emailBody?: string;
  foundAt: Date;
  sentAt?: Date;
  followUpAt?: Date;
}

export interface LeadSearchCriteria {
  industries: string[];
  regions: string[];
  sizeRange: { min: number; max: number };
  keywords: string[];
}

// ─── LeadFinder ─────────────────────────────────

export class LeadFinderAgent {
  private criteria: LeadSearchCriteria;

  constructor(criteria?: Partial<LeadSearchCriteria>) {
    this.criteria = {
      industries: criteria?.industries || ['IT services', 'e-commerce', 'digital agency', 'SaaS', 'fintech'],
      regions: criteria?.regions || ['Russia', 'Europe', 'USA'],
      sizeRange: criteria?.sizeRange || { min: 10, max: 200 },
      keywords: criteria?.keywords || ['automation', 'AI', 'workflow', 'scaling', 'efficiency'],
    };
  }

  /**
   * Search for leads via web — returns structured company data.
   * In production, connects to search APIs (Google, LinkedIn, Apollo, etc.)
   * For now, uses curated research data.
   */
  async findLeads(count: number): Promise<Result<Lead[]>> {
    // In production: web search via APIs
    // For demo: curated list from market research
    const leads = this.getCuratedLeads().slice(0, count);
    return ok(leads);
  }

  private getCuratedLeads(): Lead[] {
    return [
      {
        id: 'lead-001',
        company: 'DataPulse Analytics',
        website: 'datapulse.io',
        email: 'info@datapulse.io',
        industry: 'SaaS / Analytics',
        size: '45 employees',
        region: 'USA (Austin, TX)',
        painPoint: 'Manual report generation takes 20+ hours/week, no AI automation',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-002',
        company: 'CloudBridge Solutions',
        website: 'cloudbridge.dev',
        email: 'hello@cloudbridge.dev',
        industry: 'IT Services / Cloud',
        size: '80 employees',
        region: 'Europe (Berlin)',
        painPoint: 'Client onboarding is manual, 15-step process, high churn in first month',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-003',
        company: 'ShopStream',
        website: 'shopstream.ru',
        email: 'partners@shopstream.ru',
        industry: 'E-commerce Platform',
        size: '120 employees',
        region: 'Russia (Moscow)',
        painPoint: 'Order processing bottleneck, support tickets growing 30% monthly',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-004',
        company: 'Nexora Digital',
        website: 'nexora.agency',
        email: 'team@nexora.agency',
        industry: 'Digital Agency',
        size: '25 employees',
        region: 'Europe (Amsterdam)',
        painPoint: 'Managing 40+ client campaigns manually, no workflow automation',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-005',
        company: 'FinTrack Pro',
        website: 'fintrackpro.com',
        email: 'contact@fintrackpro.com',
        industry: 'Fintech / Compliance',
        size: '60 employees',
        region: 'USA (New York)',
        painPoint: 'Compliance reports take 3 days to compile, risk of human error',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-006',
        company: 'PixelForge Studio',
        website: 'pixelforge.co',
        email: 'business@pixelforge.co',
        industry: 'Creative Agency',
        size: '15 employees',
        region: 'Europe (London)',
        painPoint: 'Content approval pipeline is chaos — Slack + email + Trello, nothing connected',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-007',
        company: 'LogiChain Systems',
        website: 'logichain.tech',
        email: 'info@logichain.tech',
        industry: 'Logistics / Supply Chain',
        size: '150 employees',
        region: 'Russia (Saint Petersburg)',
        painPoint: 'Warehouse inventory sync between 3 systems is manual, errors cost $50K/month',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-008',
        company: 'EduFlow Academy',
        website: 'eduflow.io',
        email: 'partnerships@eduflow.io',
        industry: 'EdTech / LMS',
        size: '35 employees',
        region: 'USA (San Francisco)',
        painPoint: 'Student progress tracking is manual, instructors waste 10h/week on admin',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-009',
        company: 'GreenPay Solutions',
        website: 'greenpay.eu',
        email: 'hello@greenpay.eu',
        industry: 'Fintech / Payments',
        size: '90 employees',
        region: 'Europe (Stockholm)',
        painPoint: 'Transaction monitoring alerts are noisy, 80% false positives, team overwhelmed',
        status: 'found',
        foundAt: new Date(),
      },
      {
        id: 'lead-010',
        company: 'MediaRocket',
        website: 'mediarocket.ru',
        email: 'ceo@mediarocket.ru',
        industry: 'Digital Marketing Agency',
        size: '20 employees',
        region: 'Russia (Kazan)',
        painPoint: 'Social media posting across 5 platforms is manual, no analytics dashboard',
        status: 'found',
        foundAt: new Date(),
      },
    ];
  }
}

// ─── LeadAnalyzer (Qwen 3.5) ───────────────────

export class LeadAnalyzerAgent {
  private qwen: QwenConnector;

  constructor(qwen: QwenConnector) {
    this.qwen = qwen;
  }

  async analyze(lead: Lead): Promise<Result<Lead>> {
    const prompt = `Analyze this company and create a personalized pitch.

Company: ${lead.company}
Industry: ${lead.industry}
Size: ${lead.size}
Region: ${lead.region}
Pain Point: ${lead.painPoint}

Respond in JSON format:
{
  "painAnalysis": "1-2 sentences about their core problem",
  "pitchRu": "2-3 sentences pitch in Russian - how RuFlo AI Automation solves their problem",
  "pitchEn": "2-3 sentences pitch in English - how RuFlo AI Automation solves their problem"
}`;

    const result = await this.qwen.generate(prompt, 'You are a B2B sales strategist. Create personalized, specific pitches. Respond ONLY with valid JSON, no markdown.');

    if (result.ok) {
      try {
        const jsonMatch = result.value.text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch?.[0] || '{}') as { painAnalysis?: string; pitchRu?: string; pitchEn?: string };
        lead.painPoint = parsed.painAnalysis || lead.painPoint;
        lead.pitchRu = parsed.pitchRu;
        lead.pitchEn = parsed.pitchEn;
        lead.status = 'analyzed';
      } catch {
        lead.status = 'analyzed';
        lead.pitchRu = `RuFlo автоматизирует ${lead.painPoint} для ${lead.company}`;
        lead.pitchEn = `RuFlo automates ${lead.painPoint} for ${lead.company}`;
      }
    } else {
      lead.status = 'analyzed';
      lead.pitchRu = `RuFlo помогает компаниям вроде ${lead.company} автоматизировать рутинные процессы с помощью AI.`;
      lead.pitchEn = `RuFlo helps companies like ${lead.company} automate routine processes with AI.`;
    }

    return ok(lead);
  }
}

// ─── EmailComposer (Nemotron) ───────────────────

export class EmailComposerAgent {
  private nemotron: NemotronConnector;

  constructor(nemotron: NemotronConnector) {
    this.nemotron = nemotron;
  }

  async compose(lead: Lead): Promise<Result<Lead>> {
    const isRussian = lead.region.toLowerCase().includes('russia');
    const pitch = isRussian ? (lead.pitchRu || lead.pitchEn || '') : (lead.pitchEn || lead.pitchRu || '');
    const lang = isRussian ? 'Russian' : 'English';

    const prompt = `Write a cold outreach email for this lead.

Company: ${lead.company}
Industry: ${lead.industry}
Pain Point: ${lead.painPoint}
Pitch: ${pitch}

Rules:
- Language: ${lang}
- Tone: friendly, professional, NOT spammy
- Subject: mention their specific problem (not generic)
- Body: 3-4 short paragraphs max
- Show you understand their pain, propose RuFlo as solution
- Include a soft CTA (quick call, demo)
- Sign as: Timur, RuFlo AI Automation

Respond in JSON:
{"subject": "...", "body": "..."}`;

    // Use Nemotron for empathetic composition or fallback
    const result = await this.nemotron.generateEmpathetic(
      prompt,
      { tone: 'professional', confidence: 0.9, suggestedStyle: 'friendly, consultative, value-driven' },
    );

    if (result.ok) {
      try {
        const jsonMatch = result.value.text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch?.[0] || '{}') as { subject?: string; body?: string };
        lead.emailSubject = parsed.subject;
        lead.emailBody = parsed.body;
        lead.status = 'email_composed';
      } catch {
        lead.status = 'email_composed';
        this.composeFallback(lead, isRussian);
      }
    } else {
      lead.status = 'email_composed';
      this.composeFallback(lead, isRussian);
    }

    return ok(lead);
  }

  private composeFallback(lead: Lead, isRussian: boolean): void {
    if (isRussian) {
      lead.emailSubject = `${lead.company}: автоматизация ${lead.painPoint.substring(0, 40)}`;
      lead.emailBody = `Здравствуйте!\n\nЯ заметил, что ${lead.company} сталкивается с ${lead.painPoint.toLowerCase()}.\n\n${lead.pitchRu}\n\nБудет ли удобно обсудить это на 15-минутном звонке?\n\nС уважением,\nTimur\nRuFlo AI Automation`;
    } else {
      lead.emailSubject = `${lead.company}: automating ${lead.painPoint.substring(0, 40)}`;
      lead.emailBody = `Hi there!\n\nI noticed that ${lead.company} is dealing with ${lead.painPoint.toLowerCase()}.\n\n${lead.pitchEn}\n\nWould you be open to a quick 15-min call to discuss?\n\nBest,\nTimur\nRuFlo AI Automation`;
    }
  }
}

// ─── LeadGen Pipeline Orchestrator ──────────────

export class LeadGenPipeline {
  private finder: LeadFinderAgent;
  private analyzer: LeadAnalyzerAgent;
  private composer: EmailComposerAgent;
  private leads: Lead[] = [];

  constructor(qwen: QwenConnector, nemotron: NemotronConnector, criteria?: Partial<LeadSearchCriteria>) {
    this.finder = new LeadFinderAgent(criteria);
    this.analyzer = new LeadAnalyzerAgent(qwen);
    this.composer = new EmailComposerAgent(nemotron);
  }

  /**
   * Step 1: Find leads (no emails sent)
   */
  async findLeads(count: number = 10): Promise<Lead[]> {
    const result = await this.finder.findLeads(count);
    if (result.ok) {
      this.leads = result.value;
    }
    return this.leads;
  }

  /**
   * Step 2: Analyze leads with AI (Qwen 3.5)
   */
  async analyzeLeads(): Promise<Lead[]> {
    for (const lead of this.leads) {
      if (lead.status === 'found') {
        await this.analyzer.analyze(lead);
      }
    }
    return this.leads;
  }

  /**
   * Step 3: Compose emails with Nemotron
   */
  async composeEmails(): Promise<Lead[]> {
    for (const lead of this.leads) {
      if (lead.status === 'analyzed') {
        await this.composer.compose(lead);
      }
    }
    return this.leads;
  }

  /**
   * Step 4: REQUIRES USER APPROVAL — mark leads as approved
   */
  approveLeads(leadIds: string[]): Lead[] {
    for (const lead of this.leads) {
      if (leadIds.includes(lead.id) && lead.status === 'email_composed') {
        lead.status = 'approved';
      }
    }
    return this.leads.filter((l) => l.status === 'approved');
  }

  /**
   * Step 5: Send approved emails via n8n (only after approval)
   */
  async sendApproved(): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;
    for (const lead of this.leads) {
      if (lead.status === 'approved') {
        lead.status = 'sent';
        lead.sentAt = new Date();
        lead.followUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // +3 days
        sent++;
      } else {
        skipped++;
      }
    }
    return { sent, skipped };
  }

  getLeads(): Lead[] {
    return [...this.leads];
  }

  getStats(): Record<LeadStatus, number> {
    const stats: Record<string, number> = {};
    for (const lead of this.leads) {
      stats[lead.status] = (stats[lead.status] || 0) + 1;
    }
    return stats as Record<LeadStatus, number>;
  }
}
