import type { Player } from '@/types/player';
import { findNFLTeam, type NFLTeam } from '@/utils/nflTeams';
import { matchPlayerByName, type LeagueContent, type PlayerNote, type SuperBowlEntry } from '@/utils/leagueContent';
import type { PlayerCardExtras, PlayerStints } from '@/utils/playerExtras';
import type { RetiredNumber } from '@/utils/jerseys';

/**
 * Career Arc: a player's path through eras, franchises, titles and honors, assembled only from data the
 * site already has (league content eras / Super Bowls / player notes, player-extras cards, jersey index).
 * No per-season data exists, so anything not stated outright is labelled "likely" with the reason.
 */

export type Evidence = 'confirmed' | 'likely';

export interface ArcEra {
  name: string;
  /** null when the source gives no years (e.g. imported legends) */
  start: number | null;
  end: number | null;
  approx: boolean;
  source: string;
}

export interface ArcRing {
  year: number;
  roman: string;
  team: string;
  opponent: string | null;
  score: string | null;
  evidence: Evidence;
  reason: string;
}

export interface ArcStint {
  key: string;
  label: string;
  team: NFLTeam | null;
  evidence: Evidence;
  /** Why we believe it */
  source: string;
  /** How he arrived, e.g. "Traded · Y80" */
  arrival?: string;
  /** Short role / tenure note, e.g. "One season", "Final season", "Current club" */
  tag?: string;
  /** Explicit years from notes (e.g. Y80), shown when no ring dates the stint */
  years: number[];
  rings: ArcRing[];
}

export interface CareerArcData {
  eras: ArcEra[];
  stints: ArcStint[];
  /** Rings the evidence can't place in a year */
  undatedRings: number;
  totalRings: number;
  hallOfFame: { tier: string } | null;
  retired: RetiredNumber | null;
  legend: boolean;
  /** Editorial one-liner from the player notes (e.g. "Only 2× DPOY") */
  tagline: string | null;
}

const YEAR_RANGE = /~?Y(\d+)(?:\s*[–—-]\s*Y?(\d+))?/g;
const ROMAN = /\b([CLXVI]{2,})\b/g;
const WIN_WORDS = /\b(won|win|wins|title|titles|champion|champions|champ|three-peat|four-peat|repeat|ring|rings)\b|peat\b/i;

const teamKey = (raw: string) => findNFLTeam(raw)?.id ?? raw.trim().toLowerCase();
const teamName = (raw: string) => findNFLTeam(raw)?.name ?? raw.trim();

const yearsIn = (text: string): number[] => {
  const out: number[] = [];
  for (const m of text.matchAll(YEAR_RANGE)) {
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    for (let y = Math.min(a, b); y <= Math.max(a, b) && y - a < 40; y++) out.push(y);
  }
  return out;
};

const rangeOf = (text?: string): { start: number; end: number; approx: boolean } | null => {
  if (!text) return null;
  const m = text.match(/(~)?Y(\d+)(?:\s*[–—-]\s*Y?(\d+))?/);
  if (!m) return null;
  const a = parseInt(m[2], 10);
  const b = m[3] ? parseInt(m[3], 10) : a;
  return { start: Math.min(a, b), end: Math.max(a, b), approx: !!m[1] };
};

/** "Falcons (traded for Y80, season in progress)" -> "Falcons" */
const leadingTeam = (text?: string) => text?.split('(')[0].trim() || undefined;

interface Inputs {
  player: Player;
  content: LeagueContent | null;
  card?: PlayerCardExtras;
  retired?: RetiredNumber | null;
  hofTier?: string | null;
  /** Reconstructed career stints (player-extras "stints"); when present they are the ordered stops */
  stints?: PlayerStints;
}

/** Stops from the reconstructed stints: ordered, with year ranges and the titles won there. */
const stintsFromCareer = (career: PlayerStints, sbs: SuperBowlEntry[], retiredTeam?: string): ArcStint[] => {
  const evidence: Evidence = career.confidence === 'confirmed' || career.confidence === 'strong' ? 'confirmed' : 'likely';
  const label = { confirmed: 'Confirmed', strong: 'Strong fit', likely: 'Likely', ambiguous: 'Best guess' }[career.confidence];
  const n = career.stints.length;
  // A stop that starts after the latest Super Bowl in the data is a post-season trade (infer_stints.py LAST + 1)
  const lastSeason = sbs.reduce((m, sb) => Math.max(m, sb.year), 0);
  return career.stints.map((st, i) => {
    const traded = lastSeason > 0 && st.from > lastSeason;
    const years = career.approx ? [] : traded ? [st.from] : Array.from({ length: st.to - st.from + 1 }, (_, k) => st.from + k);
    const rings: ArcRing[] = st.rings
      .map((y) => sbs.find((sb) => sb.year === y))
      .filter((sb): sb is SuperBowlEntry => !!sb)
      .map((sb) => ({
        year: sb.year,
        roman: sb.roman,
        team: sb.winner ?? st.team,
        opponent: sb.loser,
        score: sb.score,
        evidence,
        reason: `The ${teamName(st.team)} won it while he was there (career reconstruction: ${label.toLowerCase()})`,
      }));
    const last = i === n - 1;
    let tag: string | undefined;
    if (last && retiredTeam && teamKey(retiredTeam) === teamKey(st.team)) tag = 'Retired here';
    else if (traded) tag = `Joins for Y${st.from}`;
    else if (career.approx) tag = 'Years unknown';
    else if (st.from === st.to) tag = 'One season';
    return {
      key: `${teamKey(st.team)}-${i}`,
      label: teamName(st.team),
      team: findNFLTeam(st.team),
      evidence,
      source: i === 0 ? `${label}: ${career.evidence}` : `Career reconstruction: ${label.toLowerCase()}`,
      tag,
      years,
      rings,
    };
  });
};

export const buildCareerArc = ({ player, content, card, retired, hofTier, stints: career }: Inputs): CareerArcData => {
  const sbs: SuperBowlEntry[] = content?.superBowls ?? [];
  const note: PlayerNote | undefined = content?.playerNotes ? matchPlayerByName(player.name, content.playerNotes) : undefined;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const cardNote = str(card?.note);
  const cardTeam = str(card?.team);
  const formerTeam = str(card?.former_team);
  const legacyTeam = str(card?.legacy_team);
  const retiredTeam = str(card?.retired_team);
  const texts = [cardNote, note?.tag, cardTeam].filter((t): t is string => !!t);
  const allText = texts.join(' ; ');

  // ---------- Eras ----------
  const eras: ArcEra[] = [];
  (content?.eras ?? []).forEach((e) => {
    if (e.keyPlayers.some((k) => matchPlayerByName(k, [player]))) {
      eras.push({ name: e.name, start: e.startYear, end: e.endYear, approx: false, source: `Listed as a key player of the ${e.name}` });
    }
  });
  if (note?.era && !player.isRealLegend) {
    const [label] = note.era.split('·').map((x) => x.trim());
    const r = rangeOf(note.era.split('·')[1]);
    const known = eras.find((e) => e.name.toLowerCase() === label.toLowerCase());
    if (!known) {
      eras.push({
        name: label.includes('→') ? 'Career span' : label,
        start: r?.start ?? null,
        end: r?.end ?? null,
        approx: r?.approx ?? false,
        source: 'Player note',
      });
    }
  }
  eras.sort((a, b) => (a.start ?? 999) - (b.start ?? 999));

  // Reconstructed stints, when on file, are the ordered stops (with year ranges and ring years)
  if (career?.stints.length && !player.isRealLegend) {
    const stops = stintsFromCareer(career, sbs, retiredTeam);
    const placed = stops.reduce((k, st) => k + st.rings.length, 0);
    const totalRings = Math.max(0, player.rings ?? 0);
    return {
      eras,
      stints: stops,
      undatedRings: Math.max(0, totalRings - placed),
      totalRings,
      hallOfFame: hofTier ? { tier: hofTier } : null,
      retired: retired ?? null,
      legend: false,
      tagline: note?.tag ?? null,
    };
  }

  // ---------- Franchises (ordered chain from notes / card) ----------
  const stints: ArcStint[] = [];
  const addStint = (raw: string | undefined, init: Partial<ArcStint> & { source: string }, at?: number) => {
    if (!raw) return;
    const key = teamKey(raw);
    const existing = stints.find((s) => s.key === key);
    if (existing) {
      if (init.tag && !existing.tag) existing.tag = init.tag;
      if (init.arrival && !existing.arrival) existing.arrival = init.arrival;
      return;
    }
    const stint: ArcStint = {
      key,
      label: teamName(raw),
      team: findNFLTeam(raw),
      evidence: init.evidence ?? 'confirmed',
      source: init.source,
      arrival: init.arrival,
      tag: init.tag,
      years: init.years ?? [],
      rings: [],
    };
    if (at == null) stints.push(stint);
    else stints.splice(at, 0, stint);
  };

  // "Bills → Seahawks · ~Y25–38"
  if (note?.era?.includes('→')) {
    note.era
      .split('·')[0]
      .split('→')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => addStint(t, { source: 'Player note' }));
  }
  addStint(legacyTeam, { source: 'Card: legacy team', tag: 'Franchise legend' });
  addStint(formerTeam, { source: 'Card: former team' });
  addStint(player.team, { source: player.isRealLegend ? 'Real NFL team' : 'League sheet team' });
  if (cardTeam && teamKey(leadingTeam(cardTeam) ?? '') !== teamKey(player.team ?? '')) {
    const traded = /trad/i.test(cardTeam) || new RegExp(`traded to the ${leadingTeam(cardTeam)}`, 'i').test(allText);
    const ys = yearsIn(cardTeam);
    addStint(leadingTeam(cardTeam), {
      source: 'Card: current team',
      arrival: traded ? `Traded${ys.length ? ` · Y${ys[0]}` : ''}` : undefined,
      tag: /in progress/i.test(cardTeam) ? 'Season in progress' : undefined,
      years: ys,
    });
  }
  // Tenure notes: "one season with the Titans", "final season with the Jets"
  for (const m of allText.matchAll(/\b(one|final|first|last)\s+season\s+(?:with|as)\s+(?:the\s+|a\s+)?([A-Z][\w.]+)/gi)) {
    const s = stints.find((x) => x.key === teamKey(m[2]));
    if (s && !s.tag) s.tag = `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} season`;
  }
  // "now with the Seahawks" / "joined the Jets" confirm a team mentioned in prose
  for (const m of allText.matchAll(/\b(now with|joined)\s+the\s+([A-Z][\w.]+)/g)) {
    addStint(m[2], { source: 'Player note', arrival: m[1] === 'joined' ? 'Joined' : undefined });
  }
  for (const m of allText.matchAll(/\btraded to the\s+([A-Z][\w.]+)(?:[^;]*?Y(\d+))?/g)) {
    addStint(m[1], { source: 'Player note', arrival: `Traded${m[2] ? ` · Y${m[2]}` : ''}` });
  }

  // The game's Hall of Fame lists the team he retired with: always his last stop
  if (retiredTeam) {
    const key = teamKey(retiredTeam);
    const existing = stints.find((s) => s.key === key);
    if (existing) {
      existing.tag = 'Retired here';
      stints.splice(stints.indexOf(existing), 1);
      stints.push(existing);
    } else addStint(retiredTeam, { source: 'Game Hall of Fame', tag: 'Retired here' });
  }

  const franchiseKeys = () => new Set(stints.map((s) => s.key));

  // ---------- Rings ----------
  const totalRings = Math.max(0, player.rings ?? 0);
  const rings: ArcRing[] = [];
  const has = (year: number) => rings.some((r) => r.year === year);
  const ringFrom = (sb: SuperBowlEntry, evidence: Evidence, reason: string): ArcRing => ({
    year: sb.year,
    roman: sb.roman,
    team: sb.winner ?? '',
    opponent: sb.loser,
    score: sb.score,
    evidence,
    reason,
  });

  // Confirmed: a Super Bowl named (by numeral, or by year in a "won/title" clause) in this player's own notes,
  // won by one of his franchises.
  texts.forEach((t) => {
    t.split(/[;,]/).forEach((clause) => {
      const named = [...clause.matchAll(ROMAN)].map((m) => sbs.find((sb) => sb.roman === m[1])).filter((sb): sb is SuperBowlEntry => !!sb);
      const byYear = WIN_WORDS.test(clause) ? yearsIn(clause).map((y) => sbs.find((sb) => sb.year === y)).filter((sb): sb is SuperBowlEntry => !!sb) : [];
      [...named, ...byYear].forEach((sb) => {
        if (rings.length >= totalRings || has(sb.year) || !sb.winner) return;
        if (!franchiseKeys().has(teamKey(sb.winner))) return;
        rings.push(ringFrom(sb, 'confirmed', `Named in his player notes (${sb.roman}, Y${sb.year})`));
      });
    });
  });

  // Likely: titles inside the eras he's a key player of.
  const dated = eras.filter((e) => e.start != null && e.end != null);
  const inEra = (y: number) => dated.find((e) => y >= (e.start as number) && y <= (e.end as number));
  let remaining = totalRings - rings.length;
  if (remaining > 0 && dated.length) {
    // (a) won by one of his franchises during his era
    const own = sbs.filter((sb) => sb.winner && inEra(sb.year) && !has(sb.year) && franchiseKeys().has(teamKey(sb.winner)));
    if (own.length && own.length <= remaining) {
      own.forEach((sb) =>
        rings.push(ringFrom(sb, 'likely', `The ${teamName(sb.winner!)} won it during the ${inEra(sb.year)!.name}, when he was one of their key players`)),
      );
      remaining -= own.length;
    }
    // (b) your franchise's titles in his era, used only when their count matches his remaining rings exactly
    const yours = sbs.filter((sb) => sb.yourResult === 'won' && sb.winner && inEra(sb.year) && !has(sb.year));
    if (remaining > 0 && yours.length === remaining) {
      yours.forEach((sb) =>
        rings.push(
          ringFrom(sb, 'likely', `Your ${teamName(sb.winner!)} won it during the ${inEra(sb.year)!.name}; your titles in his era match his ring count`),
        ),
      );
      remaining = 0;
    }
  }
  rings.sort((a, b) => a.year - b.year);

  // Attach rings to stints; a ring won by a team not yet in the chain implies a (likely) stint there.
  rings.forEach((r) => {
    const key = teamKey(r.team);
    let s = stints.find((x) => x.key === key);
    if (!s) {
      s = {
        key,
        label: teamName(r.team),
        team: findNFLTeam(r.team),
        evidence: 'likely',
        source: `Implied by the Y${r.year} title`,
        years: [],
        rings: [],
      };
      // Insert after the last stint that is already dated at or before this year (keeps "final" stints last).
      const firstYear = (x: ArcStint) => Math.min(...x.rings.map((q) => q.year), ...x.years, Infinity);
      let at = 0;
      stints.forEach((x, i) => {
        if (firstYear(x) <= r.year) at = i + 1;
      });
      stints.splice(at, 0, s);
    }
    s.rings.push(r);
  });

  if (stints.length === 0) {
    stints.push({ key: 'none', label: 'No team on record', team: null, evidence: 'confirmed', source: 'League sheet', years: [], rings: [] });
  }
  // The league sheet's team, when it isn't the last stop, is still the club of record for this card
  const sheetKey = player.team ? teamKey(player.team) : null;
  stints.forEach((s, i) => {
    if (s.key === sheetKey && !s.tag) s.tag = i === stints.length - 1 ? 'Club of record' : undefined;
  });

  return {
    eras,
    stints,
    undatedRings: Math.max(0, totalRings - rings.length),
    totalRings,
    hallOfFame: hofTier ? { tier: hofTier } : null,
    retired: retired ?? null,
    legend: !!player.isRealLegend,
    tagline: note?.tag ?? null,
  };
};

/** "Y36–38" or "Y72" for a stint, from its ring years and explicit years. */
export const stintYears = (s: ArcStint): string | null => {
  const ys = [...new Set([...s.rings.map((r) => r.year), ...s.years])].sort((a, b) => a - b);
  if (!ys.length) return null;
  return ys.length === 1 ? `Y${ys[0]}` : `Y${ys[0]}–${ys[ys.length - 1]}`;
};
