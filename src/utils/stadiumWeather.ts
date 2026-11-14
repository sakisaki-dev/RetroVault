/**
 * Stadium weather odds from the game's own rule (docs/SAVE_INVENTORY.md 7.13), over each club's stadium figures in
 * the save (save_state.json clubs: rainfall, snowfall, roof). The home club's stadium decides a game's weather:
 *
 *   weeks 1-11:   rain if irandom(200) < rainfall
 *   weeks 12-18:  rain as above, else snow if 1 + irandom(150) < snowfall
 *   playoffs:     snow if 1 + irandom(100) < snowfall, else rain as above
 *   roof 1 or 2 covers the field; no weather in year 1 or the Super Bowl (and only with the weather option on)
 *
 * irandom(n) is a whole number from 0 to n, so the chances are rainfall / 201, (snowfall - 1) / 151 and
 * (snowfall - 1) / 101, each clamped to 0..1. Philadelphia (47 / 15): rain 23% early; rain 23% and snow 7% late;
 * snow 14% and rain 20% in a home playoff game.
 */

export interface StadiumFigures {
  rainfall?: number;
  snowfall?: number;
  /** 0 open air, 1 and 2 covered */
  roof?: number;
}

export interface WeatherPhase {
  key: 'early' | 'late' | 'playoffs';
  label: string;
  /** 0..1 */
  rain: number;
  /** 0..1 */
  snow: number;
}

export interface StadiumWeather {
  covered: boolean;
  rainfall: number;
  snowfall: number;
  /** Empty when the roof covers the field */
  phases: WeatherPhase[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** The odds for one stadium, or null when the save has no figures for it. */
export const stadiumWeather = (club: StadiumFigures | null | undefined): StadiumWeather | null => {
  if (!club || typeof club.rainfall !== 'number' || typeof club.snowfall !== 'number') return null;
  const covered = (club.roof ?? 0) > 0;
  const rain = clamp01(club.rainfall / 201);
  const snowLate = clamp01((club.snowfall - 1) / 151);
  const snowPlayoff = clamp01((club.snowfall - 1) / 101);
  return {
    covered,
    rainfall: club.rainfall,
    snowfall: club.snowfall,
    phases: covered
      ? []
      : [
          { key: 'early', label: 'Weeks 1–11', rain, snow: 0 },
          { key: 'late', label: 'Weeks 12–18', rain, snow: (1 - rain) * snowLate },
          { key: 'playoffs', label: 'Home playoff', rain: (1 - snowPlayoff) * rain, snow: snowPlayoff },
        ],
  };
};

/** "23%", "<1%" for a sliver, "0%" for none. */
export const pctText = (p: number) => (p <= 0 ? '0%' : p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);
