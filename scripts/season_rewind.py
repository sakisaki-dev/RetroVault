"""Season Rewind: a tap-through recap of each completed season, built by rules (no AI, no new prose lane).

build_league_content.py calls build(B) with itself as B (its loaded data and helpers) and writes each season to
public/data/league/rewind/<Y>.json plus `seasonRewindIndex` in content.json. Every card's text is a template filled
from the data; the only written words it carries are the season's Season Story lead headline and dek and one Hot Take
headline, quoted as they are and linked to the full piece. Cards whose data is missing are skipped, never invented, so
older seasons (no market snapshots, no weekly scores) have fewer cards. Deterministic: no clocks, no randomness.

Cards, in story order (each is skipped when its data is missing):
  cover        "Y94 Rewind": the coach's club that season, its record and finish, his season count and titles so far
  champion     the Super Bowl: score, the champion's record, its title count, the ring holders (stints.json) for the
               team photo, the star = that season's Super Bowl MVP among them (market deltas), else the best Career Legacy
  awards       MVP, OPOY, DPOY and Super Bowl MVP: card players whose award count rose across the season's snapshot pair
               while they played (games rose), with the season line (career deltas)
  records      club record-board marks dated that season (records.json) and league season marks set in it
               (public/data/league/records.json), holders that are card players only
  milestones   the Gauntlet completed that season (ring, MVP, OPOY/DPOY, Rookie of the Year, Super Bowl MVP) and award
               counts and career totals passing a round step (the headline MILESTONES), played seasons only
  market       the biggest riser and faller in base-card value across the season (base value 50+, players who played)
  hof          the season's Hall of Fame class (public/data/league/halloffame.json)
  farewells    players whose final season it was (games last rose then, not active now) or retired by a status fact
               in the season's bundles; before the snapshots, retired players whose last dated stint ends that season
  power        the season's power No. 1 and the upset of the year (public/data/league/schedule.json)
  tribute      content.json tributePlan's pick for the season (linked when written)
  story        the Season Story lead (written; quoted, linked)
  take         the season's hottest Hot Take (written; quoted, linked)
  outro        "Next: Y95": the next season (live progress from save_state.json only while that season is in
               progress), the coach's Super Bowl record through the season, and the standing record chases (latest
               season only)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

MAX_ROWS = 4  # rows on a list card (records, milestones)
MAX_PHOTO = 11  # ring holders in the team photo
MAX_HOF = 6
MAX_FAREWELLS = 6
MARKET_MIN_VALUE = 50
AWARD_ORDER = [("mvp", "MVP", "Most Valuable Player"), ("opoy", "OPOY", "Offensive Player of the Year"),
               ("dpoy", "DPOY", "Defensive Player of the Year"), ("sbmvp", "SB MVP", "Super Bowl MVP")]


def build(B, tribute_plan: list[dict]) -> tuple[list[dict], list[dict]]:
    """(index for content.json, one rewind per season oldest first)."""
    teams_json = json.loads((B.SRC / "teams.json").read_text())
    clubs = {name for name, t in teams_json.items() if t.get("conference")}
    full_to_club = {t["name"]: name for name, t in teams_json.items() if t.get("conference")}

    def club(name: str | None) -> str | None:
        """A club name as one of the 32 ("Denver Broncos" -> "Broncos"), else None."""
        if not name:
            return None
        if name in clubs:
            return name
        return full_to_club.get(name)

    ends = B._season_ends()  # season -> its last snapshot's players
    first_snap = min(ends) if ends else None
    sb_wins: dict[str, list[int]] = {}
    for y in sorted(B.SB_BY_YEAR):
        w = B.SB_BY_YEAR[y].get("winner")
        if w:
            sb_wins.setdefault(w, []).append(y)
    by_season = B.season_bundles()
    plan = {p["season"]: p for p in tribute_plan}
    hof = json.loads((B.ROOT / "public" / "data" / "league" / "halloffame.json").read_text())
    hof_members = {m["key"]: m for m in hof.get("members", [])}
    league_records = json.loads((B.ROOT / "public" / "data" / "league" / "records.json").read_text()).get("records", [])
    takes = {s: v for s, v in B.TAKES.items()}
    key_of = {p["n"]: f'{p["pos"]}:{p["n"]}' for p in B.LEAGUE}

    def season_club(name: str, y: int) -> str | None:
        """The club he played for in season y: his stint covering it, else (the latest season) his club now, else his
        banner club."""
        for st in B.STINTS.get(name, {}).get("stints", []):
            if st["from"] <= y <= st["to"]:
                c = club(st["team"])
                if c:
                    return c
        p = B.BY_NAME.get(name)
        if p and y == B.LAST:
            c = club(B.team_of(p))
            if c:
                return c
        return club(B.BANNER.get(name)) or (club(B.team_of(p)) if p else None)

    def s(snap, k):
        return ((snap or {}).get(k) or {}).get("s") or {}

    def played(k: str, y: int) -> bool:
        a, b = ends.get(y - 1), ends.get(y)
        return bool(a and b and k in b and k in a and y - 1 != first_snap
                    and (s(b, k).get("g") or 0) > (s(a, k).get("g") or 0))

    def fig(label: str, num: float | int | None = None, value: str | None = None, pre: str = "", suf: str = "",
            dec: int = 0) -> dict:
        out = {"label": label}
        if num is not None:
            n = round(float(num), dec) if dec else int(round(num))
            shown = f"{abs(n):,.{dec}f}" if dec else f"{abs(n):,}"
            out.update({"value": f"{pre}{'-' if n < 0 and not pre else ''}{shown}{suf}", "num": abs(n)})
            if pre:
                out["pre"] = pre
            if suf:
                out["suf"] = suf
            if dec:
                out["dec"] = dec
        else:
            out["value"] = value or ""
        return out

    def person(name: str, y: int, **extra) -> dict | None:
        if name not in key_of:
            return None
        row = {"key": key_of[name], "name": name}
        c = season_club(name, y)
        if c:
            row["team"] = c
        row.update({k: v for k, v in extra.items() if v not in (None, "", [])})
        return row

    def season_line(k: str, y: int) -> tuple[str, list[dict]]:
        """His season from the career deltas: a short line and its figures."""
        pos = k.partition(":")[0]
        a, b = s(ends.get(y - 1), k), s(ends.get(y), k)
        d = {f: (b.get(f) or 0) - (a.get(f) or 0) for f in set(a) | set(b)}
        g = d.get("g", 0)
        if pos == "QB":
            parts = [(d.get("yds", 0), "pass yds"), (d.get("td", 0), "pass TD"), (d.get("rtd", 0), "rush TD")]
        elif pos == "RB":
            parts = [(d.get("ryds", 0), "rush yds"), (d.get("rtd", 0), "rush TD"), (d.get("rectd", 0), "rec TD")]
        elif pos in ("WR", "TE"):
            parts = [(d.get("rec", 0), "catches"), (d.get("yds", 0), "rec yds"), (d.get("td", 0), "TD")]
        elif pos == "OL":
            parts = [(d.get("blk", 0), "blocks")]
        else:
            parts = [(d.get("tkl", 0), "tackles"), (d.get("int", 0), "INT"), (d.get("sck", 0), "sacks")]
        parts = [(v, lab) for v, lab in parts if v > 0]
        line = " · ".join(f"{B.fmt(v)} {lab}" for v, lab in parts)
        if g:
            line = f"{line} in {B.plural(g, 'game')}" if line else B.plural(g, "game")
        return line, [fig(lab, v) for v, lab in parts[:3]]

    seasons = sorted(r["year"] for r in B.SEASONS)
    rewinds = []
    for y in seasons:
        Y = f"Y{y}"
        cards: list[dict] = []
        row = next(r for r in B.SEASONS if r["year"] == y)
        coach_club = club(row["team"])
        sb = B.SB_BY_YEAR.get(y) or {}
        rec = f'{row["w"]}-{row["l"]}' + (f'-{row["t"]}' if row.get("t") else "")
        nth = sum(1 for r in B.SEASONS if r["year"] <= y)
        titles = [r for r in B.SEASONS if r["year"] <= y and B.SB_BY_YEAR.get(r["year"], {}).get("your_result") == "won"]
        cur, prev = ends.get(y), ends.get(y - 1)
        bundle_muts = [m for _, ms in by_season.get(y, []) for m in ms]
        sched = B.SCHEDULE["seasons"].get(Y)

        # 1. cover
        cover = {"id": f"y{y}-cover", "kind": "cover", "club": coach_club, "kicker": "Season Rewind", "title": f"{Y} Rewind",
                 "text": f"Dorren Skura's {B.ordinal(nth)} season as a head coach, with the {row['team']}: {rec}, {row['finish']}.",
                 "figures": [fig("Record", value=rec), fig("Finish", value=row["finish"]), fig("Season as coach", nth)],
                 "teams": [coach_club] if coach_club else []}
        if sched:
            cr = sched["coachRecord"]
            cover["figures"].append(fig("Point differential", cr["diff"], pre="+" if cr["diff"] > 0 else ""))
        cards.append(cover)

        # 2. champion
        winner, loser = club(sb.get("winner")), club(sb.get("loser"))
        if winner and sb.get("score"):
            hi, _, lo = sb["score"].partition("-")
            nth_title = sb_wins.get(sb["winner"], []).index(y) + 1 if y in sb_wins.get(sb["winner"], []) else None
            holders = sorted((n for n in B.STINTS if n in key_of and any(club(st["team"]) == winner and y in st.get("rings", [])
                                                                          for st in B.STINTS[n].get("stints", []))),
                             key=lambda n: (-B.legacy(n), n))
            sbmvp = [n for n in holders if cur and prev and played(key_of[n], y)
                     and (s(cur, key_of[n]).get("sbmvp") or 0) > (s(prev, key_of[n]).get("sbmvp") or 0)]
            star = sbmvp[0] if sbmvp else (holders[0] if holders else None)
            photo = [star] + [n for n in holders if n != star][:MAX_PHOTO - 1] if star else []
            champ_rec = rec if winner == coach_club else None
            if not champ_rec and sched:
                champ_rec = next((t["record"] for t in sched["table"] if club(t["team"]) == winner), None)
            res = sb.get("your_result")
            text = f"The {sb['winner']} beat the {sb['loser']} {sb['score']} in Super Bowl {sb['roman']}"
            text += f", the club's {B.ordinal(nth_title)} title." if nth_title else "."
            if res == "won":
                text += f" Skura's {B.plural(len(titles), 'title')} and counting."
            elif res == "lost":
                text += f" Skura's {row['team']} fell in the final."
            figs = [fig(sb["winner"], int(hi)), fig(sb["loser"], int(lo))]
            if champ_rec:
                figs.append(fig("Season record", value=champ_rec))
            if nth_title:
                figs.append(fig("Franchise titles", nth_title))
            card = {"id": f"y{y}-champion", "kind": "champion", "club": winner, "kicker": f"Super Bowl {sb['roman']}",
                    "title": f"{sb['winner']} win it all", "text": text, "figures": figs, "teams": [winner] + ([loser] if loser else []),
                    "players": [p for p in (person(n, y, star=(n == star) or None) for n in photo) if p],
                    "ringHolders": len(holders), "score": sb["score"], "result": res}
            for p in card["players"]:
                p["team"] = winner  # the photo is in the champion's kit
            cards.append(card)

        # 3. awards
        if cur and prev:
            rows = []
            for f, short_label, long_label in AWARD_ORDER:
                for k in sorted(set(cur) & set(prev)):
                    n = k.partition(":")[2]
                    if n not in key_of or not played(k, y):
                        continue
                    if (s(cur, k).get(f) or 0) > (s(prev, k).get(f) or 0):
                        line, figs = season_line(k, y)
                        games = (s(cur, k).get("g") or 0) - (s(prev, k).get("g") or 0)
                        p = person(n, y, award=short_label, awardName=long_label, line=line, figures=figs, games=games)
                        if p:
                            rows.append(p)
            if rows:
                names = B.join([f"{B.short(r['name'])} ({r['award']})" for r in rows])
                cards.append({"id": f"y{y}-awards", "kind": "awards", "club": rows[0].get("team"), "kicker": "The awards",
                              "title": "Hardware", "text": f"{Y}'s winners: {names}.", "players": rows,
                              "teams": sorted({r["team"] for r in rows if r.get("team")})})

        # 4. records
        recs = []
        for r in B.RECORDS:
            if r.get("year") != Y:
                continue
            names = [n for n in B.board_holder_names(r["holder"]) if n in key_of]
            if not names:
                continue
            where = f"week {r['week']} against the {r['opponent']}" if r.get("week") and r.get("opponent") else None
            recs.append({"label": r["record"], "mark": r["mark"], "scope": "club",
                         "players": [p for p in (person(n, y) for n in names) if p], "team": coach_club, "note": where})
        for lr in league_records:
            top = ((lr.get("league") or {}).get("top") or [None])[0]
            if not top or top.get("season") != Y or top.get("club"):
                continue
            n = top.get("name") or (top.get("player") if top.get("player") in key_of else None)
            if not n or n not in key_of:
                continue
            recs.append({"label": lr["record"], "mark": top["mark"], "scope": "league",
                         "players": [p for p in [person(n, y)] if p], "team": club(top.get("team")) or season_club(n, y)})
        if recs:
            recs = recs[:MAX_ROWS]
            for x in recs:
                x.update({k: v for k, v in {"num": _lead_num(x["mark"]), "suf": _suffix(x["mark"])}.items() if v is not None})
                if not x.get("team"):
                    x.pop("team", None)
                if not x.get("note"):
                    x.pop("note", None)
            who = recs[0]["players"][0]
            cards.append({"id": f"y{y}-records", "kind": "records", "club": who.get("team") or coach_club,
                          "kicker": "Record book", "title": "Records broken" if len(recs) > 1 else "Record broken",
                          "text": f"{B.plural(len(recs), 'mark')} fell in {Y}.", "rows": recs,
                          "players": _uniq([p for x in recs for p in x["players"]]),
                          "teams": sorted({x["team"] for x in recs if x.get("team")})})

        # 5. the Gauntlet and milestones
        if cur and prev:
            rows = []
            for k in sorted(set(cur) & set(prev)):
                n = k.partition(":")[2]
                if n not in key_of or not played(k, y):
                    continue
                pos = k.partition(":")[0]
                a, b = s(prev, k), s(cur, k)
                roty = B.g(B.BY_NAME.get(n, {}), "roty")
                poy = "dpoy" if pos in B.DEFENSE else "opoy"

                def full(x):
                    return roty > 0 and all((x.get(f) or 0) > 0 for f in ("rings", "mvp", poy, "sbmvp"))
                if full(b) and not full(a):
                    rows.append((100, person(n, y, label="Completed the Gauntlet",
                                             note=f"a ring, MVP, {poy.upper()}, Rookie of the Year and Super Bowl MVP")))
                for f, label, w in B.AWARDS:
                    lo, hi = a.get(f, 0), b.get(f, 0)
                    if hi > lo and hi >= 2:
                        rows.append((w + min(10, hi), person(n, y, label=f"{B.ordinal(hi).capitalize()} {label}", num=hi)))
                for f, poss, label, step in B.MILESTONES:
                    if f == "g" or (poss is not None and pos not in poss):
                        continue
                    lo, hi = a.get(f, 0), b.get(f, 0)
                    th = hi // step * step
                    if th > lo and th >= step:
                        rows.append((40 + min(20, th // step), person(n, y, label=f"Passed {B.fmt(th)} {label}", num=th)))
            rows = [p for _, p in sorted((r for r in rows if r[1]), key=lambda r: (-r[0], r[1]["name"], r[1]["label"]))]
            seen, picked = set(), []
            for p in rows:
                if p["name"] in seen:
                    continue
                seen.add(p["name"])
                picked.append(p)
            picked = picked[:MAX_ROWS]
            if picked:
                gauntlet = picked[0]["label"] == "Completed the Gauntlet"
                cards.append({"id": f"y{y}-milestones", "kind": "milestones", "club": picked[0].get("team"),
                              "kicker": "The Gauntlet" if gauntlet else "Milestones",
                              "title": f"{B.short(picked[0]['name'])} runs the Gauntlet" if gauntlet else "Round numbers",
                              "text": "; ".join(f"{B.short(p['name'])}, {p['label'][:1].lower()}{p['label'][1:]}" for p in picked) + ".",
                              "gauntlet": gauntlet or None, "players": picked,
                              "teams": sorted({p["team"] for p in picked if p.get("team")})})
                if not gauntlet:
                    cards[-1].pop("gauntlet")

        # 6. market
        if cur and prev:
            moves = []
            for k in sorted(set(cur) & set(prev)):
                va, vb = prev[k].get("value") or 0, cur[k].get("value") or 0
                if va >= MARKET_MIN_VALUE and played(k, y) and k.partition(":")[2] in key_of:
                    moves.append(((vb - va) / va, k, va, vb))
            up = max(moves, key=lambda m: (m[0], m[1]), default=None)
            down = min(moves, key=lambda m: (m[0], m[1]), default=None)
            rows = []
            for m, label in ((up, "Riser"), (down, "Faller")):
                if m and (m[0] > 0 if label == "Riser" else m[0] < 0):
                    pct = round(m[0] * 100)
                    rows.append(person(m[1].partition(":")[2], y, label=label, pct=pct, value=m[3], was=m[2],
                                       ovr=cur[m[1]].get("ovr"), grade=cur[m[1]].get("grade")))
            rows = [r for r in rows if r]
            if rows:
                text = "; ".join(f"{B.short(r['name'])} {'+' if r['pct'] > 0 else '−'}{abs(r['pct'])}%" for r in rows)
                cards.append({"id": f"y{y}-market", "kind": "market", "club": rows[0].get("team"), "kicker": "The market",
                              "title": "Up and down", "text": f"Base-card value across {Y}: {text}.", "players": rows,
                              "teams": sorted({r["team"] for r in rows if r.get("team")})})

        # 7. Hall of Fame class
        cls = next((c for c in hof.get("classes", []) if c["season"] == Y), None)
        if cls:
            ms = sorted((m for m in hof_members.values() if m.get("classSeason") == Y and m["name"] in key_of),
                        key=lambda m: (-m["score"], m["key"]))
            rows = [person(m["name"], y, firstBallot=m.get("firstBallot") or None, legacy=m.get("careerLegacy"),
                           rings=m.get("rings")) for m in ms[:MAX_HOF]]
            rows = [r for r in rows if r]
            for r, m in zip(rows, ms):
                c = club(B.BANNER.get(m["name"])) or season_club(m["name"], y)
                r.pop("team", None)
                if c:
                    r["team"] = c
            if rows:
                fb = sum(1 for m in ms if m.get("firstBallot"))
                cards.append({"id": f"y{y}-hof", "kind": "hof", "club": rows[0].get("team"), "kicker": "Hall of Fame",
                              "title": cls["label"] if cls["label"] != "Inaugural class" else "The inaugural class",
                              "text": f"{B.plural(len(ms), 'new member')}" + (f", {fb} on the first ballot" if fb else "") + ".",
                              "players": rows, "count": len(ms), "teams": sorted({r["team"] for r in rows if r.get("team")})})

        # 8. farewells
        status_retired = {mt.group(1) for m in bundle_muts
                          if m.get("op") == "fact.set" and m.get("value") == "Retired"
                          and (mt := re.match(r"players/(.+)/status$", str(m.get("target", ""))))}
        gone = set()
        for k in (cur or {}):
            n = k.partition(":")[2]
            if n in key_of and played(k, y) and not B.is_status_active(n) and not any(played(k, z) for z in ends if z > y):
                gone.add(n)
        gone |= {n for n in status_retired if n in key_of and not B.is_status_active(n)}
        if not (cur and prev) or y - 1 == first_snap:
            # before the market snapshots can show who played: the dated stints (stints.json) ending this season for
            # retired players
            for n in key_of:
                st = B.dated_stints(n)
                if st and max(x["to"] for x in st) == y and not B.is_status_active(n) and not B.STINTS[n].get("approx"):
                    gone.add(n)
        if gone:
            names = sorted(gone, key=lambda n: (-B.legacy(n), n))
            rows = []
            for n in names[:MAX_FAREWELLS]:
                p = B.BY_NAME.get(n, {})
                c = club(B.BANNER.get(n)) or season_club(n, y)
                r = person(n, y, games=B.g(p, "g") or None, rings=B.g(p, "rings") or None, legacy=B.legacy(n) or None)
                if r:
                    r.pop("team", None)
                    if c:
                        r["team"] = c
                    rows.append(r)
            if rows:
                cards.append({"id": f"y{y}-farewells", "kind": "farewells", "club": rows[0].get("team"), "kicker": "Farewells",
                              "title": "Final whistles", "text": f"{B.plural(len(names), 'career')} ended in {Y}.",
                              "players": rows, "count": len(names), "teams": sorted({r["team"] for r in rows if r.get("team")})})

        # 9. power No. 1 and the upset
        if sched and sched.get("table"):
            top = sched["table"][0]
            u = sched.get("upset")
            figs = [fig("Power score", top["powerScore"], dec=1), fig("Record", value=top["record"]),
                    fig("Point differential", top["diff"], pre="+" if top["diff"] > 0 else "")]
            card = {"id": f"y{y}-power", "kind": "power", "club": club(top["team"]), "kicker": "Power rankings",
                    "title": f"The {top['team']} on top",
                    "text": f"The {top['team']} finish {Y} No. 1 in the power rankings at {top['record']}.",
                    "figures": figs, "teams": [club(top["team"])]}
            if u and club(u["winner"]) and club(u["loser"]):
                card["upset"] = {"winner": club(u["winner"]), "loser": club(u["loser"]), "score": u["score"], "week": u["week"],
                                 "winnerRecord": u["winnerRecord"], "loserRecord": u["loserRecord"]}
                card["text"] += (f" Upset of the year: the {u['winner']} ({u['winnerRecord']}) beat the {u['loser']} "
                                 f"({u['loserRecord']}) {u['score']} in week {u['week']}.")
                card["teams"] = _uniq(card["teams"] + [club(u["winner"]), club(u["loser"])])
            cards.append(card)

        # 10. tribute pick
        pk = plan.get(Y)
        if pk and pk["player"].partition(":")[2] in key_of:
            n = pk["player"].partition(":")[2]
            reason = {"hof": "Hall of Fame", "retired": "Final season", "gauntlet": "The Gauntlet", "record": "Records",
                      "award": "Awards", "story": "The headline act", "trade": "On the move", "queue": "From the queue"}.get(pk["reason"], "Tribute")
            p = person(n, y, reason=reason)
            if p:
                line, figs = season_line(pk["player"], y) if cur and prev and played(pk["player"], y) else ("", [])
                if line:
                    p["line"] = line
                    p["figures"] = figs
                details = [d["detail"] for d in pk.get("signals", [])][:4]
                cards.append({"id": f"y{y}-tribute", "kind": "tribute", "club": p.get("team"), "kicker": f"Tribute · {reason}",
                              "title": n, "text": _sentence(details) if details and pk["reason"] != "queue"
                              else f"The tribute queue's highest Career Legacy ({B.fmt(B.legacy(n))}).",
                              "players": [p], "link": {"tribute": pk["player"]} if pk.get("written") else None,
                              "teams": [p["team"]] if p.get("team") else []})
                if not cards[-1]["link"]:
                    cards[-1].pop("link")

        # 11. the Season Story lead (written; quoted)
        story = B.STORIES.get(Y)
        lead = next((a for a in (story or {}).get("articles", []) if a.get("kind") == "lead"), None)
        if lead:
            ps = [p for p in (person(n, y) for n in lead.get("players", [])[:3]) if p]
            lc = next((club(t) for t in lead.get("teams", []) if club(t)), None) or (ps[0].get("team") if ps else coach_club)
            cards.append({"id": f"y{y}-story", "kind": "story", "club": lc, "kicker": "Season Story", "title": lead["headline"],
                          "text": lead.get("dek", ""), "quoted": True, "players": ps, "link": {"story": lead["id"]},
                          "teams": [t for t in (club(t) for t in lead.get("teams", [])) if t]})

        # 12. the spiciest take (written; quoted)
        tk = takes.get(Y)
        if tk and tk.get("takes"):
            t = max(tk["takes"], key=lambda t: (t.get("heat", 0), -tk["takes"].index(t)))
            ps = [p for p in (person(n, y) for n in t.get("players", [])[:2]) if p]
            tc = next((club(x) for x in t.get("teams", []) if club(x)), None) or (ps[0].get("team") if ps else coach_club)
            cards.append({"id": f"y{y}-take", "kind": "take", "club": tc, "kicker": "Hottest take", "title": t["headline"],
                          "text": t.get("dek", ""), "quoted": True, "heat": t.get("heat"), "players": ps,
                          "link": {"take": t["id"]}, "teams": [x for x in (club(x) for x in t.get("teams", [])) if x]})

        # 13. outro
        trips = [r for r in B.SEASONS if r["year"] <= y and B.SB_BY_YEAR.get(r["year"], {}).get("your_result") in ("won", "lost")]
        nxt = f"Y{y + 1}"
        outro = {"id": f"y{y}-outro", "kind": "outro", "club": coach_club, "kicker": "That was " + Y, "title": f"Next: {nxt}",
                 "next": nxt, "figures": [fig("Skura's titles", len(titles)), fig("Super Bowl trips", len(trips))],
                 "text": f"Through {Y}, Skura has won {len(titles)} of {B.plural(len(trips), 'Super Bowl')}.",
                 "teams": [coach_club] if coach_club else []}
        if y == B.LAST:
            live = B.LIVE
            if live and live.get("season") == y + 1 and live.get("club"):
                cl = club(live["club"]) if isinstance(live["club"], str) else None
                rr = (live.get("clubs") or {}).get(cl or "", {})
                if cl and rr:
                    w, l, t_ = rr.get("w", 0), rr.get("l", 0), rr.get("t", 0)
                    outro["live"] = {"club": cl, "week": live.get("week"), "record": f"{w}-{l}" + (f"-{t_}" if t_ else "")}
                    outro["text"] += f" {nxt} is under way: the {cl} are {outro['live']['record']} after week {live.get('week')}."
            chases = []
            for share, label, holder, chaser, get in B.record_chases()[:2]:
                p = person(chaser["n"], y, label=label, gap=_whole(get(holder) - get(chaser)), share=round(share * 100), holder=holder["n"])
                if p and holder["n"] in key_of:
                    chases.append(p)
            if chases:
                outro["players"] = chases
                outro["text"] += " Chasing history in " + nxt + ": " + "; ".join(
                    f"{B.short(c['name'])}, {B.fmt(c['gap'])} {_unit(c['label'], c['gap'])} from {B.short(c['holder'])}'s mark" for c in chases) + "."
        else:
            outro["link"] = {"season": nxt}
        cards.append(outro)

        for i, c in enumerate(cards):
            c["n"] = i + 1
            if not c.get("club"):
                c["club"] = coach_club
            c["teams"] = [t for t in c.get("teams", []) if t]
            for k in [k for k, v in c.items() if v is None]:
                c.pop(k)
        rewinds.append({"season": Y, "club": coach_club, "record": rec, "finish": row["finish"], "champion": winner,
                        "next": nxt, "cards": cards})

    index = [{"season": r["season"], "file": rewind_file(r["season"]), "club": r["club"], "champion": r["champion"],
              "record": r["record"], "count": len(r["cards"]), "kinds": [c["kind"] for c in r["cards"]]}
             for r in rewinds]
    return index, rewinds


def rewind_file(season: str) -> str:
    return f"rewind/{season}.json"


def write(out_dir: Path, rewinds: list[dict]):
    """public/data/league/rewind/<Y>.json, one per season; stale files removed."""
    d = out_dir / "rewind"
    d.mkdir(parents=True, exist_ok=True)
    keep = set()
    for r in rewinds:
        path = out_dir / rewind_file(r["season"])
        keep.add(path.name)
        path.write_text(json.dumps(r, ensure_ascii=False, indent=1) + "\n")
    for old in d.glob("*.json"):
        if old.name not in keep:
            old.unlink()


def _unit(label: str, n) -> str:
    """"career sacks" -> "sacks" ("sack" for 1)."""
    u = label.replace("career ", "")
    return u[:-1] if n == 1 and u.endswith("s") else u


def _whole(x):
    return int(x) if float(x).is_integer() else round(x, 1)


def _uniq(items: list) -> list:
    out, seen = [], set()
    for x in items:
        k = json.dumps(x, sort_keys=True)
        if x is not None and k not in seen:
            seen.add(k)
            out.append(x)
    return out


def _lead_num(mark: str):
    m = re.match(r"([\d,]+(?:\.\d+)?)", mark)
    return float(m.group(1).replace(",", "")) if m and "." in m.group(1) else int(m.group(1).replace(",", "")) if m else None


def _suffix(mark: str):
    m = re.match(r"[\d,.]+(.*)$", mark)
    return m.group(1) if m and m.group(1) else None


def _sentence(parts: list[str]) -> str:
    text = "; ".join(parts)
    return text[:1].upper() + text[1:] + "."
