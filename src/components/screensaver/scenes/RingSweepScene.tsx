import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { isReducedMotion } from '@/hooks/usePerfMode';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { usePerfMode } from '@/hooks/usePerfMode';
import TeamLogo from '@/components/brand/TeamLogo';
import { Figure, Stadium } from '../Screensaver';
import './liveScenes.css';

/*
 * Ring of honor sweep: every club with a ring of honor (halloffame.json ringOfHonor) as a plaque on one rail, in order
 * of Super Bowl titles. The camera pans along it; as a plaque lights, that club's own ground fades in, its greatest
 * honoured player (best Career Legacy in the ring) steps onto the turf celebrating, and a jumbotron reads the club's
 * Super Bowl titles (super_bowls), Hall of Famers and honoured players.
 */
export interface RingClub { name: string; titles: number; lastTitle: number | null; hof: number; honoured: number; star: Player; starWhy: string }

const STEP = 3400;
const REACH = 6;
const DROP = 130;

const reduced = () => typeof window !== 'undefined' && isReducedMotion();

const RingSweepScene = ({ all, picks, sprites }: { all: RingClub[]; picks: string[]; sprites: boolean }) => {
  const order = useMemo(() => picks.map((n) => all.findIndex((c) => c.name === n)).filter((i) => i >= 0), [all, picks]);
  const { lite } = usePerfMode();
  const still = useMemo(reduced, []);
  const [step, setStep] = useState(0);
  const [cam, setCam] = useState(order[0] - 2.2);
  useEffect(() => {
    const first = window.setTimeout(() => setCam(order[0]), 80);
    if (still) return () => window.clearTimeout(first);
    const ts = order.slice(1).map((_, j) =>
      window.setTimeout(() => {
        setStep(j + 1);
        setCam(order[j + 1]);
      }, (j + 1) * STEP),
    );
    return () => [first, ...ts].forEach(window.clearTimeout);
  }, [order, still]);
  const club = all[order[step]];
  const t = findNFLTeam(club.name);
  const style = { '--rs1': t ? `hsl(${t.primaryColor})` : '#2a3a8a', '--rs2': t ? `hsl(${t.secondaryColor})` : '#ffc63e' } as CSSProperties;
  // each club's own ground: its stadium is the backdrop (lite mode keeps the first one, so no art reloads mid-scene)
  const ground = lite ? all[order[0]].name : club.name;
  const chips: [string, number][] = [
    ['Super Bowl titles', club.titles],
    ['Hall of Famers', club.hof],
    ['Honoured', club.honoured],
  ];
  return (
    <Stadium club={ground} roll={0.35 + ((order[step] * 0.37) % 0.6)} className="lv-rs__stadium">
      <div className="lv-rs" style={style}>
        <p className="sv-kick lv-rs__kick">Ring of honor · by Super Bowl titles</p>
        <div className="lv-rs__ring" aria-hidden="true">
          {all.map((c, i) => {
            const d = i - cam;
            const k = Math.min(1, Math.abs(d) / REACH);
            const lit = c === club;
            const ct = findNFLTeam(c.name);
            return (
              <div
                key={c.name}
                className={`lv-rs__plaque ${lit ? 'is-lit' : ''}`}
                style={{
                  '--c1': ct ? `hsl(${ct.primaryColor})` : '#2a3a8a',
                  '--c2': ct ? `hsl(${ct.secondaryColor})` : '#ffc63e',
                  transform: `translateX(calc(${d} * var(--rs-step))) translateY(${Math.round(DROP * (1 - Math.sqrt(1 - k * k)))}px) scale(${lit ? 1.4 : 1 - k * 0.3})`,
                  zIndex: lit ? 5 : 3 - Math.round(k * 2),
                } as CSSProperties}
              >
                <TeamLogo team={c.name} size={40} decorative />
                <b>{c.titles > 0 ? `${c.titles}★` : ' '}</b>
              </div>
            );
          })}
        </div>
        <div className="lv-rs__jumbo" key={club.name}>
          <div className="lv-rs__who">
            <TeamLogo team={club.name} size={68} decorative />
            <div>
              <h2 className="sv-title lv-rs__name">{t?.fullName ?? club.name}</h2>
              <p className="sv-sub sv-sub--dim">{club.lastTitle ? `Last title Y${club.lastTitle}` : 'Ring of honor'}</p>
            </div>
          </div>
          <dl className="lv-rs__chips">
            {chips.map(([k, n]) => (
              <div key={k}>
                <dd>{n}</dd>
                <dt>{k}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="lv-rs__star" key={`${club.name}-star`}>
          <span className="lv-rs__glow" aria-hidden="true" />
          <Figure player={club.star} sprites={sprites} action="celebrate" scale={1.2} team={club.name} />
          <span className="lv-rs__nameplate">
            <TeamLogo team={club.name} size={18} decorative />
            <b>{club.star.name}</b>
            <i>{club.starWhy}</i>
          </span>
        </div>
      </div>
    </Stadium>
  );
};
export default RingSweepScene;
