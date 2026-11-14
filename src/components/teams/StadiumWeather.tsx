import { CloudRain, Snowflake, Warehouse } from 'lucide-react';
import { useSaveState } from '@/components/clock/saveData';
import { pctText, stadiumWeather, type StadiumFigures } from '@/utils/stadiumWeather';
import './stadiumWeather.css';

/**
 * A club's stadium weather odds on its franchise sheet: the game's own rule (src/utils/stadiumWeather.ts) over the
 * stadium figures in the save (save_state.json clubs). Nothing shows without a save state or figures for the club.
 */
const StadiumWeather = ({ teamName, accent }: { teamName: string; accent?: string }) => {
  const save = useSaveState();
  const club = save?.clubs?.[teamName] as StadiumFigures | undefined;
  const w = stadiumWeather(club);
  if (!w) return null;
  return (
    <section aria-labelledby="stadium-weather" className="swx" style={accent ? ({ '--swx-accent': accent } as React.CSSProperties) : undefined}>
      <h3 id="stadium-weather" className="section-title text-base mb-2">
        Stadium weather
        <span className={w.covered ? 'swx-roof swx-roof--on' : 'swx-roof'}>
          {w.covered ? (
            <>
              <Warehouse className="h-3 w-3" aria-hidden="true" /> Roof
            </>
          ) : (
            'Open air'
          )}
        </span>
      </h3>
      {w.covered ? (
        <p className="swx-note">The roof covers the field: every home game here is played dry.</p>
      ) : (
        <>
          <ul className="swx-grid" aria-label="Chance of weather in a home game">
            {w.phases.map((p) => (
              <li key={p.key} className="swx-cell" aria-label={`${p.label}: rain ${pctText(p.rain)}, snow ${pctText(p.snow)}`}>
                <span className="swx-k" aria-hidden="true">
                  {p.label}
                </span>
                <span className="swx-row" aria-hidden="true">
                  <CloudRain className="swx-ic swx-ic--rain" />
                  <span className="swx-bar">
                    <i className="swx-fill swx-fill--rain" style={{ width: `${Math.round(p.rain * 100)}%` }} />
                  </span>
                  <b className="num">{pctText(p.rain)}</b>
                </span>
                <span className="swx-row" aria-hidden="true">
                  <Snowflake className="swx-ic swx-ic--snow" />
                  <span className="swx-bar">
                    <i className="swx-fill swx-fill--snow" style={{ width: `${Math.round(p.snow * 100)}%` }} />
                  </span>
                  <b className="num">{pctText(p.snow)}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className="swx-note">
            The game's odds for a home game here, from its stadium figures (rain {w.rainfall}, snow {w.snowfall}). Snow only
            falls from week 12; the Super Bowl is always dry.
          </p>
        </>
      )}
    </section>
  );
};

export default StadiumWeather;
