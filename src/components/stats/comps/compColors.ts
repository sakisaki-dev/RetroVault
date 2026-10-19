import { findNFLTeam } from '@/utils/nflTeams';
import { liftForDarkBg } from '@/utils/teamColors';
import { VIZ } from '../analytics/viz';

const parse = (css: string): [number, number, number] | null => {
  const m = css.match(/(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const hexHue = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s * 100, l * 100];
};

const hsl = (css: string) => (css.startsWith('#') ? hexHue(css) : parse(css));

/** Perceptual-ish distance between two colors: hue gap for saturated colors, lightness gap otherwise. */
const apart = (a: string, b: string) => {
  const x = hsl(a);
  const y = hsl(b);
  if (!x || !y) return true;
  if (x[1] < 22 || y[1] < 22) return Math.abs(x[2] - y[2]) > 22 || (x[1] < 22) !== (y[1] < 22);
  const dh = Math.abs(x[0] - y[0]) % 360;
  return Math.min(dh, 360 - dh) >= 45;
};

/** A team's colors lifted so they read on the dark surface (fallback: chart blue / orange). */
export const teamVizColors = (team?: string | null, minLightness = 55) => {
  const t = findNFLTeam(team);
  return t ? [liftForDarkBg(t.primaryColor, minLightness), liftForDarkBg(t.secondaryColor, minLightness)] : [];
};

/** Fill and ring for a map dot. */
export const dotColors = (team?: string | null) => {
  const t = findNFLTeam(team);
  if (!t) return { fill: VIZ.muted, ring: VIZ.axis };
  return { fill: liftForDarkBg(t.primaryColor, 42), ring: liftForDarkBg(t.secondaryColor, 55) };
};

/**
 * Colors for the radar: the player in his team color, the overlay in the comp's team color, falling back to the
 * comp's secondary color or the chart palette whenever the two would be hard to tell apart.
 */
export const radarPair = (playerTeam?: string | null, compTeam?: string | null) => {
  const main = teamVizColors(playerTeam)[0] ?? VIZ.series[0];
  const sameTeam = !!playerTeam && findNFLTeam(playerTeam)?.id === findNFLTeam(compTeam)?.id;
  const candidates = [...(sameTeam ? [] : teamVizColors(compTeam)), VIZ.series[0], VIZ.series[2], VIZ.series[1], '#f5c542'];
  const comp = candidates.find((c) => apart(main, c)) ?? VIZ.series[1];
  return { main, comp };
};
