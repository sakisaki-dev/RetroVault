#!/usr/bin/env python3
"""Reconstruct each league player's career stints (team + approximate seasons) for the save.

Writes data/y80/stints.json. Usage: python3 scripts/infer_stints.py [--explain NAME] [--list]

How it works
------------
No per-season data exists, so stints are inferred by ring arithmetic:

* A player's franchises come from his club of record, the owner's team history, card former/legacy/current team and
  the in-game Hall of Fame team he retired with (always his LAST stop), all from data/y80/owner_facts.json.
* Seasons ~ games / 17-21 (17 regular-season games, plus playoffs: the owner's clubs play ~20 a season).
* Stints are contiguous and ordered, and the Super Bowls his teams won while he was there must equal his rings.
* Hard anchors pin a team to a season. They come only from data:
    - the in-game record board (data/y80/records.json) counts games for the owner's club only, so a record set in
      year Y means the holder was on the owner's club that season;
    - owner_facts.json: career.on / career.stints (owner-confirmed seasons) and season_rosters.
* career.order (the owner's order of clubs) fixes the sequence; career.next_team adds the club he was traded to
  after the last season.
* Soft scoring prefers the games-per-season fit and windows inside the player's era hint.

Every stint's `evidence` is generated from templates over these facts ("4 rings = Chargers Y10, Y11, Y14, Y15").
Confidence: confirmed (every stint pinned by an owner, roster or record-board anchor), strong (one ring-year
solution), likely (teams agree, years vary), ambiguous (different team/year solutions, or rings no known franchise
explains). Ambiguous players become the open questions in content.json.
"""
from __future__ import annotations

import itertools
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "y80"
OUT = SRC / "stints.json"
sys.path.insert(0, str(ROOT / "scripts"))
import owner_facts as F  # noqa: E402

# ---------------------------------------------------------------------------
# League facts
# ---------------------------------------------------------------------------
SB = {int(s["year"][1:]): s for s in json.loads((SRC / "super_bowls.json").read_text())}
COACH = {s["year"]: s for s in json.loads((SRC / "coach.json").read_text())["seasons"]}
LAST = max(COACH)
WIN = {y: s["winner"] for y, s in SB.items()}
LOSE = {y: s["loser"] for y, s in SB.items()}
OWNER = {y: s["team"] for y, s in COACH.items()}
PLAYOFF = {"Champions": 3.6, "AFC Champs": 3.0, "NFC Champs": 3.0, "Champ Rnd": 2.4, "Divisional": 1.5, "Wild Card": 1.0}


def season_games(team: str, y: int) -> float:
    """Expected games (regular + playoff) for a full season on this team."""
    if OWNER.get(y) == team:
        return 17 + PLAYOFF.get(COACH[y]["finish"], 0.0)
    if WIN.get(y) == team:
        return 20.6
    if LOSE.get(y) == team:
        return 20.0
    return 17.6


def titles(team: str, a: int, b: int) -> list[int]:
    return [y for y in range(a, b + 1) if WIN.get(y) == team]


def plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


# ---------------------------------------------------------------------------
# Record board anchors (data/y80/records.json)
# ---------------------------------------------------------------------------
def record_anchors(players: list[dict], name_changes: dict[str, str]) -> dict[str, list[tuple[str, int, str]]]:
    """{player: [(owner's team, year, record label)]}. Holders read "QB S. Brandson → WR D. Haley"; each named league
    player was on the owner's club that year. Former names ("M. Earl III (now God Johnson)") map to the new name."""
    names = [(p["pos"], p["n"]) for p in players]
    names += [(pos, old) for old, new in name_changes.items() for pos, n in names if n == new]
    renamed = dict(name_changes)
    out: dict[str, list[tuple[str, int, str]]] = {}
    for rec in json.loads((SRC / "records.json").read_text())["records"]:
        year = int(rec["year"].lstrip("Y"))
        if year not in OWNER:
            continue
        for part in rec["holder"].split("→"):
            part = re.sub(r"\(.*?\)", "", part).strip()
            m = re.match(r"([A-Z]{1,2})\s+([A-Z])\.\s+(.+)$", part)
            if not m:
                continue
            pos, initial, surname = m.groups()
            hits = sorted({renamed.get(n, n) for ps, n in names
                           if ps == pos and n.startswith(initial) and n.split(" ", 1)[-1] == surname.strip()})
            if len(hits) == 1:
                out.setdefault(hits[0], []).append((OWNER[year], year, rec["record"]))
    return out


# ---------------------------------------------------------------------------
# Solver
# ---------------------------------------------------------------------------
def parse_era(era: str | None):
    if not era:
        return None
    m = re.search(r"Y(\d+)\s*[–-]\s*Y?(\d+)", era)
    if not m:
        m1 = re.search(r"Y(\d+)", era)
        return (int(m1.group(1)), int(m1.group(1))) if m1 else None
    return int(m.group(1)), int(m.group(2))


def short(team_name_or_key: str | None, teams: dict) -> str | None:
    if not team_name_or_key:
        return None
    key = team_name_or_key.split(" (")[0].strip()
    if key in teams and teams[key].get("conference"):
        return key
    for k, t in sorted(teams.items()):
        if t.get("name") == key:
            return k
    return None


def franchise_facts(p, teams, cards, career):
    name = p["n"]
    main = F.TEAM_FIXES.get(name, p.get("team", ""))
    main = F.CURRENT_CLUB if main == "CUR" else main
    main = short(main, teams)
    card = cards.get(name, {})
    retired = short(F.RETIRED_WITH.get(name), teams)
    current = short(card.get("team"), teams) if name in F.CARD_NOTES else None
    former = short(card.get("former_team"), teams)
    legacy = short(card.get("legacy_team"), teams)
    hist = [short(t, teams) for t in F.TEAM_HISTORY.get(name, [])]
    order = [short(t, teams) for t in career.get("order", [])]
    known = {t for t in [main, retired, current, former, legacy, *hist, *order] if t}
    nxt = short(career.get("next_team"), teams)
    if nxt:
        # traded after the last season: that club is appended outside the solver
        order = order[:-1] if order and order[-1] == nxt else order
        known.discard(nxt) if nxt not in order else None
        main = order[-1] if order else (None if main == nxt else main)
        current = None if current == nxt else current
    return {"main": main, "retired": retired, "current": current, "former": former, "legacy": legacy,
            "known": known, "order": [t for t in order if t], "next": nxt}


def candidate_seqs(f, anchors) -> list[list[str]]:
    """Team orders to try. The chain is the owner's order of clubs, else the anchors in time order (a club may
    repeat: Seahawks → Vikings → Seahawks). The other known clubs are inserted anywhere, once each. The game-HOF /
    current club is last; otherwise the club of record is (the sheet records his final club); a card's former team
    precedes the club of record."""
    chain = list(f["order"])
    if not chain:
        for t, _y in sorted(anchors, key=lambda a: a[1]):
            if not chain or chain[-1] != t:
                chain.append(t)
    known = set(f["known"]) | {t for t, _ in anchors}
    if not chain and not known:
        return []
    last = f["retired"] or f["current"] or (f["order"][-1] if f["order"] else f["main"])
    if chain and last and chain[-1] != last and (f["retired"] or f["current"] or not f["order"]):
        chain.append(last)  # the anchors end elsewhere: he went back to (or on to) his final club
    extra = sorted(known - set(chain))
    out, seen = [], set()
    for perm in itertools.permutations(extra):
        # insert perm's teams into chain at every position combination, keeping chain order
        n = len(chain) + len(perm)
        for slots in itertools.combinations(range(n), len(perm)):
            seq, ci, pi = [], 0, 0
            for i in range(n):
                if i in slots:
                    seq.append(perm[pi])
                    pi += 1
                else:
                    seq.append(chain[ci])
                    ci += 1
            if any(a == b for a, b in zip(seq, seq[1:])):
                continue
            if last and seq[-1] != last:
                continue
            if f["former"] and f["main"] and f["former"] != f["main"] and f["former"] in seq and f["main"] in seq:
                if seq.index(f["former"]) > len(seq) - 1 - seq[::-1].index(f["main"]):
                    continue
            if tuple(seq) not in seen:
                seen.add(tuple(seq))
                out.append(seq)
    return out


def solve(target, era, seqs):
    """All stint layouts for these team orders that hit his ring count and the hard constraints, scored."""
    g, rings = target["games"], target["rings"]
    anchors = target.get("anchors", [])
    exact = target.get("exact", [])
    longest = target.get("longest")
    smin, smax = target.get("start", (1, LAST))
    emin, emax = target.get("end", (1, LAST))
    nmin_h, nmax_h = 1, 30
    if g:
        nmin_h = max(nmin_h, int(g / 22))
        nmax_h = min(nmax_h, int(g / 12) + 2)
    sols = []

    def finish(seq, stints):
        s, e = stints[0][1], stints[-1][2]
        if not (smin <= s <= smax and emin <= e <= emax):
            return
        n = e - s + 1
        if not (nmin_h <= n <= nmax_h):
            return
        for t, y in anchors:
            if not any(st[0] == t and st[1] <= y <= st[2] for st in stints):
                return
        for t, a, b in exact:
            if (t, a, b) not in stints:
                return
        if longest:
            span: dict[str, int] = {}
            for t, a, b in stints:
                span[t] = span.get(t, 0) + b - a + 1
            if span.get(longest, 0) < max(span.values()):
                return
        pred = sum(season_games(t, y) for t, a, b in stints for y in range(a, b + 1))
        score = 0.0
        if g:
            # can't play more games than the schedule allows; fewer (injuries, rest) is cheaper
            score += max(0.0, g - pred) / 8 + max(0.0, pred - 1.12 * g) / 17
        if era:
            a, b = era
            out = sum(1 for y in range(s, e + 1) if y < a - 1 or y > b + 1)
            score += 0.3 * out + (1.5 if e < a or s > b else 0)
        sols.append((round(score, 3), tuple(seq), tuple(stints)))

    anchor_team = {}
    for t, y in anchors:
        anchor_team.setdefault(y, set()).add(t)
    last_anchor = max((y for _, y in anchors), default=0)

    def rec(seq, i, y, acc, got, s0):
        t = seq[i]
        for L in range(1, 31):
            b = y + L - 1
            if b > min(LAST, emax) or b - s0 + 1 > nmax_h:
                break
            if t not in anchor_team.get(b, {t}):
                break  # an anchor puts him elsewhere that season: this stint can't reach it
            r = got + len(titles(t, y, b))
            if r > rings:
                break
            if i == len(seq) - 1:
                if r == rings and b >= last_anchor:
                    finish(seq, acc + [(t, y, b)])
            else:
                rec(seq, i + 1, b + 1, acc + [(t, y, b)], r, s0)

    first_anchor = min((y for _, y in anchors), default=LAST)
    for seq in seqs:
        for s in range(max(1, smin, emin - nmax_h + 1, last_anchor - nmax_h + 1), min(LAST, smax, first_anchor) + 1):
            if seq[0] in anchor_team.get(s, {seq[0]}):
                rec(seq, 0, s, [], 0, s)
    sols.sort(key=lambda x: (x[0], x[1], x[2]))
    return sols


def owner_rings(stints) -> bool:
    """True when every ring in these stints was won by the owner's club."""
    return all(OWNER.get(y) == t for t, a, b in stints for y in titles(t, a, b))


def ring_sig(stints):
    return tuple((t, tuple(titles(t, a, b))) for t, a, b in stints)


def classify(sols):
    if not sols:
        return "ambiguous", []
    best = sols[0][0]
    top = [s for s in sols if s[0] <= best + 0.75]
    seqs = {s[1] for s in top}
    sigs = {ring_sig(s[2]) for s in top}
    starts = [s[2][0][1] for s in top]
    if len(seqs) > 1:
        return "ambiguous", top
    if len(sigs) == 1:
        return ("strong" if max(starts) - min(starts) <= 4 else "likely"), top
    return "likely", top


def pick_solution(top):
    """Best score; among ties, the median start (keeps undated careers centred, not pushed to an edge)."""
    best = top[0][0]
    tied = [s for s in top if s[0] <= best + 0.05]
    tied.sort(key=lambda s: (s[2][0][1], s[1], s[2]))
    return tied[len(tied) // 2]


def to_json_stints(stints):
    return [{"team": t, "from": a, "to": b, "rings": titles(t, a, b)} for t, a, b in stints]


def describe(stints):
    return ", ".join(f"{t} Y{a}" + (f"-{b}" if b != a else "") for t, a, b in stints)


def year_list(ys: list[int]) -> str:
    return ", ".join(f"Y{y}" for y in ys)


# ---------------------------------------------------------------------------
# Evidence text (templates over the facts used)
# ---------------------------------------------------------------------------
def evidence(name, target, chosen, conf, top, f, extra, dated, rec_anchors, career, roster_years, real):
    parts = []
    won = [(t, y) for t, a, b in chosen for y in titles(t, a, b)]
    if target["rings"]:
        by_team: dict[str, list[int]] = {}
        for t, y in won:
            by_team.setdefault(t, []).append(y)
        rings = "; ".join(f"{t} {year_list(ys)}" for t, ys in by_team.items())
        parts.append(f"{plural(target['rings'], 'ring')} = {rings}.")
    else:
        parts.append("No rings.")
    if rec_anchors:
        marks = "; ".join(f"Y{y} {label.lower()} ({t})" for t, y, label in sorted(rec_anchors, key=lambda a: (a[1], a[2])))
        parts.append(f"Record board (your club's games only): {marks}.")
    for y, t in roster_years:
        parts.append(f"On the Y{y} {t} roster.")
    if career.get("says"):
        parts.append(f"Owner: “{career['says'].rstrip('.')}.”")
    if extra:
        parts.append(f"His known clubs ({', '.join(sorted(f['known']))}) can't account for every ring, so the best fit "
                     f"adds a stop: {describe(chosen)}.")
    elif conf == "ambiguous":
        alts = sorted({" > ".join(s[1]) for s in top})
        if len(alts) > 1:
            parts.append(f"Different orders fit: {' | '.join(alts[:3])}.")
        else:
            parts.append("Different ring years fit; exact seasons are approximate.")
    elif conf == "strong" and target["rings"]:
        parts.append("The only window that fits.")
    elif conf == "likely":
        parts.append("Exact seasons are approximate.")
    if not dated:
        parts.append(f"No rings, record or owner date places him; the {target['games']}-game window is a placeholder "
                     "in seasons his club won nothing.")
    if f["next"]:
        parts.append(f"Traded to the {f['next']} after Y{LAST}.")
    if real:
        parts.append(f"Imported real-NFL player: in the league from Y1, ~{target['games']} save games after his "
                     f"{real['games']} real ones.")
    return " ".join(parts)


def main():
    players = [p for p in json.loads((SRC / "players.json").read_text()) if not p.get("legend")]
    teams = json.loads((SRC / "teams.json").read_text())
    sheet = {r["n"]: r for r in json.loads((SRC / "spreadsheet_parsed.json").read_text())}
    extras_src = json.loads((SRC / "screenshot_extras.json").read_text())
    cards = {k: dict(v) for k, v in extras_src.get("player_cards", {}).items()}
    for n, notes in F.CARD_NOTES.items():
        cards[n] = {**cards.get(n, {}), **notes}
    records = record_anchors(players, extras_src.get("name_changes", {}))

    explain = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--explain" else None
    winners = sorted({w for w in WIN.values() if w and w != "None"})
    out, report = {}, []
    import time
    for p in players:
        t0 = time.time()
        name = p["n"]
        if explain and explain.lower() not in name.lower():
            continue
        career = F.CAREER.get(name, {})
        f = franchise_facts(p, teams, cards, career)
        era = parse_era(p.get("era"))
        status = F.STATUS_FIXES.get(name) or ("Retired" if name in F.RETIRED_WITH else None) or sheet.get(name, {}).get("st") or "Active"
        real = F.REAL_NFL.get(name)
        target = {"games": (p.get("g") or 0) - (real["games"] if real else 0),
                  "rings": (p.get("rings") or 0) - (real["rings"] if real else 0)}
        rec_anchors = records.get(name, [])
        owner_on = [(short(t, teams), int(y)) for t, y in career.get("on", [])]
        exact = [(short(t, teams), int(a), int(b)) for t, a, b in career.get("stints", [])]
        roster_years = [(y, r[name]) for y, r in F.SEASON_ROSTERS.items() if name in r]
        anchors = sorted({*[(t, y) for t, y, _ in rec_anchors], *owner_on, *[(short(t, teams), y) for y, t in roster_years],
                          *[(t, y) for t, a, b in exact for y in range(a, b + 1)]}, key=lambda a: (a[1], a[0]))
        target["anchors"] = anchors
        target["exact"] = exact
        if career.get("longest"):
            target["longest"] = short(career["longest"], teams)  # owner: "mainly a Seahawk"
        if real:
            target["start"] = (1, 1)
        if any(y == LAST for _, y in anchors) or (status == "Active" and name not in sheet):
            # on a roster in the last season, or added after the sheet and not retired in the game: still playing
            target["end"] = (LAST, LAST)
        seqs = candidate_seqs(f, anchors)
        sols = solve(target, era, seqs) if seqs else []
        conf, top = classify(sols)
        extra = False
        if not sols and seqs:
            # Rings no known franchise explains: try one extra stop with a title-winning club. Your clubs are the
            # usual source ("every ring went to your team"); an imported player's real club is the natural first stop.
            trial = []
            fixed_last = bool(f["retired"] or f["current"] or f["main"] or "end" in target)
            cands = winners + ([real["club"]] if real and real["club"] not in winners else [])
            for seq in seqs:
                for t in cands:
                    if t in seq:
                        continue
                    for i in range(len(seq) if fixed_last else len(seq) + 1):
                        trial.append(seq[:i] + [t] + seq[i:])
            sols = solve(target, era, trial)

            def penalty(sq, sts):
                # the added stop is the club not in the original order; prefer one whose rings were the owner's
                added = [st for st, s0 in zip(sts, sq) if s0 not in f["known"] | {t for t, _ in anchors}]
                bonus = -1.0 if real and sq[0] == real["club"] else 0
                return 1.0 + (0 if owner_rings(added) else 0.8) + bonus

            sols = sorted(((round(sc + penalty(sq, sts), 3), sq, sts) for sc, sq, sts in sols), key=lambda x: (x[0], x[1], x[2]))
            if sols:
                conf, top = "ambiguous", [s for s in sols if s[0] <= sols[0][0] + 0.75]
                extra = True
        if explain:
            print(name, f, target, era, len(sols), conf)
            for s in top[:30]:
                print("  ", s[0], s[2])
        if not top:
            print(f"warn: no placement for {name}")
            continue
        chosen = pick_solution(top)[2]
        dated = bool(target["rings"] or anchors or era or "end" in target or real)
        if not dated and conf == "strong":
            conf = "likely"
        owner_said = set(owner_on) | {(t, y) for t, a, b in exact for y in range(a, b + 1)}
        if owner_said and all(any(t == st and a <= y <= b for st, y in anchors) for t, a, b in chosen):
            conf = "confirmed"  # every stint pinned by an anchor, and the owner confirmed at least one
        why = evidence(name, target, chosen, conf, top, f, extra, dated, rec_anchors, career, roster_years, real)
        stints = to_json_stints(chosen)
        if f["next"]:
            stints.append({"team": f["next"], "from": LAST + 1, "to": LAST + 1, "rings": []})
        rec = {"stints": stints, "confidence": conf, "evidence": why}
        if real and real["rings"]:
            rec["preLeagueRings"] = real["rings"]  # real-NFL rings on his card, won before the save began
        if not dated:
            rec["approx"] = True  # years are a placeholder; only the team is known
        if conf == "ambiguous":
            alts, seen = [], {ring_sig(chosen)}
            for s in top:
                if ring_sig(s[2]) not in seen:
                    seen.add(ring_sig(s[2]))
                    alts.append(list(s[2]))
            if alts:
                rec["alternatives"] = [[{"team": t, "from": a, "to": b} for t, a, b in alt] for alt in alts[:3]]
        if "--time" in sys.argv and time.time() - t0 > 0.5:
            print(f"  {name}: {time.time() - t0:.1f}s, {len(seqs)} orders")
        out[name] = rec
        report.append((conf, name, rec))

    if explain:
        return
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    from collections import Counter
    c = Counter(r[0] for r in report)
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} players", dict(sorted(c.items())))
    if "--list" in sys.argv:
        for conf, name, rec in sorted(report, key=lambda r: (r[0], r[1])):
            st = " ; ".join(f"{x['team']} {x['from']}-{x['to']} {x['rings']}" for x in rec["stints"])
            print(f"{conf:9} {name:24} {st}{'  (approx)' if rec.get('approx') else ''}")


if __name__ == "__main__":
    main()
