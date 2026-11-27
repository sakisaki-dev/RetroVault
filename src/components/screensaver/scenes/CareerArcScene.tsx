import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { isReducedMotion } from '@/hooks/usePerfMode';
import { Trophy } from 'lucide-react';
import type { Player } from '@/types/player';
import { playerKey } from '@/config/ovr';
import { findNFLTeam } from '@/utils/nflTeams';
import { bannerTeamOf, getStints, type IndexedExtras } from '@/utils/playerExtras';
import type { CareerSeasonsFile } from '@/utils/careerSeasons';
import type { SuperBowlEntry } from '@/utils/leagueContent';
import { bannerStats } from '@/components/hof/hofUtils';
import { groupOf } from '@/components/stats/comps/graphs/statDefs';
import { usePerfMode } from '@/hooks/usePerfMode';
import GameSprite from '@/components/GameSprite';
import TeamLogo from '@/components/brand/TeamLogo';
import { Stadium, ClubTag } from '../Screensaver';
import './liveScenes.css';

/*
 * Career arc: a legend walks along his season ratings. One bar per recorded season (career_seasons.json `sovr`, the
 * season OVR; a season with no line has no bar), the bar in the club's colour for the club he played for that season
 * (stints.json), gold at 90+, a trophy where the season was a title one: his rings rose that season and his club won
 * the Super Bowl (super_bowls) or his stint lists that year as a ring. The walker wears each season's kit.
 */
export interface ArcPoint { year: number; v: number; title: boolean; club: string }
export interface CareerArcData { player: Player; points: ArcPoint[]; roll: number }

const reduced = () => typeof window !== 'undefined' && isReducedMotion();

/** His seasons with a season OVR; null under `min` bars */
export const arcFor = (file: CareerSeasonsFile, p: Player, extras: IndexedExtras, bowls: SuperBowlEntry[], min = 4): ArcPoint[] | null => {
  const entry = file.players[playerKey(p)];
  if (!entry) return null;
  const fields = file.fields[groupOf(p.position)] ?? [];
  const ri = fields.indexOf('rings');
  const start = file.seasons.indexOf(entry.from);
  if (start < 0) return null;
  const fallback = bannerTeamOf(p);
  const stints = getStints(extras, p.name)?.stints ?? [];
  const pts: ArcPoint[] = [];
  entry.rows.forEach((row, i) => {
    const year = file.seasons[start + i];
    const v = row && year != null ? row[5 + fields.length] : null;
    if (v == null || year == null) return;
    const prev = i > 0 ? entry.rows[i - 1] : null;
    const gained = ri >= 0 && !!prev && Number(row![5 + ri]) > Number(prev[5 + ri]);
    const stint = stints.find((s) => s.from <= year && year <= s.to);
    const club = findNFLTeam(stint?.team ?? fallback)?.name ?? (stint?.team || fallback);
    const champ = bowls.find((b) => b.year === year)?.winner;
    const title = gained && (stint?.rings.includes(year) || (!!champ && findNFLTeam(champ)?.name === club) || (!stint && !champ));
    pts.push({ year, v: Number(v), title, club });
  });
  return pts.length >= min ? pts : null;
};

const heightPct = (v: number) => Math.max(10, Math.min(100, ((v - 40) / 60) * 100));

const CareerArcScene = ({ data, ovr, sprites }: { data: CareerArcData; ovr: number | null; sprites: boolean }) => {
  const { player: p, points, roll } = data;
  const N = points.length;
  const { lite } = usePerfMode();
  const still = useMemo(reduced, []) || lite;
  const [idx, setIdx] = useState(still ? N - 1 : -1);
  const stepMs = Math.max(320, Math.min(800, 9000 / N));
  useEffect(() => {
    if (still) return;
    let i = -1;
    let t = window.setTimeout(function go() {
      i += 1;
      setIdx(i);
      if (i < N - 1) t = window.setTimeout(go, stepMs);
    }, 900);
    return () => window.clearTimeout(t);
  }, [N, stepMs, still]);

  const peak = points.reduce((a, b) => (b.v > a.v ? b : a));
  const titles = points.filter((x) => x.title).length;
  const home = findNFLTeam(bannerTeamOf(p));
  const cur = points[Math.max(0, idx)];
  const done = idx >= N - 1;
  const nums = [
    ...(ovr != null ? [{ label: 'OVR', value: String(ovr) }] : []),
    { label: 'Peak SZN', value: `${peak.v} (Y${peak.year})` },
    { label: 'Title seasons', value: String(titles) },
    ...bannerStats(p).slice(0, 2).map((s) => ({ label: s.label, value: Math.round(s.value).toLocaleString('en-US') })),
  ];
  return (
    <Stadium club={home?.name ?? cur.club} roll={roll}>
      <div className="lv-ca">
        <div className="lv-plate" style={{ '--pc': home ? `hsl(${home.primaryColor})` : '#4a5a9a' } as CSSProperties}>
          <div>
            <p className="sv-kick">Career arc · season OVR</p>
            <h2 className="lv-ca__name">{p.name}</h2>
            <p className="lv-ca__meta">
              {p.position} · <ClubTag team={home?.name ?? p.team ?? ''} />
            </p>
          </div>
          <dl className="lv-ca__nums">
            {nums.map((x) => (
              <div key={x.label}>
                <dd>{x.value}</dd>
                <dt>{x.label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="lv-ca__chart" style={{ '--n': N } as CSSProperties}>
          <ol className="lv-ca__bars">
            {points.map((x, i) => {
              const t = findNFLTeam(x.club);
              return (
                <li
                  key={x.year}
                  className={`lv-ca__col ${i <= idx ? 'is-up' : ''} ${x.v >= 90 ? 'is-gold' : ''}`}
                  style={{ '--h': `${heightPct(x.v)}%`, '--bc': t ? `hsl(${t.primaryColor})` : '#4a5a9a' } as CSSProperties}
                >
                  <span className="lv-ca__bar">
                    <b>{x.v}</b>
                    {x.title && <Trophy className="lv-ca__cup" size={18} strokeWidth={2.4} aria-label="Title season" />}
                  </span>
                  <span className="lv-ca__yr">{String(x.year).padStart(2, '0')}</span>
                  <span className="lv-ca__lg">{N <= 20 && t && <TeamLogo team={t.name} size={18} decorative />}</span>
                </li>
              );
            })}
          </ol>
          {sprites && idx >= 0 && (
            <span
              className="lv-ca__walker"
              style={{ left: `calc(22px + (100% - 44px) * ${(idx + 0.5) / N})`, bottom: `calc(${heightPct(points[idx].v) / 100} * var(--bars-h) + var(--axis) + 10px)` }}
            >
              <GameSprite player={p} team={cur.club} kind="figure" size="m" action={done ? 'celebrate' : 'run'} />
            </span>
          )}
          <p className="lv-ca__key">
            <i /> 90+ SZN <Trophy size={14} strokeWidth={2.4} /> title season
          </p>
        </div>
      </div>
    </Stadium>
  );
};

export default CareerArcScene;
