#!/usr/bin/env python3
"""
daily_sports_bot.py  v7.0
─────────────────────────
Глубокий анализ: форма, H2H, голы, угловые, карточки.
Только топ-лиги + FIFA top-50 сборные.
Умный выбор ставки + экспресс дня.
"""

import os, sys, asyncio, logging, time, html as html_lib, re, json
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo
from collections import OrderedDict

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
MIN_CONF_PCT = 72
EXPRESS_MIN  = 74

# ─────────────────────────────────────────────────────────────────────
# ЛИГИ (только топ)
# ─────────────────────────────────────────────────────────────────────
CLUB_LEAGUES: dict[int, str] = {
    148: '⚽ АПЛ',
    302: '⚽ Ла Лига',
    175: '⚽ Бундеслига',
    207: '⚽ Серия А',
    168: '⚽ Лига 1',
    3:   '⚽ Лига Чемпионов',
    4:   '⚽ Лига Европы',
}

# Молодёжные / мусорные — фильтруем (в названии лиги или команды)
SKIP_LEAGUE_KEYWORDS = {
    'u17', 'u19', 'u21', 'u20', 'u18', 'u16', 'u23',
    'youth', 'junior', 'reserve', 'women', 'amateur',
    'молодёж', 'молодеж', 'юноши', 'юниор', 'резерв',
    'club friendly',
}
# Молодёжные суффиксы в названии команды
SKIP_TEAM_SUFFIXES = {'u17', 'u18', 'u19', 'u20', 'u21', 'u23'}

# FIFA top-100 сборные (для фильтра международных матчей)
FIFA_TOP100 = {
    # Top 1-50
    'argentina', 'france', 'spain', 'england', 'brazil', 'belgium',
    'netherlands', 'portugal', 'germany', 'italy', 'croatia', 'colombia',
    'mexico', 'uruguay', 'usa', 'united states', 'switzerland', 'japan',
    'morocco', 'senegal', 'iran', 'denmark', 'austria', 'australia',
    'south korea', 'korea republic', 'ukraine', 'turkey', 'poland',
    'sweden', 'hungary', 'serbia', 'czech republic', 'peru', 'norway',
    'scotland', 'nigeria', 'cameroon', 'ecuador', 'wales', 'algeria',
    'tunisia', 'costa rica', 'egypt', 'canada', 'paraguay', 'ivory coast',
    'chile', 'panama', 'mali',
    # Top 51-100
    'greece', 'republic of ireland', 'ireland', 'romania', 'slovakia',
    'finland', 'venezuela', 'bosnia and herzegovina', 'bosnia', 'iceland',
    'northern ireland', 'slovenia', 'albania', 'montenegro', 'russia',
    'jamaica', 'north macedonia', 'georgia', 'israel', 'burkina faso',
    'guinea', 'congo dr', 'dr congo', 'gabon', 'iraq', 'saudi arabia',
    'south africa', 'el salvador', 'uzbekistan', 'syria', 'honduras',
    'cape verde', 'curacao', 'qatar', 'china', 'china pr', 'bahrain',
    'oman', 'congo', 'uganda', 'jordan', 'zambia', 'benin',
    'haiti', 'kenya', 'new zealand', 'ghana', 'thailand',
    'kyrgyz republic', 'kyrgyzstan', 'bolivia',
    # Русские названия
    'аргентина', 'франция', 'испания', 'англия', 'бразилия', 'бельгия',
    'нидерланды', 'голландия', 'португалия', 'германия', 'италия',
    'хорватия', 'колумбия', 'мексика', 'уругвай', 'сша', 'швейцария',
    'япония', 'марокко', 'сенегал', 'иран', 'дания', 'австрия',
    'австралия', 'южная корея', 'корея', 'украина', 'турция', 'польша',
    'швеция', 'венгрия', 'сербия', 'чехия', 'перу', 'норвегия',
    'шотландия', 'нигерия', 'камерун', 'эквадор', 'уэльс', 'алжир',
    'тунис', 'коста-рика', 'египет', 'канада', 'парагвай',
    'кот-д\'ивуар', 'чили', 'панама', 'мали',
    'греция', 'ирландия', 'румыния', 'словакия', 'финляндия',
    'венесуэла', 'босния', 'исландия', 'словения', 'албания',
    'черногория', 'россия', 'ямайка', 'северная македония', 'грузия',
    'израиль', 'буркина-фасо', 'гвинея', 'конго', 'габон', 'ирак',
    'саудовская аравия', 'юар', 'южная африка', 'сальвадор',
    'узбекистан', 'сирия', 'гондурас', 'катар', 'китай',
    'оман', 'уганда', 'замбия', 'бенин', 'гаити', 'кения',
    'новая зеландия', 'гана', 'таиланд', 'боливия', 'иордания',
}

# ─────────────────────────────────────────────────────────────────────
# HTTP
# ─────────────────────────────────────────────────────────────────────
_S = requests.Session()
_S.headers.update({'User-Agent': 'SportAnalyticsBot/7.0'})

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
    if extra:
        p.update(extra)
    return get_json(ALLSPORTS_FB, params=p)

# ─────────────────────────────────────────────────────────────────────
# КЭШИ
# ─────────────────────────────────────────────────────────────────────
_team_cache: dict[str, dict] = {}
_h2h_cache:  dict[str, list] = {}
_team_last5: dict[str, list] = {}

def _load_standings() -> None:
    """Загружает таблицы клубных лиг → заполняет _team_cache."""
    for lid in CLUB_LEAGUES:
        data = _as('Standings', {'leagueId': lid})
        if not data or not data.get('result'):
            continue
        result = data['result']
        tables = result.get('league_table', [])
        rows_raw = []
        if isinstance(tables, list):
            for item in tables:
                if isinstance(item, dict):
                    rows_raw += item.get('standing', {}).get('rows', [])
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

            # Домашняя статистика
            hw = int(row.get('home_league_W', 0) or 0)
            hd = int(row.get('home_league_D', 0) or 0)
            hp = max(int(row.get('home_league_payed', 1) or 1), 1)
            hgf = int(row.get('home_league_GF', 0) or 0)
            hga = int(row.get('home_league_GA', 0) or 0)

            # Гостевая статистика
            aw = int(row.get('away_league_W', 0) or 0)
            ad = int(row.get('away_league_D', 0) or 0)
            ap = max(int(row.get('away_league_payed', 1) or 1), 1)
            agf = int(row.get('away_league_GF', 0) or 0)
            aga = int(row.get('away_league_GA', 0) or 0)

            form_str = str(row.get('overall_league_form', '') or '')
            form_sc  = _parse_form_str(form_str) or (w * 3 + d) / max(gp * 3, 1)

            _team_cache[tid] = {
                'gf_pg': gf / gp, 'ga_pg': ga / gp,
                'form_sc': form_sc, 'pts': pts, 'gp': gp,
                'home_gf_pg': hgf / hp, 'home_ga_pg': hga / hp,
                'home_win_rate': (hw * 3 + hd) / max(hp * 3, 1),
                'away_gf_pg': agf / ap, 'away_ga_pg': aga / ap,
                'away_win_rate': (aw * 3 + ad) / max(ap * 3, 1),
            }
        time.sleep(0.3)
    log.info('Кэш команд: %d записей', len(_team_cache))


def _parse_form_str(s: str) -> float:
    s = s.replace(',', '').replace(' ', '').upper()
    results = [c for c in s if c in 'WDL'][-5:]
    if not results:
        return 0.0
    return sum({'W': 3, 'D': 1, 'L': 0}.get(c, 0) for c in results) / (len(results) * 3)


def _parse_score(ev: dict) -> tuple[int, int]:
    """Парсит счёт из event_final_result формата '1 - 1' или event_ft_result."""
    for field in ('event_final_result', 'event_ft_result'):
        raw = str(ev.get(field, '') or '').strip()
        m = re.match(r'(\d+)\s*-\s*(\d+)', raw)
        if m:
            return int(m.group(1)), int(m.group(2))
    return -1, -1


def _get_h2h(home_id: str, away_id: str) -> list[dict]:
    """H2H последние 5 встреч."""
    if not home_id or not away_id:
        return []
    key = f'{home_id}-{away_id}'
    if key in _h2h_cache:
        return _h2h_cache[key]
    data = _as('H2H', {'firstTeamId': home_id, 'secondTeamId': away_id})
    result = []
    if data and data.get('success'):
        raw = data.get('result') or {}
        h2h_list = raw.get('H2H', []) if isinstance(raw, dict) else []
        for g in h2h_list[:5]:
            hs, as_ = _parse_score(g)
            if hs < 0:
                continue
            result.append({
                'home': g.get('event_home_team', '?'),
                'away': g.get('event_away_team', '?'),
                'home_goals': hs,
                'away_goals': as_,
                'total_goals': hs + as_,
            })
    _h2h_cache[key] = result
    time.sleep(0.2)
    return result


def _load_team_last5(team_id: str) -> dict:
    """Загружает последние 5 сыгранных матчей команды — реальные данные."""
    if team_id in _team_last5:
        return _team_last5[team_id]

    stats = {'goals': [], 'results': [], 'count': 0}

    data = _as('Fixtures', {
        'teamId': team_id,
        'from': (datetime.now(UTC) - timedelta(days=180)).strftime('%Y-%m-%d'),
        'to': datetime.now(UTC).strftime('%Y-%m-%d'),
    })
    if data and data.get('result'):
        played = [
            ev for ev in data['result']
            if str(ev.get('event_status', '') or '').strip().lower()
            in ('finished', 'ft', 'after pens', 'aet', 'after pen.')
        ]
        played.sort(key=lambda e: e.get('event_date', ''), reverse=True)

        for ev in played[:5]:
            hs, as_ = _parse_score(ev)
            if hs < 0:
                continue

            is_home = str(ev.get('home_team_key', '')) == team_id
            team_goals = hs if is_home else as_
            opp_goals = as_ if is_home else hs

            stats['goals'].append(hs + as_)

            if team_goals > opp_goals:
                stats['results'].append('W')
            elif team_goals < opp_goals:
                stats['results'].append('L')
            else:
                stats['results'].append('D')

        stats['count'] = len(stats['results'])

    _team_last5[team_id] = stats
    time.sleep(0.15)
    return stats


# ─────────────────────────────────────────────────────────────────────
# ФИЛЬТР МАТЧЕЙ
# ─────────────────────────────────────────────────────────────────────
def _is_youth_or_junk(ev: dict) -> bool:
    """Отсеивает молодёжные, клубные товарищеские, неизвестные лиги."""
    ln = str(ev.get('league_name', '') or '').lower()
    home = str(ev.get('event_home_team', '') or '').lower()
    away = str(ev.get('event_away_team', '') or '').lower()

    # Проверяем лигу на мусорные ключевые слова
    if any(kw in ln for kw in SKIP_LEAGUE_KEYWORDS):
        return True

    # Молодёжные суффиксы в названии команды (England U21, France U19)
    for team in (home, away):
        parts = team.strip().split()
        if parts and parts[-1].lower() in SKIP_TEAM_SUFFIXES:
            return True

    return False


def _is_top_international(ev: dict) -> bool:
    """Пропускает международный матч если обе сборные FIFA top-100."""
    home = str(ev.get('event_home_team', '') or '').lower().strip()
    away = str(ev.get('event_away_team', '') or '').lower().strip()

    # Обе команды должны быть в top-100
    home_ok = any(t in home for t in FIFA_TOP100)
    away_ok = any(t in away for t in FIFA_TOP100)
    return home_ok and away_ok


# ─────────────────────────────────────────────────────────────────────
# СБОР МАТЧЕЙ
# ─────────────────────────────────────────────────────────────────────
def _parse_event(ev: dict, league_label: str) -> Optional[dict]:
    status = str(ev.get('event_status', '') or '').lower().strip()
    if status not in ('fixture', 'tbd', '', 'ns', 'not started', 'sched'):
        return None
    try:
        dt_str = f'{ev["event_date"]} {ev["event_time"]}'.strip()
        kick = datetime.strptime(dt_str, '%Y-%m-%d %H:%M').replace(tzinfo=UTC).astimezone(MSK)
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
    """Один bulk-запрос → все матчи за период, фильтр топ-лиг."""
    data = _as('Fixtures', {'from': d0, 'to': d2})
    if not data or not data.get('result'):
        log.warning('Football bulk: нет данных')
        return []

    club_ids = set(CLUB_LEAGUES.keys())
    matches  = []

    for ev in data['result']:
        # Пропуск молодёжных / товарищеских
        if _is_youth_or_junk(ev):
            continue

        lid = ev.get('league_key') or ev.get('league_id')
        country = str(ev.get('country_name', '') or '').lower()

        if lid in club_ids:
            label = CLUB_LEAGUES[lid]
        elif country in ('world', 'international', 'intl', 'eurocups', ''):
            if _is_top_international(ev):
                label = _intl_label(str(ev.get('league_name', '')))
            else:
                continue
        else:
            continue

        m = _parse_event(ev, label)
        if m:
            matches.append(m)

    log.info('Футбол: %d матчей (только топ-лиги)', len(matches))
    return matches


def _intl_label(ln: str) -> str:
    ln = ln.lower()
    if any(x in ln for x in ('world cup', 'qualifier', 'отбор')):
        return '🌍 Отбор ЧМ'
    if 'nations league' in ln or 'лига наций' in ln:
        return '🌍 Лига Наций'
    if 'euro' in ln and 'qualifier' not in ln:
        return '🌍 ЕВРО'
    if 'friendl' in ln or 'товарищ' in ln:
        return '🌍 Товарищеские'
    if 'copa america' in ln:
        return '🌍 Копа Америка'
    if 'africa' in ln or 'afcon' in ln:
        return '🌍 Кубок Африки'
    return '🌍 Сборные'


def fetch_nhl(d0: str, d2: str) -> list[dict]:
    """Загрузка НХЛ по датам ET (Eastern Time). API nhle.com использует ET-даты."""
    matches = []
    # НХЛ расписание по ET-датам: сегодня, завтра, послезавтра
    ET = ZoneInfo('America/New_York')
    now_et = datetime.now(ET)
    et_dates = set()
    for offset in range(3):  # сегодня + 2 дня вперёд
        et_dates.add((now_et + timedelta(days=offset)).strftime('%Y-%m-%d'))
    # Также добавляем даты из переданного окна
    et_dates.add(d0)
    et_dates.add(d2)

    seen_game_ids = set()
    for d in sorted(et_dates):
        data = get_json(f'https://api-web.nhle.com/v1/schedule/{d}')
        if not data:
            continue
        for wday in data.get('gameWeek', []):
            for g in wday.get('games', []):
                if g.get('gameState') not in ('PRE', 'FUT'):
                    continue
                gid = g.get('id', 0)
                if gid in seen_game_ids:
                    continue
                seen_game_ids.add(gid)
                try:
                    msk = datetime.fromisoformat(
                        g['startTimeUTC'].replace('Z', '+00:00')).astimezone(MSK)
                except Exception:
                    msk = None
                ho = g.get('homeTeam', {})
                aw = g.get('awayTeam', {})
                matches.append({
                    'sport':    'nhl',
                    'league':   '🏒 НХЛ',
                    'home':     (ho.get('placeName', {}).get('default', '') + ' ' +
                                 ho.get('commonName', {}).get('default', '')).strip(),
                    'away':     (aw.get('placeName', {}).get('default', '') + ' ' +
                                 aw.get('commonName', {}).get('default', '')).strip(),
                    'home_abbr': ho.get('abbrev', ''),
                    'away_abbr': aw.get('abbrev', ''),
                    'home_id':  '',
                    'away_id':  '',
                    'time_msk': msk,
                    'status':   'FUT',
                    })
    log.info('НХЛ: %d матчей (ET даты: %s)', len(matches), ', '.join(sorted(et_dates)))
    return matches


# ─────────────────────────────────────────────────────────────────────
# НХЛ — статистика команд
# ─────────────────────────────────────────────────────────────────────
_nhl_stats_cache: dict[str, dict] = {}

def _load_nhl_standings() -> None:
    """Загрузка таблицы НХЛ для формы и статистики."""
    data = get_json('https://api-web.nhle.com/v1/standings/now')
    if not data or not data.get('standings'):
        return
    for team in data['standings']:
        abbr = team.get('teamAbbrev', {}).get('default', '')
        if not abbr:
            continue
        gp = max(team.get('gamesPlayed', 1), 1)
        gf = team.get('goalFor', 0)
        ga = team.get('goalAgainst', 0)
        w  = team.get('wins', 0)
        l  = team.get('losses', 0)
        otl = team.get('otLosses', 0)
        home_w = team.get('homeWins', 0)
        home_l = team.get('homeLosses', 0)
        away_w = team.get('roadWins', 0)
        away_l = team.get('roadLosses', 0)
        streak = team.get('streakCode', '')
        streak_count = team.get('streakCount', 0)

        # Форма из streak
        form = w / gp if gp else 0.5

        home_gp = max(home_w + home_l + team.get('homeOtLosses', 0), 1)
        away_gp = max(away_w + away_l + team.get('roadOtLosses', 0), 1)

        _nhl_stats_cache[abbr] = {
            'gf_pg': gf / gp,
            'ga_pg': ga / gp,
            'form': form,
            'home_win_rate': home_w / home_gp,
            'away_win_rate': away_w / away_gp,
            'streak': streak,
            'streak_count': streak_count,
            'pts': team.get('points', 0),
        }
    log.info('НХЛ кэш: %d команд', len(_nhl_stats_cache))


# ─────────────────────────────────────────────────────────────────────
# ДВИЖОК ПРОГНОЗОВ v7
# ─────────────────────────────────────────────────────────────────────
def _seed(s: str, lo: float, hi: float) -> float:
    h = abs(hash(s)) % 10000
    return lo + (h / 10000) * (hi - lo)


def predict_match(m: dict) -> Optional[dict]:
    """
    Прогноз на основе РЕАЛЬНЫХ данных last5 + standings + H2H.
    Без данных = пропуск. Без выдумок.
    """
    sport   = m.get('sport', 'football')
    home_id = str(m.get('home_id', '') or '')
    away_id = str(m.get('away_id', '') or '')

    if sport == 'nhl':
        return _predict_nhl(m)

    # ── Last5 — обязательно для обеих команд ────────────────────────
    if not home_id or not away_id:
        return None

    h_last5 = _load_team_last5(home_id)
    a_last5 = _load_team_last5(away_id)

    # Минимум 3 сыгранных матча у каждой команды
    if h_last5['count'] < 3 or a_last5['count'] < 3:
        return None

    # ── Форма из last5 (реальный winrate) ───────────────────────────
    h_form = sum({'W': 3, 'D': 1, 'L': 0}[r] for r in h_last5['results']) / (len(h_last5['results']) * 3)
    a_form = sum({'W': 3, 'D': 1, 'L': 0}[r] for r in a_last5['results']) / (len(a_last5['results']) * 3)

    # Домашняя/гостевая из standings (если есть)
    hs = _team_cache.get(home_id, {})
    ast = _team_cache.get(away_id, {})
    h_home_rate = hs.get('home_win_rate', h_form) if hs else h_form
    a_away_rate = ast.get('away_win_rate', a_form) if ast else a_form

    # ── H2H ─────────────────────────────────────────────────────────
    h2h = _get_h2h(home_id, away_id)
    h2h_bonus = 0.0
    if h2h:
        h2h_home_wins = sum(1 for g in h2h if g['home_goals'] > g['away_goals'])
        h2h_bonus = (h2h_home_wins / len(h2h) - 0.5) * 0.12

    # ── Среднее голов из last5 (реальное) ───────────────────────────
    avg_goals_h = sum(h_last5['goals']) / len(h_last5['goals'])
    avg_goals_a = sum(a_last5['goals']) / len(a_last5['goals'])
    avg_goals = (avg_goals_h + avg_goals_a) / 2

    # ── Сила ────────────────────────────────────────────────────────
    diff = (h_form - a_form) * 0.35 + (h_home_rate - a_away_rate) * 0.30 + h2h_bonus + 0.04

    # ── Кандидаты ставок ────────────────────────────────────────────
    candidates = []

    if diff > 0.18:
        candidates.append(('П1', min(0.82, 0.55 + diff * 0.8)))
    elif diff < -0.18:
        candidates.append(('П2', min(0.82, 0.55 + abs(diff) * 0.8)))
    elif diff > 0.05:
        candidates.append(('Х1', min(0.78, 0.58 + abs(diff) * 0.6)))
    elif diff < -0.05:
        candidates.append(('Х2', min(0.78, 0.58 + abs(diff) * 0.6)))

    if avg_goals >= 2.8:
        candidates.append(('ТБ 2.5', min(0.80, 0.55 + (avg_goals - 2.5) / 3.0 * 0.5)))
    elif avg_goals <= 2.0:
        candidates.append(('ТМ 2.5', min(0.80, 0.55 + (2.5 - avg_goals) / 2.5 * 0.5)))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[1], reverse=True)
    best_oc, best_conf = candidates[0]
    cf_pct = round(best_conf * 100)

    if cf_pct < MIN_CONF_PCT:
        return None

    return {'oc': best_oc, 'cf_pct': cf_pct}


def _predict_nhl(m: dict) -> Optional[dict]:
    """Прогноз для НХЛ на основе таблицы."""
    h_abbr = m.get('home_abbr', '')
    a_abbr = m.get('away_abbr', '')

    hs = _nhl_stats_cache.get(h_abbr, {})
    ast = _nhl_stats_cache.get(a_abbr, {})

    if not hs or not ast:
        return None

    h_form = hs.get('form', 0.5)
    a_form = ast.get('form', 0.5)
    h_home = hs.get('home_win_rate', 0.5)
    a_away = ast.get('away_win_rate', 0.45)
    h_gf = hs.get('gf_pg', 3.0)
    h_ga = hs.get('ga_pg', 3.0)
    a_gf = ast.get('gf_pg', 3.0)
    a_ga = ast.get('ga_pg', 3.0)

    # Streak bonus: команда на серии побед/поражений
    h_streak_bonus = 0.0
    a_streak_bonus = 0.0
    if hs.get('streak') == 'W':
        h_streak_bonus = min(hs.get('streak_count', 0) * 0.02, 0.08)
    elif hs.get('streak') == 'L':
        h_streak_bonus = -min(hs.get('streak_count', 0) * 0.02, 0.08)
    if ast.get('streak') == 'W':
        a_streak_bonus = min(ast.get('streak_count', 0) * 0.02, 0.08)
    elif ast.get('streak') == 'L':
        a_streak_bonus = -min(ast.get('streak_count', 0) * 0.02, 0.08)

    diff = ((h_form - a_form) * 0.30 + (h_home - a_away) * 0.30
            + (h_streak_bonus - a_streak_bonus) * 0.20 + 0.05)

    # Разница очков в таблице
    pts_diff = (hs.get('pts', 50) - ast.get('pts', 50)) / 100.0
    diff += pts_diff * 0.15

    candidates = []

    # Исход (НХЛ без ничьих)
    if diff > 0.04:
        candidates.append(('П1', min(0.82, 0.54 + diff * 0.9)))
    elif diff < -0.04:
        candidates.append(('П2', min(0.82, 0.54 + abs(diff) * 0.9)))

    # Тотал
    exp_total = (h_gf + a_gf + h_ga + a_ga) / 2
    if exp_total >= 6.0:
        candidates.append(('ТБ 5.5', min(0.80, 0.55 + (exp_total - 5.5) / 2.5 * 0.45)))
    elif exp_total <= 5.2:
        candidates.append(('ТМ 5.5', min(0.80, 0.55 + (5.5 - exp_total) / 2.5 * 0.45)))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[1], reverse=True)
    best_oc, best_conf = candidates[0]
    cf_pct = round(best_conf * 100)

    if cf_pct < MIN_CONF_PCT:
        return None

    return {'oc': best_oc, 'cf_pct': cf_pct}


# ─────────────────────────────────────────────────────────────────────
# ФОРМАТИРОВАНИЕ СООБЩЕНИЯ
# ─────────────────────────────────────────────────────────────────────
MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
WDAYS  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

def xe(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def fd(dt):
    return f'{dt.day} {MONTHS[dt.month - 1]} ({WDAYS[dt.weekday()]})' if dt else '—'


def build_message(results: list[dict], total_analyzed: int, now: datetime,
                   has_football: bool = True) -> list[str]:
    """Формирует сообщение с прогнозами и экспрессом дня."""
    if not results:
        msg = f'📊 SportAnalytics by R.Giggs\n{fd(now)} · анализ топ-лиг\n\n'
        if not has_football:
            msg += '⚽ Топ-лиги на паузе (перерыв на сборные)\n'
        msg += f'Матчей с вероятностью >{MIN_CONF_PCT}% не найдено.\nПроанализировано: {total_analyzed}'
        return [msg]

    # Группировка: дата → лига → матчи
    # Сортируем по дате, потом по лиге
    results_sorted = sorted(results, key=lambda r: (
        (r.get('time_msk') or datetime.max.replace(tzinfo=MSK)).strftime('%Y-%m-%d'),
        r['league'],
        -(r['cf_pct']),
    ))

    lines = [f'📊 SportAnalytics by R.Giggs\n{fd(now)} · топ прогнозы >{MIN_CONF_PCT}%']
    if not has_football:
        lines.append('\n⚽ Топ-лиги на паузе (перерыв на сборные)')

    current_date = ''
    current_league = ''
    for r in results_sorted:
        dt = r.get('time_msk')
        date_str = dt.strftime('%Y-%m-%d') if dt else ''
        date_label = f'{dt.day} {MONTHS[dt.month - 1]}' if dt else ''

        if date_str != current_date:
            current_date = date_str
            current_league = ''
            lines.append(f'\n📅 {date_label}')

        if r['league'] != current_league:
            current_league = r['league']
            lines.append(f'{current_league}')

        t = dt.strftime('%H:%M') if dt else ''
        t_str = f' ({t})' if t else ''
        lines.append(f'{r["home"]} — {r["away"]} | {r["oc"]} | {r["cf_pct"]}%{t_str}')

    # ── Экспресс дня ─────────────────────────────────────────────────
    express_picks = [r for r in results if r['cf_pct'] >= EXPRESS_MIN]
    express_picks.sort(key=lambda x: -x['cf_pct'])
    express_picks = express_picks[:3]

    express_lines = []
    if len(express_picks) >= 2:
        express_lines.append('\n🎯 ЭКСПРЕСС ДНЯ')
        for i, r in enumerate(express_picks, 1):
            express_lines.append(f'{i}. {r["home"]} — {r["away"]} | {r["oc"]} | вероятность {r["cf_pct"]}%')
        avg_conf = round(sum(r['cf_pct'] for r in express_picks) / len(express_picks))
        express_lines.append(f'📊 Средняя уверенность: {avg_conf}%')

    footer_lines = ['\n⚠️ Аналитика от SportAnalytics by R.Giggs · Фонбет']

    text = '\n'.join(lines + express_lines + footer_lines)

    # Обрезка до 4096
    if len(text) <= 4096:
        return [text]

    # Если не влезает — разбиваем
    part1_lines = []
    current_len = 0
    split_idx = 0
    all_lines = lines.copy()

    for i, line in enumerate(all_lines):
        if current_len + len(line) + 1 > 3500:
            split_idx = i
            break
        part1_lines.append(line)
        current_len += len(line) + 1
    else:
        split_idx = len(all_lines)

    part1 = '\n'.join(part1_lines)
    part2_lines = all_lines[split_idx:]
    part2 = '\n'.join(part2_lines + express_lines + footer_lines)

    parts = [part1]
    if part2.strip():
        parts.append(part2)
    return parts


# ─────────────────────────────────────────────────────────────────────
# ГЛАВНАЯ ЗАДАЧА
# ─────────────────────────────────────────────────────────────────────
async def daily_job() -> None:
    log.info('═' * 60)
    log.info('▶  %s', datetime.now(MSK).strftime('%Y-%m-%d %H:%M МСК'))
    log.info('═' * 60)

    # Окно: от текущего момента; футбол 48ч, НХЛ 72ч (матчи ночью по МСК)
    now = datetime.now(MSK)
    end_fb  = now + timedelta(hours=48)
    end_nhl = now + timedelta(hours=72)
    d0  = now.strftime('%Y-%m-%d')
    d2  = end_fb.strftime('%Y-%m-%d')

    # ── 1. Кэши ──────────────────────────────────────────────────────
    log.info('▸ Загрузка таблиц футбола…')
    _load_standings()

    log.info('▸ Загрузка таблицы НХЛ…')
    _load_nhl_standings()

    # ── 2. Сбор матчей ────────────────────────────────────────────────
    log.info('▸ Футбол (топ-лиги)…')
    fb_matches = fetch_football(d0, d2)
    has_football = len(fb_matches) > 0

    log.info('▸ НХЛ…')
    nhl_matches = fetch_nhl(d0, d2)

    all_matches = fb_matches + nhl_matches

    # ── 3. Дедупликация ───────────────────────────────────────────────
    seen, unique = set(), []
    for m in all_matches:
        dt = m.get('time_msk')
        end_for_match = end_nhl if m.get('sport') == 'nhl' else end_fb
        if dt and not (now <= dt <= end_for_match):
            continue
        key = (m['home'], m['away'],
               (dt or datetime.min.replace(tzinfo=MSK)).strftime('%Y-%m-%d %H:%M'))
        if key not in seen:
            seen.add(key)
            unique.append(m)

    total_analyzed = len(unique)
    log.info('Матчей для анализа: %d', total_analyzed)

    # ── 4. Глубокий анализ ────────────────────────────────────────────
    results = []
    for m in unique:
        try:
            pred = predict_match(m)
        except Exception as e:
            log.warning('Predict %s vs %s: %s', m['home'], m['away'], e)
            continue

        if not pred:
            continue

        results.append({
            'league':   m.get('league', '—'),
            'home':     m['home'],
            'away':     m['away'],
            'oc':       pred['oc'],
            'cf_pct':   pred['cf_pct'],


            'time_msk': m.get('time_msk'),
            'sport':    m.get('sport', 'football'),
        })

    results.sort(key=lambda x: (-x['cf_pct'], x.get('time_msk') or datetime.max.replace(tzinfo=MSK)))
    log.info('Отобрано (>%d%%): %d', MIN_CONF_PCT, len(results))

    # ── 5. Отправка ──────────────────────────────────────────────────
    messages = build_message(results, total_analyzed, now, has_football=has_football)
    log.info('Отправка %d сообщений → канал %s…', len(messages), CHANNEL_ID)

    bot = Bot(token=TELEGRAM_TOKEN)
    for i, txt in enumerate(messages, 1):
        for attempt in range(3):
            try:
                await bot.send_message(
                    chat_id=CHANNEL_ID, text=txt,
                    disable_web_page_preview=True,
                    read_timeout=30, write_timeout=30, connect_timeout=30,
                )
                log.info('Отправлено %d/%d (%d симв.)', i, len(messages), len(txt))
                await asyncio.sleep(MSG_DELAY)
                break
            except TelegramError as e:
                log.error('Telegram (попытка %d): %s', attempt + 1, e)
                if attempt < 2:
                    await asyncio.sleep(3)


    log.info('✓ Готово | проанализировано %d | отобрано %d', total_analyzed, len(results))


def run_job():
    asyncio.run(daily_job())


# ─────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────
def main():
    log.info('SportAnalytics Bot v7.0')
    log.info('Канал: %s | KEY: %s…', CHANNEL_ID, ALLSPORTS_KEY[:8])

    if not TELEGRAM_TOKEN:
        log.error('TELEGRAM_BOT_TOKEN не задан! export TELEGRAM_BOT_TOKEN=...')
        sys.exit(1)

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
