#!/usr/bin/env python3
"""Build public/data/initial-data.csv (the app's bundled league) from data/y80/.

Sources, in order of precedence:
  1. data/y80/players.json            stats merged from save screenshots (source of truth)
  2. data/y80/spreadsheet_parsed.json the league sheet (True Talent, status)

True Talent is recomputed from stats with the sheet's own per-position formulas
(reverse-engineered, exact on every sheet row) so screenshot corrections flow through.
QBs whose screenshots lack attempts/INT/sacks get those inputs estimated (flagged in output). Dominance, Career Legacy and TPG are left blank
so the app derives them (see src/config/stats.ts).

Usage: python3 scripts/build_league_data.py
"""
import csv
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = ROOT / "public" / "data" / "initial-data.csv"
LEGENDS_OUT = ROOT / "public" / "data" / "legends.json"
# Extra real-NFL legends for the games (optional; same schema as players.json)
EXTRA_LEGENDS = ROOT / "data" / "legends" / "real_nfl_legends.json"
# Freely licensed Commons photos found by scripts/fetch_legend_photos.py (optional)
LEGEND_PHOTOS = ROOT / "data" / "legends" / "photos.json"

GAME_EXCLUSIONS_OUT = ROOT / "public" / "data" / "game-exclusions.json"
PLAYER_EXTRAS_OUT = ROOT / "public" / "data" / "player-extras.json"

# CUR = the user's current club (confirmed by the user: Jets).
CURRENT_CLUB = "Jets"
# Per-player team overrides (user-confirmed or from player cards). Takes precedence over CUR.
TEAM_FIXES: dict[str, str] = {
    "Jason Macleone": "Seahawks",  # user: now on the Seahawks; previously the Vikings
    "Malakai Sawyer": "Jets",      # user: one Titans season (Y72 title), then the Jets (Y77 title); traded to the Falcons for Y80
    "Levante Hopkins": "Titans",   # user: played for the Titans during the Y70–72 three-peat
}
# Franchises a player is confirmed to have played for, beyond his final team (user-confirmed).
# Card fields former_team / legacy_team are added automatically.
TEAM_HISTORY: dict[str, list[str]] = {
    "Sherman Brandson": ["Giants"],  # user: a Giants legend (final team on the sheet: Buccaneers)
    "Hamsfa Boltt": ["Titans"],
    "Michael Wilson": ["Ravens"],    # user: Ravens first, then the Giants
    "Obinna Leary": ["Jets"],        # user: traded to the Seahawks for Alvin Tufele
    "Alvin Tufele": ["Seahawks"],    # user: traded to the Jets for Obinna Leary
    "Jakeem Friend": ["Seahawks"],   # user: mainly a Seahawk; Jets only the last 2 years      # user: Titans QB for their last title season, now with the Commanders
}

# Team each in-game Hall of Famer retired with (the game's Player HOF screen, Y80). Often not where he spent
# most of his career, so it is recorded on the card ("retired_team") and in his franchise list, not as his team.
RETIRED_WITH: dict[str, str] = {
    "Nick Bolton": "Vikings", "Lamar Jackson": "Packers", "Ja’Marr Chase": "Vikings", "CeeDee Lamb": "Dolphins",
    "Jayden Daniels": "Commanders", "Jahmyr Gibbs": "Dolphins", "Mason Taylor": "Dolphins", "Akiem Bouye": "Chargers",
    "Ian Finney": "Buccaneers", "Brennan Higgins": "Commanders", "Ray Waller": "Buccaneers", "Alohi Godwin": "Seahawks",
    "Charlie John": "Bills", "Lukas Russell": "Seahawks", "Dennis Baylon": "Chargers", "Cairo Asanjh": "Ravens",
    "Bilal Tolbert": "Chargers", "Wayne Wilson": "Bills", "Rondale Ikarras": "Jets", "Sherman Brandson": "Vikings",
    "Dedrick Gould": "Ravens", "Denzel Hayes": "Bears", "Jackson Wardell Kline": "Dolphins", "Robert Boone": "Vikings",
    "God Johnson": "Vikings", "Levante Hopkins": "Titans", "Michael Wilson": "Titans", "Jason Macleone": "Seahawks",
    "Pharoah Hunter": "Seahawks", "Malakai Sawyer": "Falcons", "Chance Woodrum": "Jets",
}

# Extra player-card notes supplied by the user (merged into player-extras.json "cards").
CARD_NOTES: dict[str, dict] = {
    "Malakai Sawyer": {
        "team": "Falcons",
                "former_team": "Titans",
        "note": "Won Super Bowl CXXXI (Y72) in his one season with the Titans, then joined the Jets and won again in Y77 (CXXXVI); traded to the Falcons for Y80, where he retired",
    },
    "Rondale Ikarras": {
        "legacy_team": "Ravens",
        "note": "Ravens legend: five of his nine rings came in Baltimore (Y41–47) after three straight titles in Seattle (Y36–38); spent his final season with the Jets",
    },
    "Levante Hopkins": {
        "note": "Tight end for the Titans' Y70–72 three-peat",
    },
    "Michael Wilson": {
        "former_team": "Ravens",
        "note": "Ravens first, then the Giants; retired as a Titan",
    },
    "Jakeem Friend": {
        "legacy_team": "Seahawks",
        "note": "A Seahawks lineman for most of his career; a Jet for only the last two seasons (Y79–80)",
    },
    "Hamsfa Boltt": {
        "former_team": "Titans",
        "note": "Quarterbacked the Titans to their most recent title, Super Bowl CXXXIII (Y74), and was named SB MVP; now with the Commanders",
    },
    "Jason Macleone": {
        "former_team": "Vikings",
        "note": "\"Scary Jerry\", named for his imposing stature and scary looks. Started at QB for the Vikings in their Y78 Super Bowl CXXXVII win (33–27 over the Broncos)",
    },
}
# Status for players with no sheet row (the sheet's status column is otherwise used).
STATUS_FIXES = {"Michael Wilson": "Retired", "CeeDee Lamb": "Retired"}


def g(p, k):
    return p.get(k) or 0


def tt_rb(p):
    return 0.027 * (g(p, "ryds") + g(p, "recyds")) + 1.35 * (g(p, "rtd") + g(p, "rectd") - g(p, "fum")) + 0.18 * g(p, "g")


def tt_wr(p):
    return 0.25 * g(p, "rec") + 0.015 * g(p, "yds") + g(p, "td") - 1.5 * g(p, "fum") + 0.05 * g(p, "lng") + 0.125 * g(p, "g")


def tt_te(p):
    ypr = g(p, "yds") / g(p, "rec") if g(p, "rec") else 0
    return 0.056 * g(p, "yds") + 1.47 * g(p, "td") - 3.5 * g(p, "fum") + 0.07 * g(p, "lng") + 0.035 * g(p, "g") + 28 * ypr


def tt_ol(p):
    return 2.85 * g(p, "blk") + 0.285 * g(p, "g")


def tt_lb(p):
    return 0.4 * g(p, "tkl") + 10 * (g(p, "int") + g(p, "sck") + g(p, "ff")) + 0.0049 * g(p, "g")


def tt_db(p):
    return 0.1512 * g(p, "tkl") + 12.6 * g(p, "int") + 2.5241 * g(p, "sck") + 3.78 * g(p, "ff") + 0.0126 * g(p, "g")


def tt_dl(p):
    return 0.55 * g(p, "tkl") + 5.5 * g(p, "sck") + 2.75 * g(p, "ff") + 0.11 * g(p, "g")


TT_FORMULAS = {"RB": tt_rb, "WR": tt_wr, "TE": tt_te, "OL": tt_ol, "LB": tt_lb, "DB": tt_db, "DL": tt_dl}


# Volume stat used to measure how much a career grew between the sheet and a newer screenshot.
PRIMARY_STAT = {"QB": "yds", "RB": "ryds", "WR": "yds", "TE": "yds", "OL": "blk", "LB": "tkl", "DB": "tkl", "DL": "tkl"}
# Copied as-is rather than scaled: identity, awards, rates and single-play maxima.
COPY_AS_IS = {"n", "pos", "team", "nick", "lng", "pct", "rings", "mvp", "opoy", "dpoy", "sbmvp", "roty"}
SHEET_ONLY = {"tt", "legacy", "st"}


def fill_from_sheet(shot, sheet_row):
    """Returns (merged player, names of fields scaled from an older sheet snapshot)."""
    if not sheet_row:
        return dict(shot), []
    primary = PRIMARY_STAT[shot["pos"]]
    ratio = 1.0
    if shot.get(primary) and sheet_row.get(primary):
        ratio = shot[primary] / sheet_row[primary]
    elif shot.get("g") and sheet_row.get("g"):
        ratio = shot["g"] / sheet_row["g"]
    merged, scaled = dict(shot), []
    for k, v in sheet_row.items():
        if k in SHEET_ONLY or k in shot or v is None:
            continue
        if k in COPY_AS_IS or k == "g" or abs(ratio - 1) < 0.02:
            merged[k] = v
        else:
            merged[k] = round(v * ratio, 1) if isinstance(v, float) and v % 1 else round(v * ratio)
            scaled.append(k)
    return merged, scaled


def tt_qb(p):
    """Exact sheet formula (max error 0.004 on every sheet QB, legends included)."""
    att, ints = g(p, "att"), g(p, "int")
    return (0.0016 * g(p, "yds") + 0.4 * g(p, "td") - 0.25 * ints - 0.12 * g(p, "sck")
            + 0.006 * g(p, "ryds") + 1.5 * g(p, "rtd")
            + (40 * g(p, "yds") / att + 45 * g(p, "cmp") / att if att else 0)
            + (20 * g(p, "td") / ints if ints else 0))


# League medians for QBs whose screenshots lack attempts / interceptions / sacks.
QB_MEDIANS = {"ypa": 6.16, "cmp_pct": 0.647, "td_per_int": 5.82, "sck_per_g": 0.18}


def qb_true_talent(shot, sheet_row):
    """Returns (tt, note). Exact when the screenshot has every input; otherwise rates are
    carried forward from the player's older sheet row, or league medians, and flagged."""
    needed = ("att", "cmp", "int", "sck")
    if all(shot.get(k) is not None for k in needed):
        return tt_qb(shot), None
    p = dict(shot)
    old = sheet_row if sheet_row.get("att") else None
    yds, td, games = g(p, "yds"), g(p, "td"), g(p, "g")
    pct = p["pct"] / 100 if p.get("pct") else None
    if p.get("att") is None:
        p["att"] = yds / (old["yds"] / old["att"] if old else QB_MEDIANS["ypa"])
    if p.get("int") is None:
        p["int"] = old["int"] * td / old["td"] if old and old.get("td") else td / QB_MEDIANS["td_per_int"]
    if p.get("cmp") is None:
        p["cmp"] = p["att"] * (pct or (old["cmp"] / old["att"] if old else QB_MEDIANS["cmp_pct"]))
    if p.get("sck") is None:
        p["sck"] = (old["sck"] / old["g"] if old and old.get("g") else QB_MEDIANS["sck_per_g"]) * games
    return tt_qb(p), "rates from older sheet row" if old else "league-median rates"


APP_KEYS = {
    "QB": {"att": "attempts", "cmp": "completions", "yds": "passYds", "td": "passTD", "int": "interceptions",
           "sck": "sacks", "ratt": "rushAtt", "ryds": "rushYds", "rtd": "rushTD"},
    "RB": {"ratt": "rushAtt", "ryds": "rushYds", "rtd": "rushTD", "fum": "fumbles", "rec": "receptions",
           "recyds": "recYds", "rectd": "recTD"},
    "WR": {"rec": "receptions", "yds": "recYds", "td": "recTD", "fum": "fumbles", "lng": "longest"},
    "TE": {"rec": "receptions", "yds": "recYds", "td": "recTD", "fum": "fumbles", "lng": "longest"},
    "OL": {"blk": "blocks"},
    "LB": {"tkl": "tackles", "int": "interceptions", "sck": "sacks", "ff": "forcedFumbles"},
    "DB": {"tkl": "tackles", "int": "interceptions", "sck": "sacks", "ff": "forcedFumbles"},
    "DL": {"tkl": "tackles", "int": "interceptions", "sck": "sacks", "ff": "forcedFumbles"},
}


def to_app_player(p, teams):
    """Player-shaped object (src/types/player.ts) for the games. Unknown stats stay absent."""
    defense = p["pos"] in ("LB", "DB", "DL")
    out = {
        "name": p["n"], "position": p["pos"], "status": "Retired", "isRealLegend": True,
        "team": teams[p["team"]]["name"] if teams.get(p.get("team", ""), {}).get("conference") else "",
        "nickname": p.get("nick"), "era": p.get("era"), "tag": p.get("tag"),
        "games": g(p, "g"), "rings": g(p, "rings"), "mvp": g(p, "mvp"),
        "opoy": g(p, "dpoy") if defense else g(p, "opoy"), "sbmvp": g(p, "sbmvp"), "roty": g(p, "roty"),
        # Raw True Talent by the same per-position formulas as league players; the app applies the league's
        # position factors and derives Dominance / Career Legacy / TPG (see useGamePool)
        "trueTalent": round(qb_true_talent(p, {})[0] if p["pos"] == "QB" else TT_FORMULAS[p["pos"]](p), 2),
        "dominance": 0, "careerLegacy": 0, "tpg": 0,
        # Active real-NFL player: totals are approximate through the 2025 season
        "isCurrentNFL": bool(p.get("current")) or None,
    }
    for src, dst in APP_KEYS[p["pos"]].items():
        if p.get(src) is not None:
            out[dst] = p[src]
    return {k: v for k, v in out.items() if v is not None}


def load_stints() -> dict:
    """Reconstructed career stints (data/y80/stints.json, written by scripts/infer_stints.py)."""
    path = SRC / "stints.json"
    return json.loads(path.read_text()) if path.exists() else {}


def franchise_history(players, teams, cards, stints=None):
    """Full franchise names each league player played for: final team + card former/legacy teams + TEAM_HISTORY
    + every reconstructed stint team."""
    def full(key):
        key = (key or "").split(" (")[0].strip()
        t = teams.get(key)
        return t["name"] if t and t.get("conference") else None

    out = {}
    for p in players:
        if p.get("legend"):
            continue
        team_key = TEAM_FIXES.get(p["n"], p.get("team", ""))
        team_key = CURRENT_CLUB if team_key == "CUR" else team_key
        names = [full(team_key)]
        card = cards.get(p["n"], {})
        names += [full(card.get("former_team")), full(card.get("legacy_team")), full(card.get("retired_team"))]
        names += [full(t) for t in TEAM_HISTORY.get(p["n"], [])]
        names += [full(st["team"]) for st in (stints or {}).get(p["n"], {}).get("stints", [])]
        names = sorted({n for n in names if n})
        if len(names) > 1:
            out[p["n"]] = names
    return out


def write_player_extras():
    """Card extras from screenshot_extras.json. Single-season lines are intentionally dropped."""
    src = SRC / "screenshot_extras.json"
    if not src.exists():
        return
    extras = json.loads(src.read_text())
    cards = extras.get("player_cards", {})
    for name, notes in CARD_NOTES.items():
        cards[name] = {**cards.get(name, {}), **notes}
    for name, team in RETIRED_WITH.items():
        cards[name] = {**cards.get(name, {}), "retired_team": team, "hof_ingame": True}
    out = {"realNflCareer": {}, "cards": cards,
           "formerNames": {new: old for old, new in extras.get("name_changes", {}).items()},
           "family": extras.get("family", {})}
    for label, stats in extras.get("real_nfl_splits", {}).items():
        name, _, years = label.rpartition(" ")
        if not name or not stats.get("games"):
            continue  # e.g. "Mason Taylor 2025": 0 games, nothing to show
        out["realNflCareer"][name.replace("’", "'")] = {"years": years, **stats}
    stints = load_stints()
    out["franchises"] = franchise_history(json.loads((SRC / "players.json").read_text()),
                                          json.loads((SRC / "teams.json").read_text()), cards, stints)
    out["stints"] = stints
    PLAYER_EXTRAS_OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"wrote {PLAYER_EXTRAS_OUT.relative_to(ROOT)}: real-NFL splits for {len(out['realNflCareer'])} players")


def main():
    players = json.loads((SRC / "players.json").read_text())
    sheet = json.loads((SRC / "spreadsheet_parsed.json").read_text())
    teams = json.loads((SRC / "teams.json").read_text())
    by_key = {(p["n"], p["pos"]): p for p in sheet}

    # Verify the formulas still reproduce the sheet before trusting them.
    for p in sheet:
        f = tt_qb if p["pos"] == "QB" else TT_FORMULAS.get(p["pos"])
        if f and p.get("tt") and abs(f(p) - p["tt"]) > 0.05:
            print(f"warn: {p['n']} ({p['pos']}) sheet TT {p['tt']} vs formula {f(p):.2f}")

    estimated = []
    estimated_fields = []
    out = {pos: [] for pos in ("QB", "RB", "WR", "TE", "OL", "LB", "DB", "DL")}
    legends = [p for p in players if p.get("legend")]
    for p in players:
        if p.get("legend"):
            continue  # real-NFL legends live in the games only
        sheet_row = by_key.get((p["n"], p["pos"]), {})
        shot = {k: v for k, v in p.items() if v is not None}
        # Screenshots win; the sheet fills stats the screenshots didn't capture. When the screenshot
        # is a newer career snapshot, the sheet's counting stats are scaled up to it (and flagged).
        p, scaled = fill_from_sheet(shot, sheet_row)
        if scaled:
            estimated_fields.append(f"{p['n']} ({', '.join(scaled)})")
        if p["pos"] == "QB":
            tt, note = qb_true_talent(shot, sheet_row)
            if note:
                estimated.append(f"{p['n']} ({note})")
        else:
            tt = TT_FORMULAS[p["pos"]](p)

        team_key = TEAM_FIXES.get(p["n"], p.get("team", ""))
        if team_key == "CUR":
            team_key = CURRENT_CLUB
        # Only real franchises count; teams.json's UNK/CUR placeholders have no conference.
        team = teams[team_key]["name"] if teams.get(team_key, {}).get("conference") else ""
        # In the game's Hall of Fame = retired (internal only; the UI never shows status)
        status = STATUS_FIXES.get(p["n"]) or ("Retired" if p["n"] in RETIRED_WITH else None) or sheet_row.get("st") or ("Active" if p.get("team") == "CUR" else "Active")
        out[p["pos"]].append({**p, "_tt": round(tt, 2), "_team": team, "_status": status})

    award = lambda p: g(p, "dpoy") if p["pos"] in ("LB", "DB", "DL") else g(p, "opoy")
    sections = {
        "QB": (["Att", "Cmp", "Pass Yds", "Pass TD", "INT", "Sacks", "Att", "Rush Yds", "Rush TD"],
               ["att", "cmp", "yds", "td", "int", "sck", "ratt", "ryds", "rtd"], "OPOY"),
        "RB": (["Rush Att", "Rush Yds", "Rush TD", "Fum", "Rec", "Rec Yds", "Rec TD"],
               ["ratt", "ryds", "rtd", "fum", "rec", "recyds", "rectd"], "OPOY"),
        "WR": (["Rec", "Rec Yds", "TDs", "Fumbles", "Longest"], ["rec", "yds", "td", "fum", "lng"], "OPOY"),
        "TE": (["Rec", "Rec Yds", "TDs", "Fumbles", "Longest"], ["rec", "yds", "td", "fum", "lng"], "OPOY"),
        "OL": (["Blocks"], ["blk"], "OPOY"),
        "LB": (["Tackles", "INT", "Sacks", "FF"], ["tkl", "int", "sck", "ff"], "DPOY"),
        "DB": (["Tackles", "INT", "Sacks", "FF"], ["tkl", "int", "sck", "ff"], "DPOY"),
        "DL": (["Tackles", "INT", "Sacks", "FF"], ["tkl", "int", "sck", "ff"], "DPOY"),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["Retro Bowl League Analysis — Y80 (generated by scripts/build_league_data.py)"])
        w.writerow([])
        for pos, (labels, keys, award_label) in sections.items():
            w.writerow([pos])
            w.writerow(["Name", "Status", "Team", "Games", *labels, "Rings", "MVP", award_label, "SBMVP", "ROTY",
                        "True Talent", "Dominance", "Career Legacy", "TPG", "Nicknames"])
            for p in sorted(out[pos], key=lambda r: -r["_tt"]):
                stats = ["" if p.get(k) is None else p[k] for k in keys]
                w.writerow([p["n"], p["_status"], p["_team"], g(p, "g"), *stats, g(p, "rings"), g(p, "mvp"), award(p),
                            g(p, "sbmvp"), g(p, "roty"), p["_tt"], "", "", "", p.get("nick", "")])
            w.writerow([])

    if EXTRA_LEGENDS.exists():
        by_key = {(p["n"], p["pos"]): p for p in legends}
        for extra in json.loads(EXTRA_LEGENDS.read_text()):
            have = by_key.get((extra["n"], extra["pos"]))
            if have is None:
                legends.append(extra)
            else:
                # Same legend in both files: keep the save's values, fill any stat the save didn't record
                # (attempts, completions, tackles…) so rate stats and real-life comps work.
                for k, v in extra.items():
                    if have.get(k) is None and v is not None:
                        have[k] = v
    photos = json.loads(LEGEND_PHOTOS.read_text()) if LEGEND_PHOTOS.exists() else {}
    legend_rows = []
    for p in legends:
        row = to_app_player(p, teams)
        ph = photos.get(p["n"], {})
        if ph.get("url"):
            row["photo"] = {"url": ph["url"], "page": ph.get("page"), "author": ph.get("author"), "license": ph.get("license")}
        legend_rows.append(row)
    LEGENDS_OUT.write_text(json.dumps(legend_rows, indent=1, ensure_ascii=False))
    print(f"wrote {LEGENDS_OUT.relative_to(ROOT)}: {len(legends)} legends (games only)")

    # League players kept for stats but left out of the games (in_games: 0, short careers)
    excluded = [f"{p['pos']}:{p['n']}" for p in players if p.get("in_games") == 0 and not p.get("legend")]
    GAME_EXCLUSIONS_OUT.write_text(json.dumps({"excludeFromGames": excluded}, indent=1, ensure_ascii=False))
    print(f"wrote {GAME_EXCLUSIONS_OUT.relative_to(ROOT)}: {len(excluded)} league players out of the games")

    write_player_extras()

    total = sum(len(v) for v in out.values())
    print(f"wrote {OUT.relative_to(ROOT)}: {total} players")
    print("Stats scaled from an older sheet row (estimates):", "; ".join(estimated_fields) or "none")
    print("QB True Talent with estimated inputs:", ", ".join(estimated) or "none")
    unassigned = [p["n"] for v in out.values() for p in v if not p["_team"]]
    print("no team:", ", ".join(unassigned) or "none")


if __name__ == "__main__":
    main()
