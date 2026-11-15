import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import './crashScreen.css';

/**
 * The app's last line of defence: an uncaught render error used to unmount everything and leave a blank page. This
 * catches it and shows the play as a broadcast would: a night stadium (the game's own turf, crowd and stand art when
 * the private sprites are in the build, a CSS stadium otherwise), the jumbotron flashing FUMBLE, a flag on the turf,
 * a player face down and the ball bouncing away. The referee's call is the error itself, "Run it back" reloads, and the
 * Replay booth (open, so a phone screenshot carries everything) holds the message, the page, the browser and the
 * stack. Errors outside React (window error, unhandled promise rejections) are kept too and shown alongside. The last
 * crash is remembered in sessionStorage so it survives the reload button once.
 *
 * It renders outside every provider and must not lean on anything that could itself be what broke: no context, no
 * app modules, only React, its own CSS and static image URLs. Every image sits on a CSS fallback, so a missing file
 * still leaves a stadium.
 */
const LAST = 'retroVault:lastCrash';
const extra: string[] = [];
const note = (s: string) => {
  extra.push(s.slice(0, 400));
  if (extra.length > 5) extra.shift();
};
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => note(`error: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    note(`promise: ${r?.message ?? String(e.reason)} ${(r?.stack ?? '').split('\n').slice(0, 2).join(' | ')}`);
  });
}

const ART = typeof __PRIVATE_SPRITES__ !== 'undefined' && __PRIVATE_SPRITES__;
const BASE = (() => {
  try {
    return import.meta.env.BASE_URL || '/';
  } catch {
    return '/';
  }
})();
const FIELD = `${BASE}private-sprites/field/`;
// The current club's kit (Eagles) on one of the game's own players, face down where the ball came loose
const FALLEN = `${BASE}private-sprites/nfl/100001_014.png`;

// 16 × 9 pixel football (the site's loader ball), drawn here so nothing is imported
const BALL = [
  '.....OOOOOO.....',
  '...OOhhhhhhOO...',
  '.ObWbbbbbbbbWbO.',
  'ObbWbbWbbWbbWbbO',
  'ObbWbWWWWWWbWbbO',
  'ObbWbbWbbWbbWbbO',
  '.ObWbbbbbbbbWbO.',
  '...OObbbbbbOO...',
  '.....OOOOOO.....',
];
// 14 × 9 penalty flag on the turf: Y yellow cloth, y its folds, K the knotted weight
const FLAG = [
  '......KK......',
  '.....KKKK.....',
  'YYYYYyKKyYYYYY',
  'YYYYYYyyYYYYYy',
  'YyYYYYYYYYYYYy',
  'YYyYYYYYYYYyYY',
  'YYYyYYYYYYyYYY',
  'YYYYYYYYYYYYYY',
  '.yyyyyyyyyyyy.',
];
const INK: Record<string, string> = { O: '#2a140a', b: '#9b5426', h: '#c27a3f', W: '#f6ecd9', Y: '#ffd21f', y: '#d9a300', K: '#3a2a0a' };
const pixels = (rows: string[]) =>
  rows.flatMap((row, y) => [...row].flatMap((c, x) => (INK[c] ? [<rect key={`${x}-${y}`} x={x} y={y} width={1.04} height={1.04} fill={INK[c]} />] : [])));
const pixelArt = (rows: string[], className: string) => (
  <svg className={className} viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
    {pixels(rows)}
  </svg>
);

const device = () => {
  try {
    return navigator.userAgent.match(/(iPhone OS [\d_]+|Version\/[\d.]+|Chrome\/[\d.]+|Firefox\/[\d.]+)/g)?.join(' · ') ?? navigator.userAgent.slice(0, 80);
  } catch {
    return '';
  }
};
const page = () => {
  try {
    return location.hash || '#';
  } catch {
    return '';
  }
};

interface State {
  error: Error | null;
  stack: string;
}

export default class CrashScreen extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = [
      ...(error.stack ?? '').split('\n').slice(0, 6),
      '— component —',
      ...(info.componentStack ?? '').split('\n').filter(Boolean).slice(0, 8),
    ].join('\n');
    this.setState({ stack });
    try {
      sessionStorage.setItem(LAST, JSON.stringify({ at: Date.now(), message: error.message, hash: location.hash }));
    } catch {
      // storage unavailable
    }
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    const name = error?.name || 'Error';
    const message = String(error?.message ?? error ?? 'Unknown error');
    const art = ART
      ? ({ '--cr-turf': `url("${FIELD}turf-night.png")`, '--cr-crowd': `url("${FIELD}crowd.png")`, '--cr-stands': `url("${FIELD}stands.png")` } as CSSProperties)
      : undefined;
    return (
      <div className={`cr${ART ? ' cr--art' : ''}`} style={art} role="alert">
        {/* ---- Sky, floodlights and the jumbotron ---- */}
        <section className="cr-sky">
          <span className="cr-tower cr-tower--l" aria-hidden="true">
            <i />
          </span>
          <span className="cr-tower cr-tower--r" aria-hidden="true">
            <i />
          </span>
          <div className="cr-board">
            <div className="cr-board__bulbs" aria-hidden="true" />
            <p className="cr-board__kicker">Retro Vault · Live</p>
            <h1 className="cr-board__word">
              Fumble<span aria-hidden="true">!</span>
            </h1>
            <p className="cr-board__strip" aria-hidden="true">
              <span>4th Qtr</span>
              <b>0:00</b>
              <span>Flag</span>
            </p>
          </div>
        </section>

        {/* ---- The stands ---- */}
        <div className="cr-crowd" aria-hidden="true">
          <span className="cr-crowd__people" />
          <span className="cr-flash" style={{ left: '12%', animationDelay: '0.2s' }} />
          <span className="cr-flash" style={{ left: '31%', animationDelay: '1.4s' }} />
          <span className="cr-flash" style={{ left: '54%', animationDelay: '0.8s' }} />
          <span className="cr-flash" style={{ left: '73%', animationDelay: '2.1s' }} />
          <span className="cr-flash" style={{ left: '90%', animationDelay: '1.1s' }} />
          <span className="cr-crowd__front" />
        </div>

        {/* ---- The field: the play, the call, the replay booth ---- */}
        <section className="cr-field">
          <div className="cr-play" aria-hidden="true">
            {pixelArt(FLAG, 'cr-flag')}
            <span className="cr-fallen">
              {ART && (
                <img
                  src={FALLEN}
                  alt=""
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </span>
            <span className="cr-ball-x">
              <span className="cr-ball-y">
                {pixelArt(BALL, 'cr-ball')}
              </span>
            </span>
          </div>

          <div className="cr-call">
            <p className="cr-call__kicker">
              <span className="cr-call__flag" aria-hidden="true" /> Flag on the play
            </p>
            <h2 className="cr-call__title">The page coughed up the ball.</h2>
            <p className="cr-call__ruling">
              Ruling on the field: <b>{name}</b>
            </p>
            <p className="cr-call__msg">{message}</p>
            <p className="cr-call__meta">
              Spot of the foul <code>{page()}</code>
            </p>
            <div className="cr-actions">
              <button type="button" className="cr-btn" onClick={() => location.reload()}>
                Run it back
              </button>
              <a className="cr-link" href={BASE}>
                Back to the locker room
              </a>
            </div>
          </div>

          <details className="cr-booth" open>
            <summary>
              <span className="cr-booth__rec" aria-hidden="true" /> Replay booth
            </summary>
            <dl className="cr-booth__facts">
              <div>
                <dt>Call</dt>
                <dd>
                  {name}: {message}
                </dd>
              </div>
              <div>
                <dt>Page</dt>
                <dd>{page()}</dd>
              </div>
              <div>
                <dt>Device</dt>
                <dd>{device()}</dd>
              </div>
            </dl>
            <pre className="cr-booth__tape">
              {stack || (error?.stack ?? '').split('\n').slice(0, 6).join('\n')}
              {extra.length ? `\n— also —\n${extra.join('\n')}` : ''}
            </pre>
          </details>
        </section>
      </div>
    );
  }
}
