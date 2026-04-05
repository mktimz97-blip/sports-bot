# TZAI Company Group — Завтра финализация

## Что сделано сегодня
- RuFlo V3.5 работает локально
- VPS Frankfurt: 134.122.87.138 (DigitalOcean $12/mo, Ubuntu 24.04)
- SSH ключ: ~/.ssh/tzai_key
- n8n на VPS: http://134.122.87.138:5678 (admin / tTzai2026flowX)
- Qdrant на VPS: http://134.122.87.138:6333
- 20 workflows импортированы на VPS
- Telegram бот: tzai_notify_bot, token: 8632160004:AAFg1HiS0RqjIoMr27FhdMSiAVFhbp2sFHM
- Chat ID: 120786192
- 8 писем отправлено лидам (SMTP: tzai.flow@mail.ru)
- Docker: /opt/tzai/docker-compose.yml на VPS

## Что надо завтра
1. Импортировать Hunter workflow (поиск email по домену) из integrations/zie619-workflows/Hunter/
2. Импортировать Emailreadimap (чтение входящих + Telegram уведомление)
3. Настроить scheduler — агенты ищут лидов каждый день автоматически
4. Связать: LeadFinder → Hunter → EmailComposer → отправка → Telegram отчёт
5. Проверить что все 8 писем дошли (проверить tzai.flow@mail.ru)

## Как подключиться к VPS
ssh -i ~/.ssh/tzai_key root@134.122.87.138

## Проект
C:/projects/myproject/
Письма: docs/leadgen-emails-30.md
Скрипт отправки: scripts/send-leads.js
Workflows библиотека: integrations/zie619-workflows/ (2077+ workflows)
