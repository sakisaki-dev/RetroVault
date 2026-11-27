import { useEffect } from 'react';
import { findNFLTeam } from '@/utils/nflTeams';
import { useCurrentClub } from '@/utils/club';

/*
 * The boot loader in index.html runs before any data has loaded, so it can't know the coach's club. Once the app
 * does, it writes the club's two colours here (hex, localStorage) and the next load's helmet wheel wears them; a first
 * visit, or a storage failure, falls back to the Retro Bowl red in index.html.
 */
export const BOOT_CLUB_KEY = 'rv:boot-club';

const hex = (hsl: string) => {
  const [h, s, l] = hsl.replace(/%/g, '').split(/\s+/).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** Remembers the current club's colours for the next boot (mounted once, in Index). */
export const useBootClubColours = () => {
  const club = useCurrentClub();
  useEffect(() => {
    const t = club ? findNFLTeam(club) : null;
    if (!t) return;
    try {
      localStorage.setItem(BOOT_CLUB_KEY, JSON.stringify({ p: hex(t.primaryColor), s: hex(t.secondaryColor) }));
    } catch {
      /* storage blocked: the loader keeps its default */
    }
  }, [club]);
};
