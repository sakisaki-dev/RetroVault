"""Weekly scores -> generated schedule content (rules only, no AI): public/data/league/schedule.json.

Input: data/y80/schedules.json (schedule.set, one season per key: every league game by week, the final standings,
the coach's opponents with their records and O/D ratings, his playoff games) and teams.json.

Output, per season:
  coachGames   the coach's game log: week, round, site, opponent, score, result, margin, the opponent's final record
               and O/D ratings (the season summary screen), and whether it was an upset
  table        all 32 clubs: W-L-T, win %, points for / against, differential, strength of schedule (the average final
               win % of the clubs it played, a tie counting half), power score and rank, division rank
  leaders      best offense, best defense (fewest allowed per game), worst defense, best differential
  upset        the regular-season win by the club with the worst final record over the club with the best
  blowout / shootout   the biggest margin and the most combined points
Across seasons:
  headToHead   the coach's clubs against each opponent (regular season and playoffs): W-L-T and every meeting
  records      game marks: biggest margin, most combined points, most points by one club, the coach's longest winning
               streak

Power score (documented in docs/STATS_REFERENCE.md):
  100 x win % + 1.5 x point differential per game + 40 x (strength of schedule - 0.5), one decimal; ties broken by
  differential, then points scored, then name.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = ROOT / "public" / "data" / "league" / "schedule.json"


def _read(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


TEAMS = _read(SRC / "teams.json", {})
BY_ABBR = {t["abbr"]: name for name, t in TEAMS.items() if t.get("conference")}
SCHEDULES = (_read(SRC / "schedules.json", {}) or {}).get("seasons", {})


# Pythagorean expectation exponent (the NFL convention, 2.37): win share ~ PF^x / (PF^x + PA^x)
PYTHAG_EXP = 2.37


def pct(w: int, l: int, t: int) -> float:
    n = w + l + t
    return (w + 0.5 * t) / n if n else 0.0


def record_str(w: int, l: int, t: int) -> str:
    return f"{w}-{l}" + (f"-{t}" if t else "")


def playoff_rounds(n: int) -> list[str]:
    """Round names for the coach's n playoff games, last = the Retro Bowl (the Super Bowl)."""
    names = ["Wild card", "Divisional", "Conference", "Super Bowl"]
    return names[-n:] if n <= len(names) else [f"Playoff {i + 1}" for i in range(n - len(names))] + names


def season_content(season: str, s: dict) -> dict:
    weeks = s.get("weeks", [])
    tally: dict[str, dict] = {}
    opponents: dict[str, list[str]] = {}
    games = []
    for wk in weeks:
        for gm in wk.get("games", []):
            a, h, sa, sh = gm["away"], gm["home"], gm["away_score"], gm["home_score"]
            games.append({"week": wk["week"], "away": a, "home": h, "awayScore": sa, "homeScore": sh})
            for me, them, us, op in ((a, h, sa, sh), (h, a, sh, sa)):
                r = tally.setdefault(me, {"w": 0, "l": 0, "t": 0, "pf": 0, "pa": 0})
                r["w" if us > op else "l" if us < op else "t"] += 1
                r["pf"] += us
                r["pa"] += op
                opponents.setdefault(me, []).append(them)
    win = {k: pct(r["w"], r["l"], r["t"]) for k, r in tally.items()}
    division = {}
    for div, rows in s.get("standings", {}).items():
        for i, row in enumerate(rows):
            abbr = TEAMS.get(row["team"], {}).get("abbr")
            if abbr:
                division[abbr] = (div, i + 1)
    table = []
    for abbr, r in tally.items():
        n = r["w"] + r["l"] + r["t"]
        sos = sum(win[o] for o in opponents[abbr]) / len(opponents[abbr])
        diff = r["pf"] - r["pa"]
        score = round(100 * win[abbr] + 1.5 * diff / n + 40 * (sos - 0.5), 1)
        name = BY_ABBR.get(abbr, abbr)
        table.append({"team": name, "abbr": abbr, "conference": TEAMS.get(name, {}).get("conference"),
                      "division": division.get(abbr, (None,))[0], "divisionRank": division.get(abbr, (None, None))[1],
                      "w": r["w"], "l": r["l"], "t": r["t"], "record": record_str(r["w"], r["l"], r["t"]),
                      "pct": round(win[abbr], 3), "pf": r["pf"], "pa": r["pa"], "diff": diff,
                      "ppg": round(r["pf"] / n, 1), "papg": round(r["pa"] / n, 1), "sos": round(sos, 3),
                      "powerScore": score})
    table.sort(key=lambda x: (-x["powerScore"], -x["diff"], -x["pf"], x["team"]))
    for i, row in enumerate(table):
        row["power"] = i + 1
    by_abbr = {row["abbr"]: row for row in table}

    # the coach's season: regular season from the weekly scores, playoffs from the season review
    coach = s.get("abbr")
    ratings = {o["week"]: o for o in s.get("coachOpponents", [])}
    log = []
    for wk in weeks:
        gm = next((g for g in wk.get("games", []) if coach in (g["away"], g["home"])), None)
        if gm is None:
            log.append({"week": wk["week"], "round": "Bye"})
            continue
        home = gm["home"] == coach
        opp = gm["away"] if home else gm["home"]
        us, them = (gm["home_score"], gm["away_score"]) if home else (gm["away_score"], gm["home_score"])
        log.append({"week": wk["week"], "round": f"Week {wk['week']}", "site": "home" if home else "away",
                    "opp": BY_ABBR.get(opp, opp), "oppAbbr": opp, "for": us, "against": them})
    playoffs = s.get("coachPlayoffs", [])
    for rnd, p in zip(playoff_rounds(len(playoffs)), playoffs):
        log.append({"week": p["week"], "round": rnd, "site": "home" if p.get("home") else "away",
                    "opp": BY_ABBR.get(p["opp"], p["opp"]), "oppAbbr": p["opp"], "for": p["for"], "against": p["against"],
                    "playoff": True})
    for g in log:
        if "for" not in g:
            continue
        g["result"] = "W" if g["for"] > g["against"] else "L" if g["for"] < g["against"] else "T"
        g["margin"] = g["for"] - g["against"]
        g["score"] = f"{max(g['for'], g['against'])}-{min(g['for'], g['against'])}"
        o = ratings.get(g["week"])
        if o:
            g.update({"oppRecord": o["record"], "oppOff": o["off"], "oppDef": o["def"]})
        elif g["oppAbbr"] in by_abbr:
            g["oppRecord"] = by_abbr[g["oppAbbr"]]["record"]
    reg = [g for g in log if "for" in g and not g.get("playoff")]
    post = [g for g in log if g.get("playoff")]
    coach_row = by_abbr.get(coach, {})

    # the season's notable games (regular season, every club)
    def winner_loser(g):
        if g["awayScore"] == g["homeScore"]:
            return None
        return ((g["away"], g["home"]) if g["awayScore"] > g["homeScore"] else (g["home"], g["away"]))
    decided = [(g, *wl) for g in games if (wl := winner_loser(g))]
    upset = max(decided, key=lambda x: (win[x[2]] - win[x[1]], -x[0]["week"]), default=None)
    blowout = max(games, key=lambda g: (abs(g["awayScore"] - g["homeScore"]), -g["week"]), default=None)
    shootout = max(games, key=lambda g: (g["awayScore"] + g["homeScore"], -g["week"]), default=None)

    def game_ref(g):
        a, h = BY_ABBR.get(g["away"], g["away"]), BY_ABBR.get(g["home"], g["home"])
        top = max(g["awayScore"], g["homeScore"])
        low = min(g["awayScore"], g["homeScore"])
        win_ = a if g["awayScore"] > g["homeScore"] else h if g["homeScore"] > g["awayScore"] else None
        lose = (h if win_ == a else a) if win_ else None
        return {"week": g["week"], "away": a, "home": h, "awayScore": g["awayScore"], "homeScore": g["homeScore"],
                "winner": win_, "loser": lose, "score": f"{top}-{low}", "margin": top - low, "total": top + low}

    leaders = {
        "bestOffense": min(table, key=lambda r: (-r["ppg"], r["team"]))["team"],
        "bestDefense": min(table, key=lambda r: (r["papg"], r["team"]))["team"],
        "worstDefense": min(table, key=lambda r: (-r["papg"], r["team"]))["team"],
        "bestDiff": min(table, key=lambda r: (-r["diff"], r["team"]))["team"],
    }
    # ---- League by the numbers (regular season) ----
    n_games = len(games)
    pts = [g["awayScore"] + g["homeScore"] for g in games]
    margins = [abs(g["awayScore"] - g["homeScore"]) for g in games]
    home_w = sum(g["homeScore"] > g["awayScore"] for g in games)
    away_w = sum(g["awayScore"] > g["homeScore"] for g in games)
    ties = [game_ref(g) for g in games if g["awayScore"] == g["homeScore"]]
    one_score = sum(1 for m in margins if 0 < m <= 8)
    weeks_avg = [{"week": wk["week"], "avg": round(sum(g["away_score"] + g["home_score"] for g in wk["games"]) / max(1, 2 * len(wk["games"])), 1),
                  "high": max((max(g["away_score"], g["home_score"]) for g in wk["games"]), default=0)} for wk in weeks]
    closest = min((g for g in games if g["awayScore"] != g["homeScore"]), key=lambda g: (abs(g["awayScore"] - g["homeScore"]), -(g["awayScore"] + g["homeScore"]), g["week"]), default=None)
    most_in_loss = max((g for g in games if g["awayScore"] != g["homeScore"]), key=lambda g: (min(g["awayScore"], g["homeScore"]), -g["week"]), default=None)
    fewest_in_win = min((g for g in games if g["awayScore"] != g["homeScore"]), key=lambda g: (max(g["awayScore"], g["homeScore"]), g["week"]), default=None)
    league = {
        "games": n_games, "points": sum(pts), "ppg": round(sum(pts) / (2 * n_games), 1) if n_games else 0,
        "combinedAvg": round(sum(pts) / n_games, 1) if n_games else 0,
        "homeWinPct": round(home_w / max(1, home_w + away_w), 3), "homeWins": home_w, "awayWins": away_w,
        "ties": ties, "oneScoreGames": one_score, "oneScoreShare": round(one_score / max(1, n_games), 3),
        "fiftyPointGames": sum(1 for g in games if max(g["awayScore"], g["homeScore"]) >= 50),
        "avgMargin": round(sum(margins) / max(1, n_games), 1),
        "weeks": weeks_avg,
        **({"closest": game_ref(closest)} if closest else {}),
        **({"mostInLoss": game_ref(most_in_loss)} if most_in_loss else {}),
        **({"fewestInWin": game_ref(fewest_in_win)} if fewest_in_win else {}),
    }

    # ---- Every club: home/away, one-score record, streaks, last five ----
    for row in table:
        mine = [(wk["week"], g) for wk in weeks for g in wk["games"] if row["abbr"] in (g["away"], g["home"])]
        res = []
        home = [0, 0, 0]; away = [0, 0, 0]; close = [0, 0, 0]
        for wk_n, g in mine:
            is_home = g["home"] == row["abbr"]
            us, them = (g["home_score"], g["away_score"]) if is_home else (g["away_score"], g["home_score"])
            k = 0 if us > them else 1 if us < them else 2
            (home if is_home else away)[k] += 1
            if abs(us - them) <= 8:
                close[k] += 1
            res.append("WLT"[k])
        best_w = cur = 0
        for x in res:
            cur = cur + 1 if x == "W" else 0
            best_w = max(best_w, cur)
        tail = res[-1] if res else ""
        streak = len(res) - len("".join(res).rstrip(tail)) if res else 0
        n_g = row["w"] + row["l"] + row["t"]
        margins_t = []
        for _, g in mine:
            is_home = g["home"] == row["abbr"]
            margins_t.append((g["home_score"] - g["away_score"]) * (1 if is_home else -1))
        mean_m = sum(margins_t) / max(1, len(margins_t))
        sd = (sum((m - mean_m) ** 2 for m in margins_t) / max(1, len(margins_t))) ** 0.5
        pf_e, pa_e = row["pf"] ** PYTHAG_EXP, row["pa"] ** PYTHAG_EXP
        pythag = pf_e / (pf_e + pa_e) if pf_e + pa_e else 0.5
        wins_eq = row["w"] + 0.5 * row["t"]
        hp, ap = pct(*home), pct(*away)
        row.update({"pythag": round(pythag, 3), "expWins": round(pythag * n_g, 1), "luck": round(wins_eq - pythag * n_g, 1),
                    "marginSd": round(sd, 1), "homeEdge": round(hp - ap, 3),
                    "adjMargin": round(mean_m + 40 * (row["sos"] - 0.5), 1)})
        row.update({"home": record_str(*home), "away": record_str(*away), "oneScore": record_str(*close),
                    "longestWinStreak": best_w, "streak": f"{tail}{streak}" if res else "", "last5": "".join(res[-5:]),
                    "results": "".join(res)})

    # ---- The coach's season in detail ----
    played = [g for g in log if "result" in g]
    reg_played = [g for g in played if not g.get("playoff")]
    def rec(gs):
        return record_str(sum(g["result"] == "W" for g in gs), sum(g["result"] == "L" for g in gs), sum(g["result"] == "T" for g in gs))
    winning_opps = [g for g in reg_played if g["oppAbbr"] in by_abbr and by_abbr[g["oppAbbr"]]["pct"] > 0.5]
    rated = [g for g in played if g.get("oppOff") is not None]
    best_win = max((g for g in played if g["result"] == "W"), key=lambda g: (g["margin"], g["week"]), default=None)
    worst = min((g for g in played if g["result"] == "L"), key=lambda g: (g["margin"], -g["week"]), default=None)
    coach_detail = {
        "home": rec([g for g in reg_played if g["site"] == "home"]), "away": rec([g for g in reg_played if g["site"] == "away"]),
        "oneScore": rec([g for g in played if abs(g["margin"]) <= 8]), "vsWinning": rec(winning_opps), "vsWinningGames": len(winning_opps),
        "ppg": round(sum(g["for"] for g in played) / max(1, len(played)), 1), "papg": round(sum(g["against"] for g in played) / max(1, len(played)), 1),
        "avgOppOff": round(sum(g["oppOff"] for g in rated) / max(1, len(rated)), 2) if rated else None,
        "avgOppDef": round(sum(g["oppDef"] for g in rated) / max(1, len(rated)), 2) if rated else None,
        "longestWinStreak": coach_row.get("longestWinStreak"),
        **({"bestWin": {k: best_win[k] for k in ("week", "round", "opp", "for", "against", "margin")}} if best_win else {}),
        **({"worstLoss": {k: worst[k] for k in ("week", "round", "opp", "for", "against", "margin")}} if worst else {}),
        "results": "".join(g["result"] for g in played),
    }

    up = None
    if upset:
        g, w_, l_ = upset
        up = {**game_ref(g), "winnerRecord": by_abbr[w_]["record"], "loserRecord": by_abbr[l_]["record"],
              "gap": round(win[l_] - win[w_], 3)}
    return {
        "season": season, "coachTeam": s.get("team"), "coachAbbr": coach,
        "coachRecord": {**{k: coach_row.get(k) for k in ("w", "l", "t", "pf", "pa", "diff", "power")},
                        "record": coach_row.get("record"),
                        "playoffs": record_str(sum(g["result"] == "W" for g in post), sum(g["result"] == "L" for g in post),
                                               sum(g["result"] == "T" for g in post))},
        "coachGames": log,
        "coachDetail": coach_detail,
        "league": league,
        "table": table,
        "leaders": leaders,
        **({"upset": up} if up else {}),
        **({"blowout": game_ref(blowout)} if blowout else {}),
        **({"shootout": game_ref(shootout)} if shootout else {}),
        "games": games,
        "regularSeasonGames": len(reg),
    }


def build() -> dict:
    seasons = {y: season_content(y, s) for y, s in sorted(SCHEDULES.items(), key=lambda kv: int(kv[0].lstrip("Y")))}
    h2h: dict[str, dict] = {}
    streak = best = None
    run, run_from = 0, None
    for y, sc in seasons.items():
        for g in sc["coachGames"]:
            if "result" not in g:
                continue
            r = h2h.setdefault(g["opp"], {"team": g["opp"], "w": 0, "l": 0, "t": 0, "meetings": []})
            r[{"W": "w", "L": "l", "T": "t"}[g["result"]]] += 1
            r["meetings"].append({"season": y, "week": g["week"], "round": g["round"], "site": g["site"],
                                  "coachTeam": sc["coachTeam"], "for": g["for"], "against": g["against"],
                                  "result": g["result"]})
            if g["result"] == "W":
                run_from = run_from or (y, g["week"])
                run += 1
                if best is None or run > best["games"]:
                    best = {"games": run, "from": {"season": run_from[0], "week": run_from[1]},
                            "to": {"season": y, "week": g["week"], "round": g["round"]}, "team": sc["coachTeam"]}
            else:
                run, run_from = 0, None
    for r in h2h.values():
        r["record"] = record_str(r["w"], r["l"], r["t"])
        r["games"] = len(r["meetings"])
    all_games = [(y, g) for y, sc in seasons.items() for g in sc["games"]]

    def mark(key, label, pick):
        if not all_games:
            return None
        y, g = max(all_games, key=lambda yg: (pick(yg[1]), -int(yg[0].lstrip("Y")), -yg[1]["week"]))
        a, h = BY_ABBR.get(g["away"], g["away"]), BY_ABBR.get(g["home"], g["home"])
        return {"id": key, "label": label, "value": pick(g), "season": y, "week": g["week"], "away": a, "home": h,
                "awayScore": g["awayScore"], "homeScore": g["homeScore"]}
    records = [r for r in (
        mark("biggest-margin", "Biggest margin", lambda g: abs(g["awayScore"] - g["homeScore"])),
        mark("most-combined", "Most combined points", lambda g: g["awayScore"] + g["homeScore"]),
        mark("most-points", "Most points by one club", lambda g: max(g["awayScore"], g["homeScore"])),
    ) if r]
    if best:
        records.append({"id": "coach-win-streak", "label": "Longest winning streak (the coach's club)", "value": best["games"],
                        **best})
    # Every club across the seasons that have weekly scores (a season with no upload is simply missing, and the next
    # uploaded one picks up from there); the change is against the club's previous season with data
    KEEP = ("record", "w", "l", "t", "pct", "pf", "pa", "diff", "ppg", "papg", "sos", "powerScore", "power", "divisionRank",
            "pythag", "expWins", "luck", "marginSd", "homeEdge", "adjMargin", "home", "away", "oneScore", "streak", "last5")
    progression: dict[str, list[dict]] = {}
    for y, sc in seasons.items():
        for row in sc["table"]:
            progression.setdefault(row["team"], []).append({"season": y, **{k: row[k] for k in KEEP if k in row}})
    for rows in progression.values():
        for prev, cur in zip(rows, rows[1:]):
            cur["change"] = {"power": prev["power"] - cur["power"], "diff": cur["diff"] - prev["diff"],
                             "wins": cur["w"] - prev["w"], "since": prev["season"]}
    return {
        "_about": "Generated by scripts/schedule_content.py from data/y80/schedules.json (schedule.set). Rules only; "
                  "never hand-edit.",
        "progression": dict(sorted(progression.items())),
        "seasons": seasons,
        "headToHead": dict(sorted(h2h.items(), key=lambda kv: (-kv[1]["games"], kv[0]))),
        "records": records,
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    n = sum(len(s["games"]) for s in data["seasons"].values())
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(data['seasons'])} seasons, {n} games, "
          f"{len(data['headToHead'])} head-to-head opponents, {len(data['records'])} game records")


if __name__ == "__main__":
    main()
