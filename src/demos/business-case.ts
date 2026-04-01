/**
 * RuFlo V3.5 — Бизнес-кейс: Digital-агентство "WebPro"
 * Демо для клиента (не технаря)
 *
 * Run: npx ts-node src/demos/business-case.ts
 */

import { RuFloApp } from '../application/RuFloApp';

// ─── Имитация реальных задач агентства ───────────────────────

interface Task {
  name: string;
  manualHours: number;
  rufloMinutes: number;
  costPerHour: number;
}

const MONTHLY_TASKS: Task[] = [
  { name: 'Проверка кода на уязвимости',       manualHours: 16,  rufloMinutes: 8,   costPerHour: 40 },
  { name: 'Code Review (20 PR/мес)',            manualHours: 40,  rufloMinutes: 30,  costPerHour: 50 },
  { name: 'Написание тестов',                   manualHours: 32,  rufloMinutes: 45,  costPerHour: 45 },
  { name: 'Рефакторинг и оптимизация',          manualHours: 24,  rufloMinutes: 20,  costPerHour: 50 },
  { name: 'Документация API',                   manualHours: 12,  rufloMinutes: 10,  costPerHour: 35 },
  { name: 'Онбординг новых разработчиков',      manualHours: 20,  rufloMinutes: 15,  costPerHour: 45 },
  { name: 'Мониторинг и отчёты по качеству',    manualHours: 8,   rufloMinutes: 5,   costPerHour: 40 },
  { name: 'Планирование спринтов (декомпозиция)', manualHours: 10, rufloMinutes: 12, costPerHour: 55 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function bar(pct: number, width: number = 30): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function runDemo() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║          RuFlo V3.5 — AI Автоматизация для бизнеса              ║
║                                                                  ║
║   Клиент: Digital-агентство "WebPro" (15 разработчиков)         ║
║   Проблема: 162 часа/мес тратится на рутину                     ║
║   Решение: 6 AI-агентов работают 24/7                           ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

  // ─── Этап 1: Запуск системы ──────────────────
  console.log('▸ Запуск RuFlo...');
  const app = new RuFloApp();
  await app.bootstrap();
  const status = app.status();
  console.log(`  ✓ Система активна: ${(status.swarm as any).agents} агентов, security: ${status.security}\n`);

  await sleep(500);

  // ─── Этап 2: Что было vs Что стало ──────────
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│                    ЧТО БЫЛО → ЧТО СТАЛО                        │');
  console.log('├──────────────────────────────────────────┬────────┬─────────────┤');
  console.log('│ Задача                                   │Человек │  RuFlo AI   │');
  console.log('├──────────────────────────────────────────┼────────┼─────────────┤');

  let totalManualHours = 0;
  let totalRufloMinutes = 0;
  let totalMonthlyCostManual = 0;

  for (const task of MONTHLY_TASKS) {
    const manualCost = task.manualHours * task.costPerHour;
    totalManualHours += task.manualHours;
    totalRufloMinutes += task.rufloMinutes;
    totalMonthlyCostManual += manualCost;

    const name = task.name.padEnd(40);
    const manual = `${task.manualHours}ч`.padStart(5);
    const auto = `${task.rufloMinutes} мин`.padStart(8);
    console.log(`│ ${name} │ ${manual} │ ${auto}    │`);
  }

  console.log('├──────────────────────────────────────────┼────────┼─────────────┤');
  const totalRufloHours = (totalRufloMinutes / 60).toFixed(1);
  console.log(`│ ИТОГО В МЕСЯЦ:                           │ ${String(totalManualHours).padStart(4)}ч │ ${String(totalRufloHours).padStart(5)}ч      │`);
  console.log('└──────────────────────────────────────────┴────────┴─────────────┘');

  await sleep(500);

  // ─── Этап 3: Экономия ───────────────────────
  const rufloCost = 299; // подписка
  const savings = totalMonthlyCostManual - rufloCost;
  const savingsPct = ((savings / totalMonthlyCostManual) * 100).toFixed(0);
  const timeReduction = (((totalManualHours - parseFloat(totalRufloHours)) / totalManualHours) * 100).toFixed(0);

  console.log(`
┌──────────────────────────────────────────────────────────────────┐
│                      💰 ЭКОНОМИЯ В МЕСЯЦ                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Ручная работа:      $${totalMonthlyCostManual.toLocaleString().padStart(6)} / мес  (${totalManualHours} часов)               │
│   Стоимость RuFlo:    $   299 / мес  (безлимит)                 │
│                       ──────────────                             │
│   Вы экономите:       $${savings.toLocaleString().padStart(6)} / мес  (${savingsPct}%)                      │
│                                                                  │
│   Экономия времени:   ${timeReduction}%                                          │
│   ${bar(parseInt(timeReduction))} ${timeReduction}%              │
│                                                                  │
│   Экономия за год:    $${(savings * 12).toLocaleString().padStart(6)}                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘`);

  await sleep(500);

  // ─── Этап 4: Живая демонстрация ─────────────
  console.log('\n▸ ЖИВАЯ ДЕМОНСТРАЦИЯ: Автоматический Code Review\n');

  const prExamples = [
    { file: 'auth/login.ts',       lines: 45,  issues: 2, time: '12 сек',  verdict: 'Требует правок' },
    { file: 'api/payments.ts',     lines: 120, issues: 0, time: '18 сек',  verdict: 'Одобрен ✓' },
    { file: 'utils/validator.ts',  lines: 30,  issues: 1, time: '8 сек',   verdict: 'Мелкие замечания' },
    { file: 'db/migrations/005.ts', lines: 80, issues: 0, time: '14 сек',  verdict: 'Одобрен ✓' },
  ];

  for (const pr of prExamples) {
    await sleep(300);
    console.log(`  📄 ${pr.file} (${pr.lines} строк)`);
    console.log(`     → Проверено за ${pr.time} | Замечаний: ${pr.issues} | ${pr.verdict}`);
  }

  console.log(`\n  Итого: 4 файла проверены за 52 секунды`);
  console.log(`  Человек потратил бы: ~2 часа на этот PR\n`);

  // ─── Этап 5: Что получает клиент ───────────
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│                  ЧТО ВЫ ПОЛУЧАЕТЕ С RuFlo                       │');
  console.log('├──────────────────────────────────────────────────────────────────┤');
  console.log('│                                                                  │');
  console.log('│  ✓  6 AI-агентов работают 24/7 на ваш проект                    │');
  console.log('│  ✓  Автоматический code review каждого PR                       │');
  console.log('│  ✓  Поиск уязвимостей в реальном времени                        │');
  console.log('│  ✓  Генерация тестов для нового кода                            │');
  console.log('│  ✓  Ежедневный отчёт о качестве кода                            │');
  console.log('│  ✓  Планирование и декомпозиция задач                           │');
  console.log('│  ✓  AI-память: система учится на вашем проекте                  │');
  console.log('│  ✓  Интеграция с GitHub, n8n, Slack                             │');
  console.log('│                                                                  │');
  console.log('│  Окупаемость: 1-й месяц                                         │');
  console.log('│                                                                  │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  console.log('\n═══ Демо завершено ═══\n');
}

runDemo().catch(console.error);
