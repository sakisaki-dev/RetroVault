import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/player';
import { findNFLTeam } from '@/utils/nflTeams';
import { usePhone } from '@/hooks/usePhone';
import {
  COUNTER_GROUPS,
  DIFFICULTY,
  FACILITY_MAX,
  FACILITY_ROLE,
  TRAINING,
  capRows,
  facilityRisks,
  ordinal,
  staffFinalSeason,
  teamStrength,
  useOfficeState,
  type CapRow,
  type FacilityId,
  type OfficeState,
  type OfficeStaff,
  type Strength,
} from '@/utils/clubOffice';
import CapSheet, { Stars } from './CapSheet';
import { Desk, Lamp, PickToken, inkOf } from './board';
import { Coach, Facility, PixelIcon, SafeSign, WarnSign, type PixelIconId } from './pixelArt';

/**
 * The club office: the coached club's cap sheet, coordinators, front desk, facilities and the game's lifetime counters,
 * from the save (save_state.json), laid out like the trophy cabinet: shelf panels with a faint club tint, the real logo,
 * a lamp chip and an object to look at in each (players standing on their salaries, staff figures, pixel buildings,
 * rafter banners). Every figure comes from the save; every tag is a rule in utils/clubOffice.ts.
 */

const FACILITY_NAME: Record<FacilityId, string> = { stadium: 'Stadium', training: 'Training', rehab: 'Rehab' };
const fmt = (n: number) => n.toLocaleString('en-US');
const GOLD = 'hsl(43 100% 62%)';

/** Digits on split-flap tiles (separators stay small). */
const Flaps = ({ text, label }: { text: string; label: string }) => (
  <span className="fo-flaps" role="img" aria-label={label}>
    {[...text].map((c, i) =>
      /\d/.test(c) ? (
        <span key={i} className="fo-flap">
          {c}
        </span>
      ) : (
        <span key={i} className="fo-flap-sep">
          {c}
        </span>
      ),
    )}
  </span>
);

/** An LED meter: `segments` lamps, lit in proportion. */
const Leds = ({ value, of, segments, label }: { value: number; of: number; segments: number; label: string }) => {
  const lit = Math.round((value / of) * segments);
  return (
    <span className="fo-leds" role="img" aria-label={`${label}: ${value} of ${of}`} style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn(i < lit && 'is-on')} />
      ))}
    </span>
  );
};

/* ---------------- Coordinators ---------------- */

/** Team strength as a 0-10 gauge; a raw sum past the cap runs on, hatched, beyond the "cap" notch. */
const StrengthGauge = ({ s, role, note }: { s: Strength; role: string; note?: string }) => {
  const scale = Math.max(s.raw, 10);
  const fill = (Math.min(s.raw, 10) / scale) * 100;
  const over = s.raw > 10 ? ((s.raw - 10) / scale) * 100 : 0;
  return (
    <div className="fo-gauge">
      <div className="flex items-center justify-between gap-2">
        <span className="fo-label">Team {s.side}</span>
        <span className="fo-gauge__read">
          <b>{s.rating}</b>/10
        </span>
      </div>
      <div className="fo-gauge__track" role="img" aria-label={`Team ${s.side} ${s.rating} of 10; the raw sum is ${s.raw.toFixed(1)}`}>
        <span className="fo-gauge__fill" style={{ width: `${fill}%` }} />
        {over > 0 && <span className="fo-gauge__over" style={{ left: `${fill}%`, width: `${over}%` }} />}
        {over > 0 && <span className="fo-gauge__notch" style={{ left: `${fill}%` }} />}
      </div>
      <details className="fo-howto">
        <summary className="fo-gauge__sum">
          {over > 0 ? `${s.raw.toFixed(1)} raw · capped at 10` : `${s.raw.toFixed(1)} raw`}
        </summary>
        <p className="fo-fine mt-1">
          {s.factor} × ({s.stars} key players&apos; stars + {s.coord} {role}) = {s.raw.toFixed(1)}, rounded and capped at 10. {note}
        </p>
      </details>
    </div>
  );
};

const StaffCard = ({ c, s, season, team }: { c: OfficeStaff; s: Strength; season: number; team: string }) => {
  const { ink, dark } = inkOf(team);
  const last = staffFinalSeason(season, c);
  const need = Math.max(1, Math.ceil((s.rating - 0.5) / s.factor - s.stars));
  return (
    <article className="fo-staffcard" aria-label={`${c.role === 'OC' ? 'Offensive' : 'Defensive'} coordinator ${c.name}`}>
      <div className="flex gap-2.5">
        <span className="fo-staffcard__figure" aria-hidden="true">
          <Coach ink={ink} dark={dark} px={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="fo-label">{c.role === 'OC' ? 'Offensive coord.' : 'Defensive coord.'}</p>
          <h4 className="fo-staffcard__name">{c.name}</h4>
          <Stars half={c.rating} />
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className={cn('fo-stamp', c.contract <= 1 && 'is-red')}>
              {c.contract} yr{c.contract === 1 ? '' : 's'} left
            </span>
            <span className="fo-stamp" title="Staff retire on reaching 65">
              Final Y{last}
            </span>
            <span className="fo-stamp is-dim">Age {c.age}</span>
          </div>
        </div>
      </div>
      <StrengthGauge s={s} role={c.role} note={need < c.rating ? `${c.role === 'OC' ? 'An' : 'A'} ${c.role} rated ${need} would still give ${s.rating}.` : undefined} />
    </article>
  );
};

const Coordinators = ({ state, rows }: { state: OfficeState; rows: CapRow[] }) => {
  const staff = state.staff ?? [];
  const strength = teamStrength(rows, staff);
  if (!staff.length) return null;
  const sideOf = (c: OfficeStaff) => strength.find((x) => x.side === (c.role === 'OC' ? 'offense' : 'defense'))!;
  return (
    <Desk
      team={state.club}
      id="fo-staff"
      title="Coordinators"
      chip={
        <Lamp>
          Off <b>{strength[0].rating}</b> · Def <b>{strength[1].rating}</b>
        </Lamp>
      }
      caption={<>Staff are half of team strength: each unit is its key players&apos; stars plus its coordinator, scaled to 10.</>}
      bodyClassName="grid gap-2 sm:grid-cols-2"
    >
      {staff.map((c) => (
        <StaffCard key={c.role} c={c} s={sideOf(c)} season={state.season} team={state.club} />
      ))}
    </Desk>
  );
};

/* ---------------- Front desk ---------------- */

const FrontDesk = ({ state }: { state: OfficeState }) => {
  const st = state.settings;
  const picks = st.draft_picks ?? [];
  return (
    <Desk
      team={state.club}
      id="fo-frontdesk"
      title="Front desk"
      chip={st.difficulty != null && <span className={cn('fo-difficulty', st.difficulty >= 4 && 'is-extreme')}>{DIFFICULTY[st.difficulty] ?? st.difficulty}</span>}
      caption={
        <>
          {st.fans >= 100 ? 'A full house' : `Fans ${st.fans} of 100`} · {st.coach_rating >= 20 ? 'at 20 every club would hire him' : `coach rating ${st.coach_rating} of 20`}
        </>
      }
      bodyClassName="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
    >
      <div className="fo-tile">
        <span className="fo-tile__top">
          <span className="fo-label">Fans</span>
          <span className="fo-tile__read">
            <b>{st.fans}</b>/100
          </span>
        </span>
        <Leds value={st.fans} of={100} segments={10} label="Fan rating" />
      </div>
      <div className="fo-tile">
        <span className="fo-tile__top">
          <span className="fo-label">Coach rating</span>
          <span className="fo-tile__read">
            <b>{st.coach_rating}</b>/20
          </span>
        </span>
        <Leds value={st.coach_rating} of={20} segments={10} label="Coach rating" />
      </div>
      {st.credits != null && (
        <div className="fo-tile">
          <span className="fo-label">Credits</span>
          <span className="flex items-center gap-1.5">
            <PixelIcon id="coin" color="hsl(38 90% 38%)" px={2} />
            <Flaps text={String(st.credits)} label={`${st.credits} credits`} />
          </span>
        </div>
      )}
      {picks.length > 0 && (
        <div className="fo-tile">
          <span className="fo-label">Draft picks</span>
          <span className="flex gap-1" role="list" aria-label="Next draft's picks">
            {picks.map((n, i) => (
              <span role="listitem" key={i}>
                <PickToken round={i + 1} label={`×${n}`} dim={n === 0} title={`${n} ${ordinal(i + 1)}-round pick${n === 1 ? '' : 's'}`} />
              </span>
            ))}
          </span>
        </div>
      )}
      {st.games_coached != null && (
        <div className="fo-tile">
          <span className="fo-label">Games coached</span>
          <Flaps text={fmt(st.games_coached)} label={`${fmt(st.games_coached)} games coached`} />
        </div>
      )}
      {st.training && (
        <div className="fo-tile">
          <span className="fo-label">Training</span>
          <span className="flex flex-wrap gap-1">
            <span className="fo-chiplet">Off · {TRAINING[st.training.offense] ?? st.training.offense}</span>
            <span className="fo-chiplet">Def · {TRAINING[st.training.defense] ?? st.training.defense}</span>
          </span>
        </div>
      )}
    </Desk>
  );
};

/* ---------------- Facilities ---------------- */

/** The club's stadium as a low silhouette behind the buildings. */
const Skyline = () => (
  <svg className="fo-skyline" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M0 24 V16 H6 V12 H14 V9 H26 V7 H94 V9 H106 V12 H114 V16 H120 V24 Z" />
    <rect x="10" y="1" width="2" height="11" />
    <rect x="7" y="0" width="8" height="2" />
    <rect x="108" y="1" width="2" height="11" />
    <rect x="105" y="0" width="8" height="2" />
  </svg>
);

const Facilities = ({ state }: { state: OfficeState }) => {
  const st = state.settings;
  const risks = facilityRisks(st);
  const { ink, dark } = inkOf(state.club);
  const phone = usePhone();
  return (
    <Desk
      team={state.club}
      id="fo-facilities"
      title="Facilities"
      chip={
        st.credits != null && (
          <Lamp>
            <b>{st.credits}</b> credits
          </Lamp>
        )
      }
      caption={
        <details className="fo-howto">
          <summary className="link-chip text-xs text-sky">How decay works</summary>
          <p className="fo-fine mt-1.5 max-w-3xl">
            At every season&apos;s end the game picks one facility at random to lose a level unless it was upgraded that season. Its code lets the training
            roll fall through to rehab, so rehab is at risk two seasons in three and the stadium and training one in three. Level 1 never drops. An upgrade
            costs the new level in credits; re-upgrading a maxed facility costs 10 and still protects it.
          </p>
        </details>
      }
      bodyClassName="grid grid-cols-3 gap-1.5 sm:gap-2"
    >
      {risks.map((f) => {
        const safe = f.risk === 0;
        const odds = f.risk > 0.5 ? '2 in 3' : '1 in 3';
        return (
          <div key={f.id} className={cn('fo-station', !safe && 'is-risk')}>
            <div className="fo-station__lot">
              <Skyline />
              <span className="fo-station__building">
                <Facility id={f.id} ink={ink} dark={dark} lit={f.level >= FACILITY_MAX / 2} px={phone ? 3 : 6} />
                <span className="fo-station__sign" title={safe ? (f.upgradedWeek > 0 ? `Upgraded in week ${f.upgradedWeek}: safe this season` : 'Level 1 never drops') : `${odds} chance it drops a level at the season's end`}>
                  {safe ? <SafeSign px={phone ? 2 : 3} /> : <WarnSign px={phone ? 2 : 3} />}
                </span>
              </span>
            </div>
            <div className="fo-station__info">
              <div className="flex items-baseline justify-between gap-1">
                <span className="fo-station__name">{FACILITY_NAME[f.id]}</span>
                <span className="fo-tile__read">
                  <b>{f.level}</b>/{FACILITY_MAX}
                </span>
              </div>
              <span className="fo-pips" role="img" aria-label={`Level ${f.level} of ${FACILITY_MAX}`}>
                {Array.from({ length: FACILITY_MAX }, (_, i) => (
                  <span key={i} className={cn(i < f.level && 'is-on', !safe && i === f.level - 1 && 'is-risk')} />
                ))}
              </span>
              <span className="fo-station__row">
                <span className={cn('fo-risk', safe ? 'is-safe' : 'is-risk')}>
                  {f.upgradedWeek > 0 ? (phone ? 'Safe' : `Safe · wk ${f.upgradedWeek} upgrade`) : f.level <= 1 ? 'Can’t drop' : phone ? odds : `${odds} at risk`}
                </span>
                {!safe && (
                  <span className="fo-cost">
                    <PixelIcon id="coin" color="hsl(38 90% 38%)" px={1.5} />
                    {phone ? f.cost : `${f.cost} to protect`}
                  </span>
                )}
                <span className="fo-fine max-sm:hidden">{FACILITY_ROLE[f.id]}</span>
              </span>
            </div>
          </div>
        );
      })}
    </Desk>
  );
};

/* ---------------- Franchise counters ---------------- */

const RAFTERS: { tag: string; label: string }[] = [
  { tag: 'ACH_WIN1', label: 'Wins' },
  { tag: 'ACH_UNBEATEN_SEASON', label: 'Unbeaten seasons' },
  { tag: 'ACH_WIN_DIVISION', label: 'Division titles' },
  { tag: 'ACH_TEAMS2', label: 'Clubs taken over' },
];
const GROUP_ICON: Record<string, { icon: PixelIconId; color: string }> = {
  'Roster building': { icon: 'roster', color: 'hsl(199 100% 68%)' },
  Results: { icon: 'results', color: GOLD },
  'Game feats': { icon: 'feats', color: 'hsl(149 64% 50%)' },
  Facilities: { icon: 'facilities', color: 'hsl(354 100% 70%)' },
};

const Counters = ({ state }: { state: OfficeState }) => {
  const counters = state.counters ?? {};
  const team = findNFLTeam(state.club);
  const rafters = RAFTERS.filter((r) => counters[r.tag] != null);
  const shown = new Set([...rafters.map((r) => r.tag), 'ACH_DOINK']);
  return (
    <Desk
      team={state.club}
      id="fo-counters"
      title="Franchise counters"
      chip={<Lamp>Lifetime</Lamp>}
      caption="Tallies the game keeps for the whole career, every club included. Hover or tap a figure for its note."
      bodyClassName="fo-counters"
    >
      <div className="fo-rafters">
        <span className="fo-rafters__beam" aria-hidden="true" />
        <ul className="fo-rafters__row">
          {rafters.map((r) => (
            <li key={r.tag} className="fo-pennant" title={COUNTER_GROUPS.flatMap((g) => g.items).find((i) => i.tag === r.tag)?.note}>
              <span className="fo-pennant__abbr">{team?.abbreviation ?? ''}</span>
              <span className="fo-pennant__n">{fmt(counters[r.tag])}</span>
              <span className="fo-pennant__bar" aria-hidden="true" />
              <span className="fo-pennant__label">{r.label}</span>
            </li>
          ))}
          {counters.ACH_DOINK != null && (
            <li className="fo-doink" title="Field goals off the post">
              <PixelIcon id="post" color={GOLD} px={3} />
              <span>
                <span className="fo-doink__word">Doink!</span>
                <span className="fo-doink__n">×{fmt(counters.ACH_DOINK)}</span>
              </span>
            </li>
          )}
        </ul>
      </div>
      <div className="fo-tickers">
        {COUNTER_GROUPS.map((g) => {
          const items = g.items.filter((it) => counters[it.tag] != null && !shown.has(it.tag));
          if (!items.length) return null;
          const look = GROUP_ICON[g.title] ?? { icon: 'results' as PixelIconId, color: GOLD };
          return (
            <div key={g.title} className="fo-ticker" style={{ ['--wall' as string]: look.color }}>
              <h4 className="fo-ticker__head">
                <PixelIcon id={look.icon} color={look.color} px={2} />
                {g.title}
              </h4>
              <dl className="fo-ticker__list">
                {items.map((it) => (
                  <div key={it.tag} className="fo-ticker__item" title={it.note}>
                    <dt>{it.label}</dt>
                    <dd>{fmt(counters[it.tag])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </Desk>
  );
};

/* ---------------- Section ---------------- */

interface ClubOfficeProps {
  players: Player[];
  onPlayerSelect: (p: Player) => void;
}

const ClubOffice = ({ players, onPlayerSelect }: ClubOfficeProps) => {
  const state = useOfficeState();
  const rows = useMemo(() => (state ? capRows(state) : []), [state]);
  const byKey = useMemo(() => new Map(players.map((p) => [`${p.position}:${p.name}`, p])), [players]);
  if (!state || !rows.length) return null;
  const team = findNFLTeam(state.club);
  const playerFor = (r: CapRow) => byKey.get(r.key);

  return (
    <section aria-labelledby="fo-office" className="fo-panel fo-cabinet space-y-3 p-3 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="fo-office" className="section-title min-w-0 flex-1">
          Club office
        </h2>
        <p className="text-xs text-muted-foreground max-sm:basis-full">
          The {team?.fullName ?? state.club} as the game&apos;s save has them, Y{state.season} week {state.week}.
        </p>
      </div>
      <CapSheet state={state} rows={rows} playerFor={playerFor} onPlayerSelect={onPlayerSelect} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Coordinators state={state} rows={rows} />
        <FrontDesk state={state} />
      </div>
      <Facilities state={state} />
      {state.counters && Object.keys(state.counters).length > 0 && <Counters state={state} />}
    </section>
  );
};

export default ClubOffice;
