#!/usr/bin/env python3
"""Score an Owners Club week from persisted lineups and final MLB box scores."""

import argparse
import json
import os
import re
import subprocess
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path


MATCHUPS = {
    17: [
        ("keystone", "ABQ-HOU", "ALBUQUERQUE HERMANOS", "HOUSTON HACKERS"),
        ("keystone", "IND-DEN", "INDIANA RAIDERS", "DENVER APOCALYPSE"),
        ("keystone", "PIT-PHI", "PITTSBURGH BOMBERS", "PHILADELPHIA PEREGRINES"),
        ("keystone", "CLE-BAL", "CLEVELAND HIGHLANDERS", "BALTIMORE COBRAS"),
        ("keystone", "CAL-SEA", "CALIFORNIA LEOPARDS", "SEATTLE SLAYERS"),
        ("keystone", "ARZ-POR", "ARIZONA DIABLOS", "PORTLAND HOPHEADS"),
        ("keystone", "SF-OAK", "SAN FRANCISCO SPIDERS", "OAKLAND ALBATROSSES"),
        ("keystone", "TOR-CHI", "TORONTO VIXENS", "CHICAGO ROGUES"),
        ("diamond", "CIN-LV", "CINCINNATI WHALES", "LAS VEGAS GUNSLINGERS"),
        ("diamond", "LA-SD", "LOS ANGELES SPARTANS", "SAN DIEGO PROFESSORS"),
        ("diamond", "ORL-NO", "ORLANDO PALADINS", "NEW ORLEANS NIGHTHAWKS"),
        ("diamond", "CAR-DAL", "CAROLINA SALAMANDERS", "DALLAS ROADRUNNERS"),
        ("diamond", "HRT-WSH", "HARTFORD DARK BLUES", "WASHINGTON COMRADES"),
        ("diamond", "KC-SA", "KANSAS CITY MINERS", "SAN ANTONIO OCOTILLOS"),
        ("diamond", "MIA-NY", "MIAMI METROS", "NEW YORK DONKEYS"),
        ("diamond", "MON-ATL", "MONTREAL WOLVERINES", "ATLANTA ANACONDAS"),
    ],
    18: [
        ("keystone", "POR-CAL", "PORTLAND HOPHEADS", "CALIFORNIA LEOPARDS"),
        ("keystone", "SEA-ARZ", "SEATTLE SLAYERS", "ARIZONA DIABLOS"),
        ("keystone", "OAK-TOR", "OAKLAND ALBATROSSES", "TORONTO VIXENS"),
        ("keystone", "CHI-SF", "CHICAGO ROGUES", "SAN FRANCISCO SPIDERS"),
        ("keystone", "BAL-PIT", "BALTIMORE COBRAS", "PITTSBURGH BOMBERS"),
        ("keystone", "PHI-CLE", "PHILADELPHIA PEREGRINES", "CLEVELAND HIGHLANDERS"),
        ("keystone", "HOU-IND", "HOUSTON HACKERS", "INDIANA RAIDERS"),
        ("keystone", "DEN-ABQ", "DENVER APOCALYPSE", "ALBUQUERQUE HERMANOS"),
        ("diamond", "SA-HRT", "SAN ANTONIO OCOTILLOS", "HARTFORD DARK BLUES"),
        ("diamond", "WSH-KC", "WASHINGTON COMRADES", "KANSAS CITY MINERS"),
        ("diamond", "NY-MON", "NEW YORK DONKEYS", "MONTREAL WOLVERINES"),
        ("diamond", "ATL-MIA", "ATLANTA ANACONDAS", "MIAMI METROS"),
        ("diamond", "DAL-ORL", "DALLAS ROADRUNNERS", "ORLANDO PALADINS"),
        ("diamond", "NO-CAR", "NEW ORLEANS NIGHTHAWKS", "CAROLINA SALAMANDERS"),
        ("diamond", "LV-LA", "LAS VEGAS GUNSLINGERS", "LOS ANGELES SPARTANS"),
        ("diamond", "SD-CIN", "SAN DIEGO PROFESSORS", "CINCINNATI WHALES"),
    ],
}

DAY_KEYS = ["M", "Tu", "W", "Th", "F", "St", "Su"]


def slugify(value):
    normalized = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def load_dev_vars(path):
    for raw in Path(path).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def request_json(url, key=None, method="GET", body=None, prefer=None):
    headers = {"Accept": "application/json", "User-Agent": "OwnersClubBaseball/1.0"}
    if key:
        headers.update({"apikey": key, "Authorization": f"Bearer {key}"})
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(
        url, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except Exception:
        # The host Python certificate store can be incomplete; curl uses the system store.
        command = ["curl", "-fsS", "--retry", "4", "--retry-all-errors", "--connect-timeout", "15", "-X", method, url, "-H", "Accept: application/json"]
        if key:
            command += ["-H", f"apikey: {key}", "-H", f"Authorization: Bearer {key}"]
        if body is not None:
            command += ["-H", "Content-Type: application/json", "--data-binary", json.dumps(body)]
        if prefer:
            command += ["-H", f"Prefer: {prefer}"]
        raw = subprocess.check_output(command)
        return json.loads(raw) if raw else None


def supabase(base, key, table, params=None, method="GET", body=None, prefer=None):
    query = urllib.parse.urlencode(params or {}, safe=".*(),:")
    url = f"{base.rstrip('/')}/rest/v1/{table}" + (f"?{query}" if query else "")
    return request_json(url, key, method, body, prefer)


def ip_value(value):
    whole, _, outs = str(value or "0.0").partition(".")
    return int(whole or 0) + int(outs or 0) / 3


def item(code, count, points):
    return {"stat": code, "count": count, "points": points}


def score_hitter(stats, grand_slams=0):
    singles = max(0, int(stats.get("hits", 0)) - int(stats.get("doubles", 0)) - int(stats.get("triples", 0)) - int(stats.get("homeRuns", 0)))
    cycle = int(singles > 0 and int(stats.get("doubles", 0)) > 0 and int(stats.get("triples", 0)) > 0 and int(stats.get("homeRuns", 0)) > 0)
    values = [
        ("R", int(stats.get("runs", 0)), 1), ("1B", singles, 1),
        ("2B", int(stats.get("doubles", 0)), 3), ("3B", int(stats.get("triples", 0)), 4),
        ("HR", int(stats.get("homeRuns", 0)), 4), ("RBI", int(stats.get("rbi", 0)), 1),
        ("SB", int(stats.get("stolenBases", 0)), 2), ("CS", int(stats.get("caughtStealing", 0)), -1),
        ("BB", int(stats.get("baseOnBalls", 0)), 1), ("HBP", int(stats.get("hitByPitch", 0)), 1),
        ("GIDP", int(stats.get("groundIntoDoublePlay", 0)), -2), ("CYC", cycle, 5),
        ("SLAM", grand_slams, 2),
    ]
    breakdown = [item(code, count, count * rate) for code, count, rate in values if count]
    return int(sum(row["points"] for row in breakdown)), breakdown


def score_pitcher(stats):
    relief = int(stats.get("gamesPitched", stats.get("gamesPlayed", 0))) if not int(stats.get("gamesStarted", 0)) else 0
    qs = int(int(stats.get("gamesStarted", 0)) > 0 and ip_value(stats.get("inningsPitched")) >= 6 and int(stats.get("earnedRuns", 0)) <= 3)
    values = [
        ("IP", ip_value(stats.get("inningsPitched")), 1), ("W", int(stats.get("wins", 0)), 4),
        ("L", int(stats.get("losses", 0)), -2), ("CG", int(stats.get("completeGames", 0)), 2),
        ("SHO", int(stats.get("shutouts", 0)), 5), ("SV", int(stats.get("saves", 0)), 5),
        ("K", int(stats.get("strikeOuts", 0)), 1), ("HLD", int(stats.get("holds", 0)), 4),
        ("RAPP", relief, 1), ("QS", qs, 3), ("BSV", int(stats.get("blownSaves", 0)), -1),
    ]
    breakdown = [item(code, count, count * rate) for code, count, rate in values if count]
    return int(sum(row["points"] for row in breakdown)), breakdown


def merge_stats(target, incoming):
    for key, value in incoming.items():
        if key == "inningsPitched":
            continue
        if isinstance(value, (int, float)) and key not in {"gamesPlayed"}:
            target[key] = target.get(key, 0) + value
        elif key not in target:
            target[key] = value
    if "outs" in target:
        target["inningsPitched"] = f"{int(target['outs']) // 3}.{int(target['outs']) % 3}"


def fetch_mlb_days(start, end):
    schedule = request_json(f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate={start}&endDate={end}")
    results = {}
    final_game_pks = [
        game["gamePk"]
        for day in schedule.get("dates", [])
        for game in day.get("games", [])
        if game.get("status", {}).get("abstractGameState") == "Final"
    ]
    def fetch_game(game_pk):
        return (
            game_pk,
            request_json(f"https://statsapi.mlb.com/api/v1/game/{game_pk}/boxscore"),
            request_json(f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"),
        )
    with ThreadPoolExecutor(max_workers=4) as executor:
        game_data = {game_pk: (box, feed) for game_pk, box, feed in executor.map(fetch_game, final_game_pks)}
    for day in schedule.get("dates", []):
        final_games = [game for game in day.get("games", []) if game.get("status", {}).get("abstractGameState") == "Final"]
        players = defaultdict(lambda: {"name": "", "batting": {}, "pitching": {}, "grandSlams": 0})
        for game in final_games:
            game_pk = game["gamePk"]
            box, feed = game_data[game_pk]
            slams = defaultdict(int)
            for play in feed.get("liveData", {}).get("plays", {}).get("allPlays", []):
                if play.get("result", {}).get("eventType") == "home_run" and int(play.get("result", {}).get("rbi", 0)) == 4:
                    slams[int(play.get("matchup", {}).get("batter", {}).get("id", 0))] += 1
            for side in ("away", "home"):
                for row in box.get("teams", {}).get(side, {}).get("players", {}).values():
                    player_id = int(row.get("person", {}).get("id", 0))
                    if not player_id:
                        continue
                    entry = players[player_id]
                    entry["name"] = row.get("person", {}).get("fullName", "")
                    entry["grandSlams"] += slams[player_id]
                    for group in ("batting", "pitching"):
                        stats = row.get("stats", {}).get(group, {})
                        if stats and int(stats.get("gamesPlayed", stats.get("gamesPitched", 0)) or 0):
                            merge_stats(entry[group], stats)
        results[day["date"]] = {"games": len(final_games), "players": dict(players)}
    return results


def effective_lineups(rows, dates):
    by_team = defaultdict(list)
    for row in rows:
        by_team[row["team_slug"]].append(row)
    result = {}
    for team, entries in by_team.items():
        entries.sort(key=lambda row: row["lineup_date"])
        for stat_date in dates:
            candidates = [row for row in entries if row["lineup_date"] <= stat_date]
            if candidates:
                result[(team, stat_date)] = candidates[-1]["lineup"]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--game", type=int, default=17)
    parser.add_argument("--week", type=int, default=17)
    parser.add_argument("--season", type=int, default=32)
    parser.add_argument("--start", type=date.fromisoformat, default=date(2026, 7, 20))
    parser.add_argument("--env-file", default=".dev.vars")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_dev_vars(args.env_file)
    base = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    dates = [(args.start + timedelta(days=index)).isoformat() for index in range(7)]
    matchup_rows = MATCHUPS[args.game]
    all_lineups = supabase(base, key, "team_daily_lineups", {
        "select": "team_slug,lineup_date,lineup", "lineup_date": f"lte.{dates[-1]}", "order": "team_slug.asc,lineup_date.asc"
    })
    lineups = effective_lineups(all_lineups, dates)
    mlb = fetch_mlb_days(dates[0], dates[-1])
    completed_dates = [day for day in dates if mlb.get(day, {}).get("games", 0)]
    display_dates = completed_dates or [dates[0]]
    week_complete = dates[-1] in completed_dates

    player_lookup = {}
    for stat_date, day in mlb.items():
        for player_id, row in day["players"].items():
            player_lookup[(stat_date, slugify(row["name"]))] = row

    players = []
    teams = []
    matchups = []
    missing_players = set()
    for league, matchup_key, away, home in matchup_rows:
        matchup_totals = {}
        for home_away, team in (("A", away), ("H", home)):
            team_slug = slugify(team)
            team_total = 0
            team_pitching = 0
            team_starts = 0
            team_player_rows = []
            team_daily_rows = []
            for stat_date in display_dates:
                offense = pitching = 0
                lineup = lineups.get((team_slug, stat_date), {})
                for slot, player_slug in lineup.items():
                    raw = player_lookup.get((stat_date, player_slug))
                    if raw is None:
                        missing_players.add(player_slug)
                        raw = {"name": player_slug.replace("-", " ").title(), "batting": {}, "pitching": {}, "grandSlams": 0}
                    is_pitcher = slot.startswith("SP") or slot.startswith("RP")
                    if is_pitcher:
                        points, breakdown = score_pitcher(raw.get("pitching", {}))
                        pitching += points
                        stats = raw.get("pitching", {})
                        if slot.startswith("SP"):
                            team_starts += int(stats.get("gamesStarted", 0) or 0)
                    else:
                        points, breakdown = score_hitter(raw.get("batting", {}), raw.get("grandSlams", 0))
                        offense += points
                        stats = raw.get("batting", {})
                    player_result = {
                        "season_number": args.season, "game_number": args.game, "week_number": args.week,
                        "matchup_key": matchup_key, "team_name": team, "player_name": raw["name"],
                        "roster_slot": re.sub(r"[0-9]+$", "", slot).replace("UTIL", "DH"), "stat_date": stat_date,
                        "sheet_points": None, "calculated_points": points, "scoring_breakdown": breakdown,
                        "raw_stats": {"source": "MLB Stats API", "slotCode": slot, "mlb": stats},
                    }
                    players.append(player_result)
                    team_player_rows.append(player_result)
                daily = offense + pitching
                team_total += daily
                team_pitching += pitching
                team_day_result = {
                    "season_number": args.season, "game_number": args.game, "week_number": args.week,
                    "matchup_key": matchup_key, "team_name": team, "home_away": home_away, "stat_date": stat_date,
                    "sheet_points": None, "calculated_points": daily, "offense_points": offense,
                    "pitching_points": pitching, "payload": {"source": "MLB Stats API", "day": DAY_KEYS[dates.index(stat_date)]},
                }
                teams.append(team_day_result)
                team_daily_rows.append(team_day_result)
            if week_complete:
                starter_rows = defaultdict(list)
                for row in team_player_rows:
                    if row["roster_slot"] == "SP":
                        starter_rows[row["player_name"]].append(row)
                for rows in starter_rows.values():
                    starts = sum(int(row["raw_stats"].get("mlb", {}).get("gamesStarted", 0) or 0) for row in rows)
                    if starts != 1:
                        continue
                    start_row = next(row for row in rows if int(row["raw_stats"].get("mlb", {}).get("gamesStarted", 0) or 0))
                    adjustment = int(start_row["calculated_points"])
                    start_row["calculated_points"] += adjustment
                    start_row["scoring_breakdown"].append({"stat": "1START", "count": 1, "points": adjustment})
                    day_row = next(row for row in team_daily_rows if row["stat_date"] == start_row["stat_date"])
                    day_row["calculated_points"] += adjustment
                    day_row["pitching_points"] += adjustment
                    team_total += adjustment
                    team_pitching += adjustment
            psr = 0 if week_complete else max(0, 8 - team_starts)
            matchup_totals[home_away] = {"total": team_total, "pitching": team_pitching, "psr": psr}
        away_score, home_score = matchup_totals["A"]["total"], matchup_totals["H"]["total"]
        away_psr, home_psr = matchup_totals["A"]["psr"], matchup_totals["H"]["psr"]
        projected_margin = (away_score + 14 * away_psr) - (home_score + 14 * home_psr)
        matchups.append({
            "season_number": args.season, "game_number": args.game, "week_number": args.week,
            "matchup_key": matchup_key, "league_code": league, "away_team_name": away, "home_team_name": home,
            "away_score": away_score, "home_score": home_score, "away_psr": away_psr, "home_psr": home_psr,
            "away_lead": max(0, projected_margin), "home_lead": max(0, -projected_margin),
            "payload": {"source": "MLB Stats API", "throughDate": completed_dates[-1] if completed_dates else None, "weekComplete": week_complete, "leadFormula": "score + (14 * PSR)"},
        })

    summary = {"matchups": len(matchups), "teamDays": len(teams), "playerDays": len(players), "through": completed_dates[-1] if completed_dates else None, "weekComplete": week_complete, "lineupPlayersWithoutAnMlbAppearance": len(missing_players)}
    if args.dry_run:
        print(json.dumps(summary, indent=2))
        return
    filters = {"season_number": f"eq.{args.season}", "game_number": f"eq.{args.game}", "week_number": f"eq.{args.week}"}
    for table in ("game_player_daily_score_results", "game_team_daily_score_results", "game_matchup_score_results", "game_score_runs"):
        supabase(base, key, table, filters, method="DELETE")
    supabase(base, key, "game_score_runs", method="POST", body=[{
        "season_number": args.season, "game_number": args.game, "week_number": args.week,
        "source": "mlb_stats_api", "status": "complete", "completed_at": f"{date.today().isoformat()}T00:00:00Z",
        "metadata": {"startDate": dates[0], "endDate": dates[-1], "throughDate": summary["through"], "weekComplete": week_complete, "lineupMode": "effective persisted snapshot"},
    }], prefer="return=minimal")
    for table, rows in (("game_matchup_score_results", matchups), ("game_team_daily_score_results", teams), ("game_player_daily_score_results", players)):
        for index in range(0, len(rows), 500):
            supabase(base, key, table, method="POST", body=rows[index:index+500], prefer="return=minimal")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
