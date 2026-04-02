import { LeadAnalyzer } from '../../src/domains/agent/LeadAnalyzer';
import * as http from 'http';

describe('LeadAnalyzer', () => {
  let analyzer: LeadAnalyzer;
  let webhookServer: http.Server;
  let webhookPayloads: unknown[];

  beforeAll((done) => {
    webhookPayloads = [];
    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        webhookPayloads.push(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    webhookServer.listen(19876, done);
  });

  afterAll((done) => {
    webhookServer.close(done);
  });

  beforeEach(() => {
    webhookPayloads = [];
    analyzer = new LeadAnalyzer({
      webhookUrl: 'http://127.0.0.1:19876/webhook/leadfinder',
      hhApiEnabled: false,
      timeoutMs: 5000,
    });
  });

  it('should instantiate with default config', () => {
    const defaultAnalyzer = new LeadAnalyzer();
    expect(defaultAnalyzer).toBeInstanceOf(LeadAnalyzer);
  });

  it('should return error for invalid URL', async () => {
    const result = await analyzer.analyze('not a url :::');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Invalid URL');
    }
  });

  it('should produce domain events on analysis', async () => {
    // Use a mock server for the site
    const siteServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>TestCorp - Marketing Automation</title>
          <meta name="description" content="We provide CRM and marketing automation solutions"></head>
          <body>
            <p>Our team handles manual data processing, excel reports, and customer support tickets daily.</p>
            <p>We use CRM for lead management and sales pipeline tracking.</p>
          </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => siteServer.listen(19877, resolve));

    try {
      const result = await analyzer.analyze('http://127.0.0.1:19877');
      expect(result.ok).toBe(true);

      if (result.ok) {
        const report = result.value;
        expect(report.companyName).toBeTruthy();
        expect(report.industry).toBeTruthy();
        expect(report.painPoints.length).toBeGreaterThan(0);
        expect(report.solutions.length).toBeGreaterThan(0);
        expect(report.score).toBeGreaterThan(0);
        expect(report.analyzedAt).toBeInstanceOf(Date);
      }

      const events = analyzer.flushEvents();
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].type).toBe('LeadAnalysisStarted');

      // Webhook should have received the report
      expect(webhookPayloads.length).toBe(1);
      const payload = webhookPayloads[0] as Record<string, unknown>;
      expect(payload).toHaveProperty('company');
      expect(payload).toHaveProperty('score');
      expect(payload).toHaveProperty('painPoints');
    } finally {
      await new Promise<void>((resolve) => siteServer.close(() => resolve()));
    }
  });

  it('should detect pain points from HTML content', async () => {
    const siteServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><head><title>DocCo</title></head><body>
          <p>We handle thousands of invoices and contracts manually. Document scanning and PDF processing
          takes our team hours every day. Excel spreadsheets for reporting are error-prone.</p>
        </body></html>
      `);
    });

    await new Promise<void>((resolve) => siteServer.listen(19878, resolve));

    try {
      const result = await analyzer.analyze('http://127.0.0.1:19878');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const areas = result.value.painPoints.map((p) => p.area);
        expect(areas.some((a) => a.includes('Document') || a.includes('Data'))).toBe(true);
      }
    } finally {
      await new Promise<void>((resolve) => siteServer.close(() => resolve()));
    }
  });

  it('should handle unreachable sites gracefully', async () => {
    const result = await analyzer.analyze('http://127.0.0.1:19999');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Analysis failed');
    }
  });

  it('should flush events correctly', () => {
    const events = analyzer.flushEvents();
    expect(events).toEqual([]);
  });
});
