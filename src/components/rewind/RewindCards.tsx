import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  Quote,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/player";
import { matchPlayerByName } from "@/utils/leagueContent";
import { clubStyle } from "./rewindStyle";
import { useGameSprites } from "@/utils/gameSprites";
import { bannerTeamOf } from "@/utils/playerExtras";
import type {
  RewindCard,
  RewindFigure,
  RewindLink,
  RewindPlayer,
} from "@/utils/seasonRewind";
import { useFieldArt } from "@/components/teamlab/fieldArt";
import GameSprite from "@/components/GameSprite";
import CoachSprite from "@/components/CoachSprite";
import TeamLogo from "@/components/brand/TeamLogo";
import CountUp from "@/components/brand/CountUp";
import { HeatMeter } from "@/components/news/HotTakes";
import { peekProps } from "@/components/peek/peekProps";

/**
 * Season Rewind cards (one per kind, scripts/season_rewind.py builds their data): the card's club colours as its
 * background, the game's field and crowd art painted to that club where the private sprites exist, the players as
 * Retro Bowl sprites in their club's kit (busts for the Hall of Fame and farewells, the champions' team photo in the
 * winner's kit, Skura in his club's polo on the cover). The public build draws the club logos instead (GameSprite and
 * CoachSprite render nothing there). Numbers count up; every entrance is transform and opacity (rewind.css).
 * Names are club-colour strips: a tap opens the card, press and hold is the quick look (data-player-key).
 */

export interface CardProps {
  card: RewindCard;
  season: string;
  players: Player[];
  onPlayer: (p: Player) => void;
  onLink: (link: RewindLink) => void;
}

const playerOf = (p: RewindPlayer, players: Player[]) =>
  matchPlayerByName(p.name, players);

/** A figure, counting up when it carries a number */
export const Fig = ({ f, big }: { f: RewindFigure; big?: boolean }) => (
  <div className={cn("rw-fig", big && "rw-fig--big")}>
    <dd className="rw-fig__v">
      {f.num !== undefined ? (
        <>
          {f.pre}
          <CountUp value={f.num} decimals={f.dec ?? 0} duration={900} />
          {f.suf}
        </>
      ) : (
        f.value
      )}
    </dd>
    <dt className="rw-fig__l">{f.label}</dt>
  </div>
);

const Figs = ({
  figs,
  className,
}: {
  figs?: RewindFigure[];
  className?: string;
}) =>
  figs?.length ? (
    <dl className={cn("rw-figs", className)} data-n={figs.length}>
      {figs.map((f) => (
        <Fig key={f.label} f={f} />
      ))}
    </dl>
  ) : null;

/** A clickable name: a strip in his club's colours (tap: his card; hold: the quick look) */
export const NameStrip = ({
  p,
  players,
  onPlayer,
  sub,
}: {
  p: RewindPlayer;
  players: Player[];
  onPlayer: (p: Player) => void;
  sub?: ReactNode;
}) => {
  const pl = playerOf(p, players);
  const team = p.team ?? (pl ? bannerTeamOf(pl) : undefined);
  const body = (
    <>
      {team && (
        <TeamLogo
          team={team}
          size={18}
          decorative
          backed
          className="rw-strip__logo"
        />
      )}
      <span className="rw-strip__text">
        <span className="rw-strip__name">{p.name}</span>
        {sub && <span className="rw-strip__sub">{sub}</span>}
      </span>
    </>
  );
  if (!pl)
    return (
      <span className="rw-strip" style={clubStyle(team)}>
        {body}
      </span>
    );
  return (
    <button
      type="button"
      className="rw-strip"
      style={clubStyle(team)}
      {...peekProps(pl)}
      onClick={() => onPlayer(pl)}
      aria-label={`Open ${pl.name}'s card`}
    >
      {body}
      <ChevronRight className="rw-strip__go h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
};

/** His sprite in a kit, or (public build) his club's logo on the same footprint */
const Figure = ({
  p,
  players,
  size = "m",
  kind = "figure",
  action,
  className,
}: {
  p: RewindPlayer;
  players: Player[];
  size?: "s" | "m" | "l";
  kind?: "figure" | "bust";
  action?: "celebrate" | "stiffarm" | "run";
  className?: string;
}) => {
  const sprites = useGameSprites();
  const pl = playerOf(p, players);
  const team = p.team ?? (pl ? bannerTeamOf(pl) : undefined);
  if (sprites && pl)
    return (
      <GameSprite
        player={pl}
        team={team}
        kind={kind}
        size={size}
        action={action}
        className={cn("rw-sprite", className)}
        peek
      />
    );
  const px = { s: 40, m: 64, l: 96 }[size];
  return (
    <span
      className={cn("rw-logo-fig", className)}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      <TeamLogo team={team} size={Math.round(px * 0.8)} decorative />
    </span>
  );
};

/** The game's own crowd and turf, painted to the club (nothing in the public build: the CSS field shows) */
const Field = ({ club, night = true }: { club: string; night?: boolean }) => {
  const art = useFieldArt(club, night ? "night" : "day");
  return (
    <div
      className={cn("rw-field", art.turf && "rw-field--art")}
      aria-hidden="true"
    >
      {art.crowd && <img src={art.crowd} alt="" className="rw-field__crowd" />}
      {art.stands && (
        <img src={art.stands} alt="" className="rw-field__stands" />
      )}
      {art.turf ? (
        <img src={art.turf} alt="" className="rw-field__turf" />
      ) : (
        <span className="rw-field__css" />
      )}
    </div>
  );
};

const LinkButton = ({
  link,
  onLink,
  children,
}: {
  link?: RewindLink;
  onLink: (l: RewindLink) => void;
  children: ReactNode;
}) =>
  link ? (
    <button type="button" className="rw-link" onClick={() => onLink(link)}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  ) : null;

const Cover = ({ card, season }: CardProps) => {
  const club = card.club ?? "";
  const sprites = useGameSprites();
  const yr = season.replace(/\D/g, "");
  return (
    <>
      <div className="rw-cover__mark" aria-hidden="true">
        <TeamLogo team={club} size={220} decorative />
      </div>
      <h2
        className="rw-cover__title rw-in"
        style={{ "--d": 1 } as CSSProperties}
      >
        <span className="rw-cover__y">Y{yr}</span>
        <span className="rw-cover__word">Rewind</span>
      </h2>
      <p className="rw-cover__club rw-in" style={{ "--d": 2 } as CSSProperties}>
        <TeamLogo team={club} size={22} decorative /> {club}
      </p>
      <Figs figs={card.figures} className="rw-in" />
      <div className="rw-stage">
        <Field club={club} />
        <div className="rw-stage__cast">
          {sprites ? (
            <CoachSprite
              who="head"
              team={club}
              size="l"
              className="rw-coach"
              title="Head coach Dorren Skura"
            />
          ) : (
            <TeamLogo
              team={club}
              size={120}
              decorative
              className="rw-cover__logo"
            />
          )}
        </div>
      </div>
    </>
  );
};

const Champion = ({ card, players }: CardProps) => {
  const [w, l] = card.teams;
  const [fw, fl, ...rest] = card.figures ?? [];
  const ps = card.players ?? [];
  const star = ps.find((p) => p.star) ?? ps[0];
  const others = ps.filter((p) => p !== star);
  // two flank the star in the front row; the rest stand behind, smaller
  const flank = others.slice(0, 2);
  const back = others.slice(2);
  return (
    <>
      <div className="rw-score rw-in" style={{ "--d": 1 } as CSSProperties}>
        <span className="rw-score__side">
          <TeamLogo team={w} size={56} decorative />
          {fw && <Fig f={fw} big />}
        </span>
        <span className="rw-score__dash" aria-hidden="true">
          –
        </span>
        <span className="rw-score__side rw-score__side--lose">
          {fl && <Fig f={fl} big />}
          <TeamLogo team={l} size={44} decorative />
        </span>
      </div>
      <Figs figs={rest} className="rw-in" />
      {star && (
        <div className="rw-stage rw-stage--photo">
          <Field club={w} />
          <div className="rw-photo">
            <div className="rw-photo__row rw-photo__row--back">
              {back.map((p) => (
                <Figure key={p.key} p={p} players={players} size="s" />
              ))}
            </div>
            <div className="rw-photo__row">
              {flank[0] && <Figure p={flank[0]} players={players} size="m" />}
              <Figure
                p={star}
                players={players}
                size="l"
                action="celebrate"
                className="rw-photo__star"
              />
              {flank[1] && <Figure p={flank[1]} players={players} size="m" />}
            </div>
          </div>
        </div>
      )}
      {star && (
        <p className="rw-caption">
          Front and centre: <b>{star.name}</b> · {card.ringHolders} ring holders
          on cards
        </p>
      )}
    </>
  );
};

const Awards = ({ card, players, onPlayer }: CardProps) => (
  <ul className="rw-podium" data-n={card.players?.length}>
    {(card.players ?? []).map((p, i) => (
      <li
        key={`${p.award}-${p.key}`}
        className="rw-pedestal rw-in"
        style={{ ...clubStyle(p.team), "--d": i + 1 } as CSSProperties}
      >
        <span className="rw-award">{p.award}</span>
        <Figure
          p={p}
          players={players}
          size="m"
          action={p.award === "MVP" ? "celebrate" : undefined}
        />
        <span className="rw-pedestal__block" aria-hidden="true" />
        <NameStrip
          p={p}
          players={players}
          onPlayer={onPlayer}
          sub={p.awardName}
        />
        {p.figures?.[0] && <Fig f={p.figures[0]} />}
        {(p.figures?.length ?? 0) > 1 || p.games ? (
          <span className="rw-pedestal__line">
            {[
              ...(p.figures ?? []).slice(1).map((f) => `${f.value} ${f.label}`),
              p.games ? `${p.games} games` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </li>
    ))}
  </ul>
);

const Records = ({ card, players, onPlayer }: CardProps) => {
  const holders = (card.players ?? []).slice(0, 3);
  return (
    <>
      <ul className="rw-rows">
        {(card.rows ?? []).map((r, i) => (
          <li
            key={r.label}
            className="rw-row rw-in"
            style={{ ...clubStyle(r.team), "--d": i + 1 } as CSSProperties}
          >
            <span className="rw-row__mark">
              {r.num !== undefined ? (
                <>
                  <CountUp value={r.num} duration={1000} />
                  {r.suf}
                </>
              ) : (
                r.mark
              )}
            </span>
            <span className="rw-row__label">
              {r.label}
              <i>{r.scope === "club" ? " · club record board" : " · league"}</i>
            </span>
            {r.players.map((p) => (
              <NameStrip
                key={p.key}
                p={p}
                players={players}
                onPlayer={onPlayer}
                sub={r.note}
              />
            ))}
          </li>
        ))}
      </ul>
      {holders.length > 0 && (card.rows?.length ?? 0) <= 3 && (
        <div className="rw-stage rw-stage--low">
          <Field club={holders[0].team ?? card.club ?? ""} />
          <div className="rw-stage__cast rw-stage__cast--row">
            {holders.map((p) => (
              <Figure
                key={p.key}
                p={p}
                players={players}
                size="m"
                action="stiffarm"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const Milestones = ({ card, players, onPlayer }: CardProps) => {
  const [first, ...rest] = card.players ?? [];
  if (!first) return null;
  return (
    <>
      {card.gauntlet && (
        <div className="rw-stage rw-stage--solo">
          <Field club={first.team ?? card.club ?? ""} />
          <div className="rw-stage__cast">
            <Figure p={first} players={players} size="l" action="stiffarm" />
          </div>
          <ul className="rw-medals" aria-label="The Gauntlet">
            {[
              "Ring",
              "MVP",
              first.note?.includes("DPOY") ? "DPOY" : "OPOY",
              "ROTY",
              "SB MVP",
            ].map((m, i) => (
              <li
                key={m}
                className="rw-medal rw-in"
                style={{ "--d": i + 2 } as CSSProperties}
              >
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="rw-rows">
        {(card.gauntlet ? [first, ...rest] : [first, ...rest]).map((p, i) => (
          <li
            key={p.key}
            className="rw-row rw-row--ms rw-in"
            style={{ ...clubStyle(p.team), "--d": i + 1 } as CSSProperties}
          >
            {!card.gauntlet && (
              <Figure p={p} players={players} size="s" kind="bust" />
            )}
            <span className="rw-row__label">{p.label}</span>
            <NameStrip
              p={p}
              players={players}
              onPlayer={onPlayer}
              sub={p.note}
            />
          </li>
        ))}
      </ul>
    </>
  );
};

const Market = ({ card, players, onPlayer }: CardProps) => (
  <div className="rw-market">
    {(card.players ?? []).map((p, i) => {
      const up = (p.pct ?? 0) > 0;
      return (
        <div
          key={p.key}
          className={cn(
            "rw-mover rw-in",
            up ? "rw-mover--up" : "rw-mover--down",
          )}
          style={{ ...clubStyle(p.team), "--d": i + 1 } as CSSProperties}
        >
          <span className="rw-mover__tag">
            {up ? (
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
            )}{" "}
            {p.label}
          </span>
          <Figure
            p={p}
            players={players}
            size="l"
            action={up ? "run" : undefined}
          />
          <span className="rw-mover__pct">
            {up ? "+" : "−"}
            <CountUp value={Math.abs(p.pct ?? 0)} duration={1000} />%
          </span>
          <span className="rw-mover__val">
            {p.was?.toLocaleString("en-US")} →{" "}
            {p.value?.toLocaleString("en-US")} coins
            {p.ovr ? ` · CAR ${p.ovr}` : ""}
            {p.grade ? ` · ${p.grade}` : ""}
          </span>
          <NameStrip p={p} players={players} onPlayer={onPlayer} />
        </div>
      );
    })}
  </div>
);

const Busts = ({
  card,
  players,
  onPlayer,
  hof,
}: CardProps & { hof?: boolean }) => (
  <>
    <ul
      className={cn("rw-busts", hof ? "rw-busts--hof" : "rw-busts--bye")}
      data-n={card.players?.length}
    >
      {(card.players ?? []).map((p, i) => (
        <li
          key={p.key}
          className="rw-bust rw-in"
          style={{ ...clubStyle(p.team), "--d": i + 1 } as CSSProperties}
        >
          <span className="rw-bust__frame">
            <Figure p={p} players={players} size="m" kind="bust" />
          </span>
          <NameStrip
            p={p}
            players={players}
            onPlayer={onPlayer}
            sub={
              hof
                ? [
                    p.firstBallot && "First ballot",
                    p.legacy &&
                      `Career Legacy ${p.legacy.toLocaleString("en-US")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : [p.games && `${p.games} games`, p.rings && `${p.rings} rings`]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
        </li>
      ))}
    </ul>
    {card.count && card.players && card.count > card.players.length && (
      <p className="rw-caption">and {card.count - card.players.length} more</p>
    )}
  </>
);

const Power = ({ card }: CardProps) => (
  <>
    <div className="rw-power rw-in" style={{ "--d": 1 } as CSSProperties}>
      <span className="rw-power__no">
        No.<b>1</b>
      </span>
      <TeamLogo team={card.club} size={96} decorative />
    </div>
    <Figs figs={card.figures} className="rw-in" />
    {card.upset && (
      <div className="rw-upset rw-in" style={{ "--d": 4 } as CSSProperties}>
        <p className="rw-upset__k">
          Upset of the year · week {card.upset.week}
        </p>
        <div className="rw-upset__vs">
          <span style={clubStyle(card.upset.winner)} className="rw-upset__club">
            <TeamLogo team={card.upset.winner} size={36} decorative />
            {card.upset.winner}
            <i>{card.upset.winnerRecord}</i>
          </span>
          <b>{card.upset.score}</b>
          <span
            style={clubStyle(card.upset.loser)}
            className="rw-upset__club rw-upset__club--lose"
          >
            <TeamLogo team={card.upset.loser} size={36} decorative />
            {card.upset.loser}
            <i>{card.upset.loserRecord}</i>
          </span>
        </div>
      </div>
    )}
  </>
);

/** A lasting rivalry's notable season: the two clubs squared up, that season's meetings, the series, its file */
const Rivalry = ({ card, onLink }: CardProps) => {
  const [a, b] = card.teams;
  return (
    <>
      <div className="rw-upset rw-in" style={{ "--d": 1 } as CSSProperties}>
        <div className="rw-upset__vs">
          <span style={clubStyle(a)} className="rw-upset__club">
            <TeamLogo team={a} size={44} decorative />
            {a}
          </span>
          <b>vs</b>
          <span style={clubStyle(b)} className="rw-upset__club">
            <TeamLogo team={b} size={44} decorative />
            {b}
          </span>
        </div>
      </div>
      {!!card.meetings?.length && (
        <ul className="rw-rival rw-in" style={{ "--d": 2 } as CSSProperties}>
          {card.meetings.map((m) => (
            <li
              key={m.week}
              className={cn("rw-rival__m", m.result === "W" ? "rw-rival__m--a" : m.result === "L" ? "rw-rival__m--b" : "")}
              style={clubStyle(m.result === "L" ? b : a)}
            >
              <b>
                {m.for}-{m.against}
              </b>
              <span>{/^Week/.test(m.round) ? `Week ${m.week}` : m.round}</span>
            </li>
          ))}
        </ul>
      )}
      <Figs figs={card.figures} className="rw-in" />
      <LinkButton link={card.link} onLink={onLink}>
        Open the rivalry file
      </LinkButton>
    </>
  );
};

const Tribute = ({ card, players, onPlayer, onLink }: CardProps) => {
  const p = card.players?.[0];
  if (!p) return null;
  return (
    <>
      <div className="rw-stage rw-stage--solo">
        <Field club={p.team ?? card.club ?? ""} night={false} />
        <div className="rw-stage__cast">
          <Figure p={p} players={players} size="l" action="celebrate" />
        </div>
      </div>
      <NameStrip p={p} players={players} onPlayer={onPlayer} sub={p.line} />
      <Figs figs={p.figures} className="rw-in" />
      <LinkButton link={card.link} onLink={onLink}>
        Read the tribute
      </LinkButton>
    </>
  );
};

const Quoted = ({ card, players, onPlayer, onLink }: CardProps) => (
  <>
    {card.kind === "take" && card.heat && (
      <HeatMeter heat={Math.min(3, Math.max(1, card.heat)) as 1 | 2 | 3} big />
    )}
    <blockquote
      className="rw-quote rw-in"
      style={{ "--d": 1 } as CSSProperties}
    >
      <Quote className="rw-quote__mark" aria-hidden="true" />
      <p>{card.title}</p>
    </blockquote>
    {card.text && <p className="rw-text rw-in">{card.text}</p>}
    <div className="rw-strips">
      {(card.players ?? []).map((p) => (
        <NameStrip key={p.key} p={p} players={players} onPlayer={onPlayer} />
      ))}
    </div>
    <div className="rw-busts-line" aria-hidden="true">
      {(card.players ?? []).slice(0, 3).map((p) => (
        <Figure key={p.key} p={p} players={players} size="m" />
      ))}
    </div>
    <LinkButton link={card.link} onLink={onLink}>
      {card.kind === "take" ? "Read the take" : "Read the story"}
    </LinkButton>
  </>
);

const Outro = ({ card, season, players, onPlayer, onLink }: CardProps) => {
  const sprites = useGameSprites();
  const club = card.club ?? "";
  return (
    <>
      <h2
        className="rw-cover__title rw-in"
        style={{ "--d": 1 } as CSSProperties}
      >
        <span className="rw-cover__word">Next</span>
        <span className="rw-cover__y">{card.next}</span>
      </h2>
      <Figs figs={card.figures} className="rw-in" />
      {card.live && (
        <p className="rw-caption">
          Live: the {card.live.club} are {card.live.record} after week{" "}
          {card.live.week}
        </p>
      )}
      {!!card.players?.length && (
        <ul className="rw-rows">
          {card.players.map((p, i) => (
            <li
              key={p.key}
              className="rw-row rw-row--ms rw-in"
              style={{ ...clubStyle(p.team), "--d": i + 2 } as CSSProperties}
            >
              <span className="rw-row__mark">
                <CountUp value={p.gap ?? 0} duration={900} />
              </span>
              <span className="rw-row__label">
                {p.label?.replace("career ", "")} from {p.holder}&apos;s mark (
                {p.share}% there)
              </span>
              <NameStrip p={p} players={players} onPlayer={onPlayer} />
            </li>
          ))}
        </ul>
      )}
      <div className="rw-stage rw-stage--low">
        <Field club={club} />
        <div className="rw-stage__cast">
          {sprites && (
            <CoachSprite who="head" team={club} size="m" className="rw-coach" />
          )}
        </div>
      </div>
      <LinkButton link={card.link} onLink={onLink}>
        Watch the {card.next} Rewind
      </LinkButton>
      <span className="sr-only">End of the {season} Rewind</span>
    </>
  );
};

const BODY: Record<RewindCard["kind"], (p: CardProps) => JSX.Element | null> = {
  cover: Cover,
  champion: Champion,
  awards: Awards,
  records: Records,
  milestones: Milestones,
  market: Market,
  hof: (p) => <Busts {...p} hof />,
  farewells: (p) => <Busts {...p} />,
  power: Power,
  rivalry: Rivalry,
  tribute: Tribute,
  story: Quoted,
  take: Quoted,
  outro: Outro,
};

/** One card: the club-colour backdrop, the kicker and title, the kind's body, the template sentence */
export const RewindCardView = (props: CardProps) => {
  const { card } = props;
  const Body = BODY[card.kind];
  const titled = !["cover", "story", "take", "outro"].includes(card.kind);
  return (
    <article
      className={cn("rw-card", `rw-card--${card.kind}`)}
      style={clubStyle(card.club)}
      aria-roledescription="slide"
      aria-label={`${card.kicker}: ${card.title}`}
    >
      <div className="rw-bg" aria-hidden="true" />
      <p className="rw-kicker rw-in">{card.kicker}</p>
      {titled && (
        <h2 className="rw-title rw-in" style={{ "--d": 1 } as CSSProperties}>
          {card.title}
        </h2>
      )}
      <div className="rw-body">
        <Body {...props} />
      </div>
      {card.text && !card.quoted && (
        <p className="rw-text rw-in" style={{ "--d": 3 } as CSSProperties}>
          {card.text}
        </p>
      )}
    </article>
  );
};
