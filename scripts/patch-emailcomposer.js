// Patch EmailComposer in LeadAnalyzer workflow and deploy via n8n API
const fs = require('fs');
const http = require('http');

const API_KEY = process.env.N8N_API_KEY;
const WF_ID = 'Nv0iZdRiOB3vWav9';
const BASE = 'http://134.122.87.138:5678';

const newCode = `// EmailComposer V3 — dynamic savings from hh.ru data, no hardcoded numbers
const lead = $input.item.json;
const top3 = (lead.painPoints || []).slice(0, 3);
const AVG_SALARY_RUB = 80000;
const AUTOMATION_FACTOR = 0.35;

// Count jobs from data
const jobCount = lead.jobSignals || (lead.vacancies || []).length || 0;
const baseSaving = jobCount * AVG_SALARY_RUB * AUTOMATION_FACTOR;
const savingsLow = Math.round(baseSaving / 1000) * 1000 || 50000;
const savingsHigh = Math.round(baseSaving * 1.5 / 1000) * 1000 || 150000;
const savingsRange = 'от ' + savingsLow.toLocaleString('ru-RU') + ' до ' + savingsHigh.toLocaleString('ru-RU') + ' руб/мес';

// Evidence-based opening
let evidenceLine = '';
if (lead.vacancies && lead.vacancies.length > 0) {
  const worst = lead.vacancies.reduce((a, b) => (a.daysOpen || 0) > (b.daysOpen || 0) ? a : b, lead.vacancies[0]);
  if (worst.daysOpen > 30) {
    evidenceLine = 'Мы заметили, что вы ищете \\u00ab' + worst.title + '\\u00bb уже ' + worst.daysOpen + ' дней \\u2014 это сигнал, что процесс требует значительных ресурсов.';
  }
}
if (!evidenceLine && lead.siteSignals && lead.siteSignals.length > 0) {
  evidenceLine = lead.siteSignals[0].evidence + ' \\u2014 это область, где AI-автоматизация даёт максимальный эффект.';
}
if (!evidenceLine && jobCount > 0) {
  evidenceLine = 'Мы нашли ' + jobCount + ' открытых вакансий, связанных с ' + lead.companyName + ' \\u2014 это говорит об активном росте и потребности в оптимизации процессов.';
}
if (!evidenceLine) {
  evidenceLine = 'Мы провели анализ ' + lead.companyName + ' по открытым источникам и выявили конкретные области для оптимизации.';
}

// Pain points — no hardcoded dollar amounts
let painSection = '';
for (const p of top3) {
  const evidenceList = (p.evidence || []).slice(0, 2).map(e => '    \\u2014 ' + e).join('\\n');
  painSection += '\\n\\u25CF ' + (p.name || p.area || 'Оптимизация процессов');
  if (evidenceList) painSection += '\\n' + evidenceList;
  const solName = p.solution || 'TZAI Automation';
  painSection += '\\n    Решение: ' + solName + ' \\u2014 по опыту клиентов из вашей отрасли, эффект заметен в первые 2\\u20134 недели';
  painSection += '\\n';
}

const subject = lead.companyName + ' \\u2014 решение проблемы с ' + (top3[0]?.name || top3[0]?.area || 'автоматизацией').toLowerCase();

const body = 'Здравствуйте!\\n\\n'
  + 'Меня зовут Тимур Алишерович, я CEO компании TZAI Company Group \\u2014 мы помогаем бизнесу РФ и СНГ автоматизировать процессы с помощью AI-агентов.\\n\\n'
  + evidenceLine + '\\n\\n'
  + 'Вот, что мы нашли по ' + lead.companyName + ':\\n'
  + painSection + '\\n'
  + 'Потенциал экономии по топ-направлениям: ' + savingsRange + ' (расчёт на основе ' + jobCount + ' вакансий, средней ЗП ' + AVG_SALARY_RUB.toLocaleString('ru-RU') + ' руб и 35% автоматизации).\\n\\n'
  + 'Точный расчёт \\u2014 на 15-минутном звонке. Покажу кейсы из вашей отрасли.\\n\\n'
  + 'С уважением,\\n'
  + 'Тимур Алишерович\\n'
  + 'CEO & AI Automation Architect\\n'
  + 'TZAI Company Group\\n\\n'
  + 'Telegram: @Salvatore_Lazzaro\\n'
  + '+7 905 506 61 55\\n'
  + 'info@tzai.it.com\\n'
  + 'https://tzai.it.com';

// Build HTML
const bodyHtml = body.split('\\n').map(l => {
  if (l.startsWith('\\u25CF')) return '<p style="margin:0 0 4px;font-weight:bold;">' + l + '</p>';
  if (l.trim().startsWith('\\u2014') && !l.includes('мы помогаем')) return '<p style="margin:0 0 4px;color:#666;font-size:12px;padding-left:20px;">' + l.trim() + '</p>';
  if (l.trim().startsWith('Решение:')) return '<p style="margin:0 0 12px;color:#378ADD;font-size:12px;padding-left:20px;">' + l.trim() + '</p>';
  if (!l.trim()) return '';
  return '<p style="margin:0 0 10px;">' + l + '</p>';
}).filter(Boolean).join('\\n');

const html = \`<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#080c1a;padding:20px 30px;">
  <tr><td><span style="font-size:22px;font-weight:bold;color:#fff;">TZ</span><span style="font-size:22px;font-weight:bold;color:#7F77DD;">AI</span>
  <span style="font-size:9px;color:#9F9FC0;letter-spacing:2px;margin-left:8px;">COMPANY GROUP</span></td>
  <td align="right" style="color:#9F9FC0;font-size:11px;">info@tzai.it.com</td></tr>
</table>
<table width="600" align="center" cellpadding="0" cellspacing="0">
  <tr><td style="height:3px;background:#378ADD;width:33%"></td><td style="height:3px;background:#7F77DD;width:34%"></td><td style="height:3px;background:#534AB7;width:33%"></td></tr>
</table>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:white;padding:30px;">
  <tr><td style="font-size:13px;color:#333;line-height:1.8;">
  \${bodyHtml}
  <div style="background:#EEF3FF;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
    <span style="color:#378ADD;font-size:18px;font-weight:bold;">Потенциал экономии: \${savingsRange}</span><br>
    <span style="color:#666;font-size:11px;">на основе данных hh.ru \\u00b7 точный расчёт на звонке</span>
  </div>
  </td></tr>
</table>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:white;padding:0 30px 20px;">
  <tr><td style="border-top:2px solid #7F77DD;padding-top:16px;">
    <p style="margin:0;font-size:15px;font-weight:bold;color:#080c1a;">Тимур Алишерович</p>
    <p style="margin:4px 0;font-size:12px;color:#7F77DD;">CEO & AI Automation Architect</p>
    <p style="margin:4px 0;font-size:12px;color:#666;">TZAI Company Group</p>
    <p style="margin:8px 0;font-size:12px;color:#555;line-height:1.8;">
      Telegram: <a href="https://t.me/Salvatore_Lazzaro" style="color:#378ADD;">@Salvatore_Lazzaro</a><br>
      +7 905 506 61 55<br>
      <a href="mailto:info@tzai.it.com" style="color:#378ADD;">info@tzai.it.com</a><br>
      <a href="https://tzai.it.com" style="color:#378ADD;">tzai.it.com</a>
    </p>
  </td></tr>
</table>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#080c1a;padding:12px 30px;">
  <tr><td style="font-size:10px;color:#9F9FC0;">&copy; 2026 TZAI Company Group</td></tr>
</table>
</body></html>\`;

return {
  json: {
    ...lead,
    subject,
    html,
    plainText: body,
    savingsRange,
    savingsLow,
    savingsHigh,
    jobCount,
  }
};`;

async function main() {
  // 1. Read current workflow
  const wfData = fs.readFileSync(process.env.TEMP + '/n8n_lead_current.json', 'utf8');
  const wf = JSON.parse(wfData);

  // 2. Patch EmailComposer
  const ec = wf.nodes.find(n => n.name === 'EmailComposer (Smart)');
  ec.parameters.jsCode = newCode;

  // 3. Build payload
  const payload = JSON.stringify({
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  // 4. PUT to n8n API
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '134.122.87.138',
      port: 5678,
      path: '/api/v1/workflows/' + WF_ID,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const r = JSON.parse(data);
        if (r.id) {
          const ec2 = r.nodes.find(n => n.name === 'EmailComposer (Smart)');
          console.log('DEPLOYED: id=' + r.id + ' active=' + r.active);
          console.log('Has dynamic savings:', ec2.parameters.jsCode.includes('AVG_SALARY_RUB'));
          console.log('Has tzai.it.com:', ec2.parameters.jsCode.includes('https://tzai.it.com'));
          console.log('No github.io:', !ec2.parameters.jsCode.includes('github.io'));
          console.log('Has savingsRange:', ec2.parameters.jsCode.includes('savingsRange'));
          console.log('Has industry phrase:', ec2.parameters.jsCode.includes('из вашей отрасли'));
          console.log('Has 15-min call:', ec2.parameters.jsCode.includes('15-минутном звонке'));
        } else {
          console.log('ERROR:', data.substring(0, 500));
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

main().catch(e => { console.error(e); process.exit(1); });
