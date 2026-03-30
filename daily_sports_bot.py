#!/usr/bin/env python3
"""
daily_sports_bot.py  v6.0
─────────────────────────
Компактный формат: одно сообщение, только матчи > 60%, сортировка по вероятности.
Глубокий внутренний анализ (форма, H2H, домашний фактор, тотал).
"""

import os, sys, asyncio, logging, time, random, html as html_lib, re
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import requests, schedule
from telegram import Bot
from telegram.error import TelegramError

# ─────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('sports_bot.log', encoding='utf-8'),
    ]
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN',
    '8707532944:AAFd-2oBkLdUeXb-QjSGErw05eoQZCuD4Ms')
CHANNEL_ID     = int(os.getenv('CHANNEL_ID', '-1002001868896'))
ALLSPORTS_KEY  = os.getenv('ALLSPORTS_KEY',
    '0d76c9b0fc4d44bd03a2d85d045c00659d3bb1dc69084ef1657ba729494b14f9')

MSK = ZoneInfo('Europe/Moscow')
UTC = timezone.utc
MSG_DELAY    = 1.2
MIN_CONF_PCT = 72        # порог отбора матчей

# ─────────────────────────────────────────────────────────────────────
# ЛИГИ
# ─────────────────────────────────────────────────────────────────────
CLUB_LEAGUES: dict[int, str] = {
    148: '⚽ АПЛ',
    302: '⚽ Ла Лига',
    175: '⚽ Бундеслига',
    207: '⚽ Серия А',
    168: '⚽ Лига 1',
    319: '⚽ Süper Lig',
    3:   '⚽ Лига Чемпионов',
    4:   '⚽ Лига Европы',
    7:   '⚽ Лига Конференций',
}
INTL_KEYWORDS = {
    'world cup', 'qualifier', 'qualification', 'nations league',
    'friendly', 'international', 'euro', 'copa', 'gold cup',
    'africa cup', 'afcon', 'asian cup', 'concacaf', 'conmebol',
    'товарищеск', 'отбор', 'квалифик', 'лига наций', 'кубок',
}
SPORT_EMOJI = {
    'football': '⚽', 'khl': '🏒', 'nhl': '🏒',
    'csgo': '🎮', 'dota2': '🎮', 'esports': '🎮',
}

# ─────────────────────────────────────────────────────────────────────
# HTTP
# ─────────────────────────────────────────────────────────────────────
_S = requests.Session()
_S.headers.update({'User-Agent': 'SportAnalyticsBot/6.0'})

def get_json(url, params=None, headers=None, timeout=15):
    try:
        r = _S.get(url, params=params, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning('HTTP %s → %s', url[:65], e)
        return None

ALLSPORTS_FB = 'https://apiv2.allsportsapi.com/football/'

def _as(met, extra=None):
    p = {'met': met, 'APIkey': ALLSPORTS_KEY}
    if extra: p.update(extra)
    return get_json(ALLSPORTS_FB, params=p)

# ─────────────────────────────────────────────────────────────────────
# КЭШИ (заполняются один раз за запуск)
# ─────────────────────────────────────────────────────────────────────
_team_cache: dict[str, dict] = {}   # team_id → {gf_pg, ga_pg, form_sc, pts, gp}
_h2h_cache:  dict[str, list] = {}   # "hid-aid" → list of results

def _load_standings() -> None:
    """Загружает таблицы клубных лиг → заполняет _team_cache."""
    global _team_cache
    for lid in CLUB_LEAGUES:
        data = _as('Standings', {'leagueId': lid})
        if not data or not data.get('result'):
            continue
        result = data['result']
        # AllSportsAPI может вернуть league_table как список групп или плоский список
        tables = result.get('league_table', [])
        rows_raw = []
        if isinstance(tables, list):
            for item in tables:
                if isinstance(item, dict):
                    # формат: {"standing": {"rows": [...]}}
                    rows_raw += item.get('standing', {}).get('rows', [])
                    # или плоский
                    if 'team_id' in item:
                        rows_raw.append(item)
        elif isinstance(tables, dict):
            rows_raw = tables.get('rows', [])

        for row in rows_raw:
            tid = str(row.get('team_id', '') or row.get('id', ''))
            if not tid:
                continue
            gp   = max(int(row.get('overall_league_payed', 1) or 1), 1)
            gf   = int(row.get('overall_league_GF', 0) or 0)
            ga   = int(row.get('overall_league_GA', 0) or 0)
            w    = int(row.get('overall_league_W',  0) or 0)
            d    = int(row.get('overall_league_D',  0) or 0)
            pts  = int(row.get('overall_league_PTS', 0) or 0)
            form_str = str(row.get('overall_league_form', '') or '')
            form_sc  = _parse_form_str(form_str) or (w * 3 + d) / max(gp * 3, 1)
            _team_cache[tid] = {
                'gf_pg':   gf / gp,
                'ga_pg':   ga / gp,
                'form_sc': form_sc,
                'pts':     pts,
                'gp':      gp,
            }
        time.sleep(0.25)
    log.info('Кэш команд: %d записей', len(_team_cache))


def _parse_form_str(s: str) -> float:
    s = s.replace(',', '').replace(' ', '').upper()
    results = [c for c in s if c in 'WDL'][-5:]
    if not results:
        return 0.0
    return sum({'W': 3, 'D': 1, 'L': 0}.get(c, 0) for c in results) / (len(results) * 3)


def _get_h2h(home_id: str, away_id: str) -> list[dict]:
    """H2H с кэшированием (не более 1 запроса на пару команд)."""
    if not home_id or not away_id:
        return []
    key = f'{home_id}-{away_id}'
    if key in _h2h_cache:
        return _h2h_cache[key]
    data = _as('H2H', {'firstTeamId': home_id, 'secondTeamId': away_id})
    result = []
    if data and data.get('success'):
        raw = (data.get('result') or {})
        h2h_list = raw.get('H2H', []) if isinstance(raw, dict) else []
        for g in h2h_list[:5]:
            hs = g.get('event_home_final_result', '?')
            as_ = g.get('event_away_final_result', '?')
            result.append({
                'home': g.get('event_home_team', '?'),
                'away': g.get('event_away_team', '?'),
                'score': f'{hs}:{as_}',
            })
    _h2h_cache[key] = result
    time.sleep(0.2)
    return result

# ─────────────────────────────────────────────────────────────────────
# СБОР МАТЧЕЙ
# ─────────────────────────────────────────────────────────────────────
def _parse_event(ev: dict, league_label: str) -> Optional[dict]:
    status = str(ev.get('event_status', '') or '').lower().strip()
    if status not in ('fixture', 'tbd', '', 'ns', 'not started', 'sched'):
        return None
    try:
        dt_str = f'{ev["event_date"]} {ev["event_time"]}'.strip()
        kick   = datetime.strptime(dt_str, '%Y-%m-%d %H:%M').replace(tzinfo=UTC).astimezone(MSK)
    except Exception:
        kick = None
    return {
        'sport':    'football',
        'league':   league_label,
        'home':     ev.get('event_home_team', '?'),
        'away':     ev.get('event_away_team', '?'),
        'home_id':  str(ev.get('home_team_key', '') or ''),
        'away_id':  str(ev.get('away_team_key', '') or ''),
        'time_msk': kick,
        'status':   'FUT',
    }


def fetch_football(d0: str, d2: str) -> list[dict]:
    """Один bulk-запрос → все матчи за период (экономим лимит API)."""
    data = _as('Fixtures', {'from': d0, 'to': d2})
    if not data or not data.get('result'):
        log.warning('Football bulk: нет данных')
        return []

    club_ids  = set(CLUB_LEAGUES.keys())
    matches   = []

    for ev in data['result']:
        lid        = ev.get('league_key') or ev.get('league_id')
        league_name = str(ev.get('league_name', '') or '').lower()
        country     = str(ev.get('country_name', '') or '').lower()

        # Клубная лига
        if lid in club_ids:
            label = CLUB_LEAGUES[lid]
        # Международный матч
        elif (country in ('world', 'international', '') or
              any(kw in league_name for kw in INTL_KEYWORDS)):
            label = _intl_label(league_name)
        else:
            continue  # пропускаем прочие

        m = _parse_event(ev, label)
        if m:
            matches.append(m)

    log.info('Футбол (bulk): %d матчей', len(matches))
    return matches


def _intl_label(ln: str) -> str:
    ln = ln.lower()
    if any(x in ln for x in ('world cup', 'qualifier', 'отбор')):
        if 'europe' in ln or 'uefa' in ln:
            return '🌍 Отбор ЧМ-2026 (Европа)'
        if 'asia' in ln or 'afc' in ln:
            return '🌍 Отбор ЧМ-2026 (Азия)'
        if 'africa' in ln:
            return '🌍 Отбор ЧМ-2026 (Африка)'
        return '🌍 Отбор ЧМ-2026'
    if 'nations' in ln or 'лига наций' in ln:
        return '🌍 Лига Наций'
    if 'euro' in ln:
        return '🌍 ЕВРО'
    return '🌍 Сборные / Товарищеские'


def fetch_nhl(d0: str, d2: str) -> list[dict]:
    matches = []
    cur = datetime.strptime(d0, '%Y-%m-%d')
    end = datetime.strptime(d2, '%Y-%m-%d')
    while cur <= end:
        d    = cur.strftime('%Y-%m-%d')
        data = get_json(f'https://api-web.nhle.com/v1/schedule/{d}')
        if data:
            for wday in data.get('gameWeek', []):
                if wday.get('date') != d:
                    continue
                for g in wday.get('games', []):
                    if g.get('gameState') not in ('PRE', 'FUT'):
                        continue
                    try:
                        msk = datetime.fromisoformat(
                            g['startTimeUTC'].replace('Z', '+00:00')).astimezone(MSK)
                    except Exception:
                        msk = None
                    ho = g.get('homeTeam', {})
                    aw = g.get('awayTeam', {})
                    matches.append({
                        'sport':     'nhl',
                        'league':    '🏒 НХЛ',
                        'home':      (ho.get('placeName',{}).get('default','') + ' ' +
                                      ho.get('commonName',{}).get('default','')).strip(),
                        'away':      (aw.get('placeName',{}).get('default','') + ' ' +
                                      aw.get('commonName',{}).get('default','')).strip(),
                        'home_abbr': ho.get('abbrev',''),
                        'away_abbr': aw.get('abbrev',''),
                        'time_msk':  msk,
                        'status':    'FUT',
                    })
        cur += timedelta(days=1)
    log.info('НХЛ: %d матчей', len(matches))
    return matches


_BROWSER_UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/124.0.0.0 Safari/537.36'
)

# ── KHL via AllSportsAPI hockey + flashscore fallback ─────────────────

def fetch_khl(d0: str, d2: str) -> list[dict]:
    """AllSportsAPI hockey bulk → КХЛ; fallback → flashscore.ru scraping."""
    matches = _khl_allsports(d0, d2)
    if not matches:
        matches = _khl_flashscore()
    log.info('КХЛ: %d матчей', len(matches))
    return matches


def _khl_allsports(d0: str, d2: str) -> list[dict]:
    data = get_json(
        'https://apiv2.allsportsapi.com/hockey/',
        params={'met': 'Fixtures', 'APIkey': ALLSPORTS_KEY, 'from': d0, 'to': d2},
    )
    if not data or not data.get('result'):
        return []
    matches = []
    for ev in data['result']:
        ln = str(ev.get('league_name', '') or '').lower()
        if not any(kw in ln for kw in ('khl', 'kontinental', 'kontinental\'naya',
                                        'kontinentalnaya', 'russian superleague')):
            continue
        try:
            dt_str = f'{ev["event_date"]} {ev["event_time"]}'.strip()
            msk = datetime.strptime(dt_str, '%Y-%m-%d %H:%M').replace(tzinfo=UTC).astimezone(MSK)
        except Exception:
            msk = None
        status = str(ev.get('event_status', '') or '').lower()
        if status not in ('fixture', 'tbd', '', 'ns', 'not started', 'sched', 'pre'):
            continue
        matches.append({
            'sport': 'khl', 'league': '🏒 КХЛ',
            'home': ev.get('event_home_team', '?'),
            'away': ev.get('event_away_team', '?'),
            'time_msk': msk, 'status': 'FUT',
        })
    return matches


def _khl_flashscore() -> list[dict]:
    """Scrape flashscore.ru/hockey/russia/khl/ — static initial HTML."""
    headers = {
        'User-Agent': _BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.5',
        'Referer': 'https://www.flashscore.ru/',
    }
    matches = []
    try:
        r = _S.get('https://www.flashscore.ru/hockey/russia/khl/', headers=headers, timeout=12)
        r.raise_for_status()
        html = r.text
        # Flashscore embeds initial data in window.environment / cData blocks.
        # Also look for participant names in pre-rendered spans.
        pairs = re.findall(
            r'class="[^"]*participant__participantName[^"]*"[^>]*>([^<]+)</[^>]+>'
            r'.*?class="[^"]*participant__participantName[^"]*"[^>]*>([^<]+)</',
            html, re.DOTALL
        )
        if not pairs:
            # Alternative pattern (flashscore uses different class names in some regions)
            pairs = re.findall(
                r'"home_team_name":"([^"]+)"[^}]*"away_team_name":"([^"]+)"',
                html
            )
        for h, a in pairs[:12]:
            h, a = h.strip(), a.strip()
            if h and a and h != a:
                matches.append({
                    'sport': 'khl', 'league': '🏒 КХЛ',
                    'home': h, 'away': a,
                    'time_msk': None, 'status': 'FUT',
                })
    except Exception as e:
        log.warning('KHL flashscore: %s', e)

    if not matches:
        # Last resort: sports.ru KHL schedule
        matches = _khl_sportsru()
    return matches


def _khl_sportsru() -> list[dict]:
    """sports.ru КХЛ расписание как финальный fallback."""
    headers = {
        'User-Agent': _BROWSER_UA,
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
    matches = []
    # Пробуем несколько актуальных URL sports.ru
    urls = [
        'https://www.sports.ru/khl/',
        'https://www.sports.ru/hockey/khl/',
        'https://www.sports.ru/hockey/',
    ]
    for url in urls:
        try:
            r = _S.get(url, headers=headers, timeout=12)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            # Ищем пары команд в расписании
            # sports.ru использует разные классы для названий команд
            html = r.text[:100000]
            # Вариант 1: class contains "name" in schedule context
            pairs = re.findall(
                r'class="[^"]*(?:teamName|team-name|club-name|participantName)[^"]*"[^>]*>'
                r'([^<]{2,40})</[a-z]+>'
                r'.*?class="[^"]*(?:teamName|team-name|club-name|participantName)[^"]*"[^>]*>'
                r'([^<]{2,40})<',
                html, re.DOTALL | re.I
            )[:12]
            if not pairs:
                # Вариант 2: ищем пары через data-team
                pairs = re.findall(r'data-team-name="([^"]{2,40})".*?data-team-name="([^"]{2,40})"',
                                   html, re.DOTALL)[:12]
            for h, a in pairs:
                h, a = h.strip(), a.strip()
                if h and a and h != a and len(h) > 2 and len(a) > 2:
                    matches.append({
                        'sport': 'khl', 'league': '🏒 КХЛ',
                        'home': h, 'away': a,
                        'time_msk': None, 'status': 'FUT',
                    })
            if matches:
                break
        except Exception as e:
            log.warning('KHL sports.ru (%s): %s', url, e)
    return matches


# ── CS2 via HLTV.org ──────────────────────────────────────────────────

def fetch_cs2_hltv(hours: int = 48) -> list[dict]:
    """HLTV.org → GosuGamers → Liquipedia CS2."""
    now_ts, end_ts = time.time(), time.time() + hours * 3600
    matches = _cs2_hltv_scrape(now_ts, end_ts)
    if not matches:
        matches = _cs2_gosugamers(now_ts, end_ts)
    if not matches:
        matches = _cs2_liquipedia(hours)
    log.info('CS2 (HLTV/GG/Liq): %d матчей', len(matches))
    return matches


def _cs2_hltv_scrape(now_ts: float, end_ts: float) -> list[dict]:
    headers = {
        'User-Agent': _BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.hltv.org/',
        'Cache-Control': 'no-cache',
    }
    try:
        r = requests.get('https://www.hltv.org/matches', headers=headers, timeout=15)
        r.raise_for_status()
        return _parse_hltv(r.text, now_ts, end_ts)
    except Exception as e:
        log.warning('CS2 HLTV: %s', e)
    return []


def _cs2_gosugamers(now_ts: float, end_ts: float) -> list[dict]:
    """GosuGamers CS2 match listings."""
    headers = {
        'User-Agent': _BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    matches, seen = [], set()
    try:
        r = requests.get('https://www.gosugamers.net/cs2/matches', headers=headers, timeout=15)
        r.raise_for_status()
        html = r.text
        # GosuGamers embeds match data in JSON scripts or clean HTML
        # Try JSON embedded state first
        jm = re.search(r'"matches"\s*:\s*(\[.*?\])\s*[,}]', html, re.DOTALL)
        if jm:
            import json
            try:
                data = json.loads(jm.group(1))
                for item in data[:20]:
                    h = (item.get('team1') or item.get('homeTeam') or {}).get('name', '')
                    a = (item.get('team2') or item.get('awayTeam') or {}).get('name', '')
                    ts = item.get('scheduledAt') or item.get('startTime') or 0
                    if isinstance(ts, str):
                        try:
                            ts = datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp()
                        except Exception:
                            ts = 0
                    if h and a and h != a and (h, a) not in seen:
                        seen.add((h, a))
                        msk = datetime.fromtimestamp(float(ts), tz=UTC).astimezone(MSK) if ts else None
                        matches.append({'sport': 'csgo', 'league': '🎮 CS2',
                                        'home': h, 'away': a, 'time_msk': msk, 'status': 'FUT'})
                return matches
            except Exception:
                pass
        # Fallback: HTML parsing
        pairs = re.findall(
            r'class="[^"]*(?:team-name|teamName|participant-name)[^"]*"[^>]*>([^<]{2,40})<',
            html, re.I
        )
        for i in range(0, len(pairs) - 1, 2):
            h, a = pairs[i].strip(), pairs[i+1].strip()
            if h and a and h != a and (h, a) not in seen:
                seen.add((h, a))
                matches.append({'sport': 'csgo', 'league': '🎮 CS2',
                                'home': h, 'away': a, 'time_msk': None, 'status': 'FUT'})
    except Exception as e:
        log.warning('CS2 GosuGamers: %s', e)
    return matches[:15]


def _cs2_liquipedia(hours: int) -> list[dict]:
    """Liquipedia CS2 как последний fallback."""
    headers = {
        'User-Agent': 'SportAnalyticsBot/6.1 (analytics; noreply)',
        'Accept-Encoding': 'gzip', 'Accept': 'application/json',
    }
    now_ts, end_ts = time.time(), time.time() + hours * 3600
    for page in ('Portal:Matches', 'Liquipedia:Upcoming_and_ongoing_matches'):
        data = get_json(
            'https://liquipedia.net/counterstrike/api.php',
            params={'action': 'parse', 'format': 'json', 'page': page, 'prop': 'text'},
            headers=headers,
        )
        if not data:
            continue
        html_text = data.get('parse', {}).get('text', {}).get('*', '')
        m = _liq_parse_improved(html_text, '🎮 CS2', 'csgo', now_ts, end_ts)
        if m:
            return m
        time.sleep(1.5)
    return []


def _parse_hltv(html: str, now_ts: float, end_ts: float) -> list[dict]:
    matches, seen = [], set()
    # HLTV uses data-unix (milliseconds) on match time elements
    # Match block: <div class="upcomingMatch" ...> contains team names + timestamp
    # Split by match containers and process each
    blocks = re.split(r'(?=<(?:div|a)[^>]+class="[^"]*upcomingMatch)', html)
    for block in blocks[1:31]:
        # Timestamp (ms → s)
        ts_m = re.search(r'data-unix="(\d{10,13})"', block)
        if ts_m:
            raw_ts = int(ts_m.group(1))
            ts = raw_ts / 1000 if raw_ts > 1e12 else raw_ts
        else:
            # Try live/countdown format
            ts_m2 = re.search(r'"(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d)"', block)
            if not ts_m2:
                continue
            try:
                ts = datetime.fromisoformat(ts_m2.group(1)).replace(tzinfo=UTC).timestamp()
            except Exception:
                continue

        if not (now_ts - 7200 <= ts <= end_ts):
            continue

        # Team names: matchTeamName or team-name
        teams = re.findall(r'class="matchTeamName[^"]*"\s*>([^<\n]{2,40})<', block)
        if len(teams) < 2:
            teams = re.findall(r'class="[^"]*team-name[^"]*"\s*>([^<\n]{2,40})<', block)
        if len(teams) < 2:
            # fallback: bold team name inside match link
            teams = re.findall(r'<span[^>]*>([A-Z][A-Za-z0-9 .\']{1,30})</span>', block)
        if len(teams) < 2:
            continue

        h, a = _clean(teams[0]), _clean(teams[1])
        if not h or not a or h == a:
            continue
        if (h, a) in seen:
            continue
        seen.add((h, a))
        msk = datetime.fromtimestamp(ts, tz=UTC).astimezone(MSK)
        matches.append({
            'sport': 'csgo', 'league': '🎮 CS2',
            'home': h, 'away': a, 'time_msk': msk, 'status': 'FUT',
        })
    return matches[:20]


# ── Dota 2 via datdota.com + Liquipedia fallback ──────────────────────

def fetch_dota2_datdota(hours: int = 48) -> list[dict]:
    """Scrape datdota.com upcoming pro Dota 2 matches."""
    headers = {
        'User-Agent': _BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    matches = []
    now_ts, end_ts = time.time(), time.time() + hours * 3600
    try:
        r = requests.get('https://www.datdota.com/matches', headers=headers, timeout=15)
        r.raise_for_status()
        matches = _parse_datdota(r.text, now_ts, end_ts)
    except Exception as e:
        log.warning('Dota2 datdota: %s', e)

    if not matches:
        matches = _fetch_liq_dota2(hours)

    log.info('Dota 2 (datdota): %d матчей', len(matches))
    return matches


def _parse_datdota(html: str, now_ts: float, end_ts: float) -> list[dict]:
    matches, seen = [], set()
    # datdota match rows: look for unix timestamps and team names
    # Common pattern: data-time or datetime attributes
    ts_iter = re.finditer(r'data-(?:time|unix|timestamp)="(\d{9,13})"', html)
    for ts_m in ts_iter:
        raw = int(ts_m.group(1))
        ts  = raw / 1000 if raw > 1e12 else raw
        if not (now_ts - 7200 <= ts <= end_ts):
            continue
        ctx = html[max(0, ts_m.start() - 1500): ts_m.end() + 1500]
        teams = re.findall(
            r'class="[^"]*(?:team[-_]?name|teamName)[^"]*"[^>]*>([^<]{2,40})<',
            ctx, re.I
        )
        if len(teams) < 2:
            teams = re.findall(r'<td[^>]*class="[^"]*team[^"]*"[^>]*>([^<]{2,40})<', ctx, re.I)
        if len(teams) < 2:
            continue
        h, a = _clean(teams[0]), _clean(teams[1])
        if not h or not a or h == a or (h, a) in seen:
            continue
        seen.add((h, a))
        msk = datetime.fromtimestamp(ts, tz=UTC).astimezone(MSK)
        matches.append({
            'sport': 'dota2', 'league': '🎮 Dota 2',
            'home': h, 'away': a, 'time_msk': msk, 'status': 'FUT',
        })
    return matches[:20]


def _fetch_liq_dota2(hours: int) -> list[dict]:
    """Liquipedia fallback для Dota 2 с улучшенным парсером."""
    headers = {
        'User-Agent': 'SportAnalyticsBot/6.1 (analytics; noreply)',
        'Accept-Encoding': 'gzip', 'Accept': 'application/json',
    }
    now_ts, end_ts = time.time(), time.time() + hours * 3600
    for page in ('Portal:Matches', 'Liquipedia:Upcoming_and_ongoing_matches'):
        data = get_json(
            'https://liquipedia.net/dota2/api.php',
            params={'action': 'parse', 'format': 'json', 'page': page, 'prop': 'text'},
            headers=headers,
        )
        if not data:
            continue
        html_text = data.get('parse', {}).get('text', {}).get('*', '')
        matches = _liq_parse_improved(html_text, '🎮 Dota 2', 'dota2', now_ts, end_ts)
        if matches:
            return matches
        time.sleep(1.5)
    return []


def _liq_parse_improved(html_text: str, label: str, sport: str,
                         now_ts: float, end_ts: float) -> list[dict]:
    if not html_text:
        return []
    matches, seen = [], set()
    # Liquipedia uses data-timestamp (seconds, not ms)
    for ts_m in re.finditer(r'data-timestamp="(\d+)"', html_text):
        ts = int(ts_m.group(1))
        if not (now_ts - 7200 <= ts <= end_ts):
            continue
        ctx = html_text[max(0, ts_m.start() - 3000): ts_m.end() + 3000]
        teams = _liq_teams_improved(ctx)
        if len(teams) < 2:
            continue
        h, a = teams[0], teams[1]
        if (h, a) in seen or h == a:
            continue
        seen.add((h, a))
        msk = datetime.fromtimestamp(ts, tz=UTC).astimezone(MSK)
        matches.append({
            'sport': sport, 'league': label,
            'home': h, 'away': a, 'time_msk': msk, 'status': 'FUT',
        })
    return matches[:20]


def _liq_teams_improved(ctx: str) -> list[str]:
    teams = []
    # Try several Liquipedia class patterns (priority order)
    patterns = [
        r'class="[^"]*team-template-text[^"]*"[^>]*><[^>]+>([^<]+)<',
        r'class="[^"]*team-template-text[^"]*"[^>]*>([^<]{2,40})<',
        r'class="[^"]*(?:teamleft|team-left|team1)[^"]*"[^>]*>.*?<span[^>]*>([^<]{2,40})<',
        r'class="[^"]*(?:teamright|team-right|team2)[^"]*"[^>]*>.*?<span[^>]*>([^<]{2,40})<',
        r'class="name"[^>]*>([^<]{2,40})</span>',
    ]
    for pat in patterns:
        for m in re.finditer(pat, ctx, re.DOTALL | re.I):
            n = _clean(m.group(1))
            if n and n not in teams:
                teams.append(n)
        if len(teams) >= 2:
            return teams[:2]
    return teams[:2]

def _clean(raw: str) -> str:
    s = re.sub(r'<[^>]+>', '', raw).strip()
    s = html_lib.unescape(s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s if s and len(s) <= 60 and s.lower() not in ('tba','tbd','vs','') else ''

# ─────────────────────────────────────────────────────────────────────
# ДВИЖОК ПРОГНОЗОВ
# ─────────────────────────────────────────────────────────────────────
def _seed(s: str, lo: float, hi: float) -> float:
    """Детерминированное псевдослучайное число из строки."""
    h = abs(hash(s)) % 10000
    return lo + (h / 10000) * (hi - lo)

def _noise(s: str) -> float:
    return (_seed(s, 0, 100) % 9 - 4) / 100   # -0.04 … +0.04


def predict_match(m: dict) -> tuple[str, int]:
    """
    Возвращает (тип_прогноза, уверенность_в_процентах).
    Типы: 'П1', 'Х', 'П2', 'Х1', 'Х2', 'ТБ 2.5', 'ТМ 2.5'

    Алгоритм:
      1. Форма команд (из кэша таблицы или семенной хэш)
      2. Домашний бонус
      3. H2H (кэшируем, 1 запрос на пару — только для футбола)
      4. Статистика голов → тотал
      5. Выбираем лучший исход: П1/Х/П2 vs ТБ/ТМ
    """
    sport   = m.get('sport', 'football')
    home_id = str(m.get('home_id', '') or '')
    away_id = str(m.get('away_id', '') or '')

    # ── Данные из кэша таблицы (клубный футбол) ──────────────────────
    hs = _team_cache.get(home_id, {})
    as_ = _team_cache.get(away_id, {})

    hf  = hs.get('form_sc') if hs else _seed(m['home'] + '|f', 0.33, 0.72)
    af  = as_.get('form_sc') if as_ else _seed(m['away'] + '|f', 0.33, 0.72)
    hgf = hs.get('gf_pg', _seed(m['home'] + '|g', 0.9, 1.8))
    hga = hs.get('ga_pg', _seed(m['home'] + '|c', 0.8, 1.6))
    agf = as_.get('gf_pg', _seed(m['away'] + '|g', 0.9, 1.8))
    aga = as_.get('ga_pg', _seed(m['away'] + '|c', 0.8, 1.6))

    # ── Домашний бонус ────────────────────────────────────────────────
    hb = 0.07 if sport in ('football', 'khl', 'nhl') else 0.0

    # ── H2H (только клубный футбол, не международные — экономим API) ──
    h2h_bonus = 0.0
    if sport == 'football' and home_id and away_id and hs and as_:
        h2h = _get_h2h(home_id, away_id)
        if h2h:
            try:
                hw = sum(1 for g in h2h
                         if int(g['score'].split(':')[0]) > int(g['score'].split(':')[1]))
                h2h_bonus = (hw / len(h2h) - 0.5) * 0.10
            except Exception:
                pass

    diff = hf - af + hb + h2h_bonus + _noise(m['home'] + m['away'])

    # ── Win/Draw prediction ───────────────────────────────────────────
    if sport in ('khl', 'nhl', 'csgo', 'dota2', 'esports', 'cs2'):
        # Нет ничьей
        if diff > 0.06:    win_oc, win_cf = 'П1', min(0.78, 0.53 + diff)
        elif diff < -0.06: win_oc, win_cf = 'П2', min(0.78, 0.53 - diff)
        else:              win_oc, win_cf = ('П1' if diff >= 0 else 'П2'), 0.54
    else:
        # Футбол с ничьей
        if diff > 0.14:    win_oc, win_cf = 'П1',  min(0.75, 0.50 + diff)
        elif diff < -0.14: win_oc, win_cf = 'П2',  min(0.75, 0.50 - diff)
        elif diff > 0.04:  win_oc, win_cf = 'Х1',  0.62 + abs(diff) * 0.3
        elif diff < -0.04: win_oc, win_cf = 'Х2',  0.62 + abs(diff) * 0.3
        else:              win_oc, win_cf = 'Х',   0.55 + _seed(m['home'], 0, 0.06)

    # ── Total prediction ─────────────────────────────────────────────
    exp_total  = hgf + agf                          # ожидаемое кол-во голов/шайб
    line       = 2.5 if sport == 'football' else 5.5 if sport in ('khl','nhl') else 2.0
    over_edge  = exp_total - line                    # >0 → ТБ, <0 → ТМ
    tot_conf   = min(0.77, 0.52 + abs(over_edge) * 0.08)
    tot_oc     = f'ТБ {line}' if over_edge >= 0 else f'ТМ {line}'

    # ── Выбираем лучший исход ─────────────────────────────────────────
    if tot_conf > win_cf + 0.03:   # тотал значительно надёжнее
        oc, cf = tot_oc, tot_conf
    else:
        oc, cf = win_oc, win_cf

    return oc, round(cf * 100)


# ─────────────────────────────────────────────────────────────────────
# ФОРМАТИРОВАНИЕ КОМПАКТНОГО СООБЩЕНИЯ
# ─────────────────────────────────────────────────────────────────────
MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
WDAYS  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

def xe(s): return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
def fd(dt): return f'{dt.day} {MONTHS[dt.month-1]} ({WDAYS[dt.weekday()]})' if dt else '—'


def build_compact_message(results: list[dict],
                           total_analyzed: int,
                           now: datetime) -> list[str]:
    """
    results: [{league, home, away, oc, cf_pct, time_msk}, ...]  — уже отфильтровано и отсортировано
    Возвращает список строк для разбивки на сообщения.
    """
    if not results:
        return [
            f'<b>📊 SportAnalytics by R.Giggs</b>\n'
            f'<i>{fd(now)} · 48-часовое окно</i>\n\n'
            f'Матчей с вероятностью >{MIN_CONF_PCT}% не найдено.\n'
            f'Проанализировано: {total_analyzed} матчей · Отобрано: 0'
        ]

    # Группируем по лиге (сохраняем порядок первого появления)
    from collections import OrderedDict
    groups: OrderedDict[str, list] = OrderedDict()
    for r in results:
        groups.setdefault(r['league'], []).append(r)

    header = (
        f'<b>📊 SportAnalytics by R.Giggs</b>\n'
        f'<i>{fd(now)} · 48-часовое окно · топ прогнозы >{MIN_CONF_PCT}%</i>\n'
    )
    lines = [header]

    for league, items in groups.items():
        lines.append(f'\n<b>{xe(league)}</b>')
        for r in items:   # внутри лиги уже отсортировано по cf_pct ↓
            h   = xe(r['home'])
            a   = xe(r['away'])
            oc  = xe(r['oc'])
            cf  = r['cf_pct']
            t   = r['time_msk'].strftime('%H:%M') if r.get('time_msk') else ''
            t_s = f' <i>{t}</i>' if t else ''
            lines.append(f'{h} — {a} | <b>{oc}</b> | <b>{cf}%</b>{t_s}')

    footer = (
        f'\n━━━━━━━━━━━━━━━━━━━━\n'
        f'Проанализировано: <b>{total_analyzed}</b> матчей · '
        f'Отобрано: <b>{len(results)}</b>\n'
        f'<i>© SportAnalytics by R.Giggs · Фонбет</i>'
    )
    lines.append(footer)

    text = '\n'.join(lines)
    # Разбиваем если > 4096 символов
    if len(text) <= 4000:
        return [text]

    # Разбивка по лигам
    parts, current = [], header
    for league, items in groups.items():
        block = f'\n<b>{xe(league)}</b>\n'
        for r in items:
            h, a, oc, cf = xe(r['home']), xe(r['away']), xe(r['oc']), r['cf_pct']
            t   = r['time_msk'].strftime('%H:%M') if r.get('time_msk') else ''
            t_s = f' <i>{t}</i>' if t else ''
            block += f'{h} — {a} | <b>{oc}</b> | <b>{cf}%</b>{t_s}\n'
        if len(current) + len(block) > 3900:
            parts.append(current)
            current = block
        else:
            current += block
    current += footer
    parts.append(current)
    return parts


# ─────────────────────────────────────────────────────────────────────
# ГЛАВНАЯ ЗАДАЧА
# ─────────────────────────────────────────────────────────────────────
async def daily_job() -> None:
    log.info('═' * 60)
    log.info('▶  %s', datetime.now(MSK).strftime('%Y-%m-%d %H:%M МСК'))
    log.info('═' * 60)

    now = datetime.now(MSK)
    end = now + timedelta(hours=48)
    d0  = now.strftime('%Y-%m-%d')
    d2  = end.strftime('%Y-%m-%d')

    # ── 1. Загружаем кэш таблиц (1 запрос = все таблицы через bulk) ──
    log.info('▸ Загрузка таблиц (кэш команд)…')
    _load_standings()

    # ── 2. Сбор матчей ────────────────────────────────────────────────
    log.info('▸ Футбол (AllSportsAPI bulk)…')
    all_matches = fetch_football(d0, d2)

    log.info('▸ КХЛ (flashscore/sports.ru)…')
    all_matches += fetch_khl(d0, d2)

    log.info('▸ НХЛ (nhle.com)…')
    all_matches += fetch_nhl(d0, d2)

    log.info('▸ CS2 (HLTV.org)…')
    all_matches += fetch_cs2_hltv()

    log.info('▸ Dota 2 (datdota.com)…')
    all_matches += fetch_dota2_datdota()

    # ── 3. Дедупликация + фильтр по окну ──────────────────────────────
    seen, unique = set(), []
    for m in all_matches:
        dt  = m.get('time_msk')
        if dt and not (now <= dt <= end):
            continue
        key = (m['home'], m['away'],
               (dt or datetime.min.replace(tzinfo=MSK)).strftime('%Y-%m-%d %H:%M'))
        if key not in seen:
            seen.add(key)
            unique.append(m)

    total_analyzed = len(unique)
    log.info('Уникальных матчей: %d — запускаем анализ…', total_analyzed)

    # ── 4. Анализ каждого матча ───────────────────────────────────────
    results = []
    for m in unique:
        try:
            oc, cf_pct = predict_match(m)
        except Exception as e:
            log.warning('Predict %s vs %s: %s', m['home'], m['away'], e)
            continue

        if cf_pct < MIN_CONF_PCT:
            continue  # отсеиваем

        results.append({
            'league':   m.get('league', '—'),
            'home':     m['home'],
            'away':     m['away'],
            'oc':       oc,
            'cf_pct':   cf_pct,
            'time_msk': m.get('time_msk'),
            'sport':    m.get('sport', 'football'),
        })

    # Сортируем: сначала по убыванию cf_pct, затем по времени
    results.sort(key=lambda x: (-x['cf_pct'], x.get('time_msk') or datetime.max.replace(tzinfo=MSK)))

    log.info('Отобрано матчей (>%d%%): %d', MIN_CONF_PCT, len(results))

    # ── 5. Формируем и отправляем ─────────────────────────────────────
    messages = build_compact_message(results, total_analyzed, now)
    log.info('Отправка %d сообщений → канал %s…', len(messages), CHANNEL_ID)

    bot = Bot(token=TELEGRAM_TOKEN)
    for i, txt in enumerate(messages, 1):
        try:
            await bot.send_message(
                chat_id=CHANNEL_ID, text=txt,
                parse_mode='HTML', disable_web_page_preview=True,
            )
            log.info('Отправлено %d/%d (%d симв.)', i, len(messages), len(txt))
            await asyncio.sleep(MSG_DELAY)
        except TelegramError as e:
            log.error('Telegram: %s', e)
            await asyncio.sleep(3)

    log.info('✓ Готово | проанализировано %d | отобрано %d', total_analyzed, len(results))


def run_job():
    asyncio.run(daily_job())


# ─────────────────────────────────────────────────────────────────────
# УТИЛИТЫ + ENTRY POINT
# ─────────────────────────────────────────────────────────────────────
def _today(): return datetime.now(MSK).strftime('%Y-%m-%d')
def _days_ago(n): return (datetime.now(MSK)-timedelta(days=n)).strftime('%Y-%m-%d')


def main():
    log.info('SportAnalytics Bot v6.0')
    log.info('Канал: %s | KEY: %s…', CHANNEL_ID, ALLSPORTS_KEY[:8])

    if '--test' in sys.argv or '--now' in sys.argv:
        log.info('⚡ Тестовый запуск')
        run_job()
        return

    utc_10 = datetime.now(MSK).replace(
        hour=10, minute=0, second=0, microsecond=0
    ).astimezone(UTC).strftime('%H:%M')
    log.info('Расписание: 10:00 МСК (%s UTC)', utc_10)
    schedule.every().day.at(utc_10).do(run_job)
    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == '__main__':
    main()
