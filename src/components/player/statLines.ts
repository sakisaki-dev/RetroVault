import type { Player } from '@/types/player';
import { passerRating } from '@/config/advanced';

export interface StatItem {
  /** Stable id (used as React key) */
  key: string;
  label: string;
  /** Long form for screen readers / tooltips */
  title: string;
  /** null = not enough data (shown as an em dash) */
  value: number | null;
  decimals?: number;
  suffix?: string;
}

/** n / d (optionally scaled), or null when the denominator is zero. */
export const rate = (n: number, d: number, scale = 1): number | null => (d > 0 ? (n / d) * scale : null);

const num = (p: Player, key: string): number => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

const s = (key: string, label: string, title: string, value: number | null, decimals = 0, suffix?: string): StatItem => ({
  key,
  label,
  title,
  value,
  decimals,
  suffix,
});

/** Every career total the sheet tracks for the player's position. */
export const careerTotals = (p: Player): StatItem[] => {
  const g = s('games', 'GP', 'Games played', p.games);
  switch (p.position) {
    case 'QB':
      return [
        g,
        s('completions', 'CMP', 'Completions', p.completions),
        s('attempts', 'ATT', 'Pass attempts', p.attempts),
        s('passYds', 'PASS YDS', 'Passing yards', p.passYds),
        s('passTD', 'PASS TD', 'Passing touchdowns', p.passTD),
        s('interceptions', 'INT', 'Interceptions thrown', p.interceptions),
        s('sacks', 'SACKED', 'Times sacked', p.sacks),
        s('rushAtt', 'RUSH ATT', 'Rushing attempts', p.rushAtt),
        s('rushYds', 'RUSH YDS', 'Rushing yards', p.rushYds),
        s('rushTD', 'RUSH TD', 'Rushing touchdowns', p.rushTD),
      ];
    case 'RB':
      return [
        g,
        s('rushAtt', 'CAR', 'Carries', p.rushAtt),
        s('rushYds', 'RUSH YDS', 'Rushing yards', p.rushYds),
        s('rushTD', 'RUSH TD', 'Rushing touchdowns', p.rushTD),
        s('receptions', 'REC', 'Receptions', p.receptions),
        s('recYds', 'REC YDS', 'Receiving yards', p.recYds),
        s('recTD', 'REC TD', 'Receiving touchdowns', p.recTD),
        s('scrim', 'SCRIM YDS', 'Scrimmage yards (rush + receiving)', p.rushYds + p.recYds),
        s('totTD', 'TOT TD', 'Total touchdowns (rush + receiving)', p.rushTD + p.recTD),
        s('fumbles', 'FUM', 'Fumbles', p.fumbles),
      ];
    case 'WR':
    case 'TE':
      return [
        g,
        s('receptions', 'REC', 'Receptions', p.receptions),
        s('recYds', 'REC YDS', 'Receiving yards', p.recYds),
        s('recTD', 'REC TD', 'Receiving touchdowns', p.recTD),
        s('longest', 'LNG', 'Longest reception', p.longest),
        s('fumbles', 'FUM', 'Fumbles', p.fumbles),
      ];
    case 'OL':
      return [g, s('blocks', 'BLK', 'Blocks', p.blocks)];
    default:
      return [
        g,
        s('tackles', 'TKL', 'Tackles', num(p, 'tackles')),
        s('sacks', 'SACK', 'Sacks', num(p, 'sacks')),
        s('interceptions', 'INT', 'Interceptions', num(p, 'interceptions')),
        s('forcedFumbles', 'FF', 'Forced fumbles', num(p, 'forcedFumbles')),
        s('takeaways', 'TKA', 'Takeaways (INT + FF)', num(p, 'interceptions') + num(p, 'forcedFumbles')),
      ];
  }
};

/** Efficiency and per-game rates, computed from career totals. */
export const careerRates = (p: Player): StatItem[] => {
  const g = p.games;
  switch (p.position) {
    case 'QB':
      return [
        s('cmpPct', 'CMP%', 'Completion percentage', rate(p.completions, p.attempts, 100), 1),
        s('ypa', 'Y/A', 'Yards per pass attempt', rate(p.passYds, p.attempts), 2),
        s('passYdsG', 'PASS YDS/G', 'Passing yards per game', rate(p.passYds, g), 1),
        s('attG', 'ATT/G', 'Pass attempts per game', rate(p.attempts, g), 1),
        s('tdPer16', 'TD/16G', 'Passing touchdowns per 16 games', rate(p.passTD, g, 16), 1),
        s('intPer16', 'INT/16G', 'Interceptions per 16 games', rate(p.interceptions, g, 16), 1),
        s('tdInt', 'TD:INT', 'Touchdowns per interception', rate(p.passTD, p.interceptions), 2),
        s('sackPct', 'SACK%', 'Sacks per dropback (sacks ÷ attempts + sacks)', rate(p.sacks, p.attempts + p.sacks, 100), 1),
        s('rushYpc', 'RUSH Y/A', 'Yards per rushing attempt', rate(p.rushYds, p.rushAtt), 1),
        s('rushYdsG', 'RUSH YDS/G', 'Rushing yards per game', rate(p.rushYds, g), 1),
        s('totTD16', 'TOT TD/16G', 'Passing + rushing touchdowns per 16 games', rate(p.passTD + p.rushTD, g, 16), 1),
      ];
    case 'RB':
      return [
        s('ypc', 'Y/C', 'Yards per carry', rate(p.rushYds, p.rushAtt), 2),
        s('carG', 'CAR/G', 'Carries per game', rate(p.rushAtt, g), 1),
        s('rushG', 'RUSH YDS/G', 'Rushing yards per game', rate(p.rushYds, g), 1),
        s('recG', 'REC/G', 'Receptions per game', rate(p.receptions, g), 1),
        s('recYdsG', 'REC YDS/G', 'Receiving yards per game', rate(p.recYds, g), 1),
        s('scrimG', 'SCRIM/G', 'Scrimmage yards per game', rate(p.rushYds + p.recYds, g), 1),
        s('ypr', 'Y/R', 'Yards per reception', rate(p.recYds, p.receptions), 1),
        s('tdPer16', 'TD/16G', 'Total touchdowns per 16 games', rate(p.rushTD + p.recTD, g, 16), 1),
        s('fumPer16', 'FUM/16G', 'Fumbles per 16 games', rate(p.fumbles, g, 16), 1),
      ];
    case 'WR':
    case 'TE':
      return [
        s('recG', 'REC/G', 'Receptions per game', rate(p.receptions, g), 1),
        s('ydsG', 'YDS/G', 'Receiving yards per game', rate(p.recYds, g), 1),
        s('ypr', 'Y/R', 'Yards per reception', rate(p.recYds, p.receptions), 1),
        s('tdPer16', 'TD/16G', 'Receiving touchdowns per 16 games', rate(p.recTD, g, 16), 1),
        s('tdPct', 'TD/REC%', 'Touchdowns per 100 receptions', rate(p.recTD, p.receptions, 100), 1),
        s('fumPer16', 'FUM/16G', 'Fumbles per 16 games', rate(p.fumbles, g, 16), 1),
      ];
    case 'OL':
      return [
        s('blkG', 'BLK/G', 'Blocks per game', rate(p.blocks, g), 2),
        s('blk16', 'BLK/16G', 'Blocks per 16 games', rate(p.blocks, g, 16), 1),
      ];
    default: {
      const t = num(p, 'tackles');
      const sk = num(p, 'sacks');
      const i = num(p, 'interceptions');
      const ff = num(p, 'forcedFumbles');
      return [
        s('tklG', 'TKL/G', 'Tackles per game', rate(t, g), 2),
        s('tkl16', 'TKL/16G', 'Tackles per 16 games', rate(t, g, 16), 1),
        s('sack16', 'SACK/16G', 'Sacks per 16 games', rate(sk, g, 16), 1),
        s('int16', 'INT/16G', 'Interceptions per 16 games', rate(i, g, 16), 1),
        s('ff16', 'FF/16G', 'Forced fumbles per 16 games', rate(ff, g, 16), 1),
        s('to16', 'TKA/16G', 'Takeaways (INT + FF) per 16 games', rate(i + ff, g, 16), 1),
      ];
    }
  }
};

/** Four headline numbers for the Overview scoreboard. */
export const headlineStats = (p: Player): StatItem[] => {
  switch (p.position) {
    case 'QB': {
      const r = passerRating(p);
      return [
        s('passYds', 'Pass yards', 'Career passing yards', p.passYds),
        s('passTD', 'Pass TD', 'Career passing touchdowns', p.passTD),
        s('rating', 'Passer rating', 'Career passer rating', Number.isFinite(r) ? r : null, 1),
        s('tdInt', 'TD : INT', 'Touchdowns per interception', rate(p.passTD, p.interceptions), 2),
      ];
    }
    case 'RB':
      return [
        s('rushYds', 'Rush yards', 'Career rushing yards', p.rushYds),
        s('totTD', 'Total TD', 'Rushing + receiving touchdowns', p.rushTD + p.recTD),
        s('scrim', 'Scrimmage yds', 'Rushing + receiving yards', p.rushYds + p.recYds),
        s('ypc', 'Yards / carry', 'Yards per carry', rate(p.rushYds, p.rushAtt), 2),
      ];
    case 'WR':
    case 'TE':
      return [
        s('recYds', 'Rec yards', 'Career receiving yards', p.recYds),
        s('recTD', 'Rec TD', 'Career receiving touchdowns', p.recTD),
        s('receptions', 'Receptions', 'Career receptions', p.receptions),
        s('ypr', 'Yards / catch', 'Yards per reception', rate(p.recYds, p.receptions), 1),
      ];
    case 'OL':
      return [
        s('blocks', 'Blocks', 'Career blocks', p.blocks),
        s('blkG', 'Blocks / game', 'Blocks per game', rate(p.blocks, p.games), 2),
        s('games', 'Games', 'Games played', p.games),
      ];
    default:
      return [
        s('tackles', 'Tackles', 'Career tackles', num(p, 'tackles')),
        s('sacks', 'Sacks', 'Career sacks', num(p, 'sacks')),
        s('interceptions', 'INT', 'Career interceptions', num(p, 'interceptions')),
        s('forcedFumbles', 'Forced fum.', 'Career forced fumbles', num(p, 'forcedFumbles')),
      ];
  }
};
