import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Player, Position } from '@/types/player';
import { awardPack } from '@/utils/collection';
import { compFeatures, similarityBaseline } from '@/config/advanced';
import { cn } from '@/lib/utils';
import { findNFLTeam } from '@/utils/nflTeams';
import GameBanner from './GameBanner';
import { ArcadeButton, ChipGroup, Confetti, CountUp } from './ArcadeUI';
import { MYSTERY_STYLE, POSITION_NAMES, loadGameStat, playerKey, saveGameStat, shuffle, teamStyle, type GamePlayer } from './gameUtils';
import {
  BUILD_POSITIONS,
  CLONE_THRESHOLD,
  MIN_SPIN_POOL,
  fmtFeature,
  gradeFor,
  hofVerdict,
  overallFor,
  positionBaseline,
  matchSlots,
  skillPct,
  scoreBuild,
  spin,
  spinPool,
  traitName,
  verdictFor,
  type BuildResult,
  type Overall,
  type Slot,
} from './buildLegendLogic';

const BEST_KEY = 'build:best';
const CLONES_KEY = 'build:clones';
const POS_KEY = 'build:pos';
const RESPINS = 1;
const LIVE_AFTER = 3;

/** Validated two-series pair on the arcade panel (dataviz validate_palette.js, dark, #141b30): build vs match. */
const C_BUILD = '#bf8516';
const C_MATCH = '#2f86d6';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ordinal = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  const s = r % 100 >= 11 && r % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][r % 10] ?? 'th');
  return `${r}${s}`;
};

const PLURAL: Record<Position, string> = {
  QB: 'quarterbacks',
  RB: 'running backs',
  WR: 'wide receivers',
  TE: 'tight ends',
  OL: 'offensive linemen',
  LB: 'linebackers',
  DB: 'defensive backs',
  DL: 'defensive linemen',
};
const plural = (pos: Position) => PLURAL[pos];

const CSS = `
.arcade .bal-setup { max-width: 760px; margin: 0 auto; display: grid; gap: 18px; justify-items: center; text-align: center; }
.arcade .bal-setup .chips { justify-content: center; }
.arcade .bal-k { font-family: var(--f-pixel); font-size: 11px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
.arcade .bal-feats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; list-style: none; margin: 0; padding: 0; }
.arcade .bal-feats li { font-family: var(--f-pixel); font-size: 10px; padding: 5px 8px; border-radius: 4px; background: #05070d; color: var(--gold); box-shadow: inset 0 0 0 1px #ffc83d44; text-transform: uppercase; }
.arcade .bal-trait { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 0; border-radius: 10px; text-align: left; background: linear-gradient(180deg, #0a0e1c, var(--panel)); box-shadow: 0 0 0 2px var(--line), 0 5px 0 #000; transition: transform 0.15s, box-shadow 0.15s; }
.arcade .bal-trait:hover:not(:disabled), .arcade .bal-trait:focus-visible { transform: translateY(-3px); box-shadow: 0 0 0 2px var(--gold), 0 8px 0 #000; }
.arcade .bal-trait.picked { box-shadow: 0 0 0 3px var(--turf), 0 0 26px #27b36a88; }
.arcade .bal-trait:disabled:not(.picked) { opacity: 0.4; cursor: not-allowed; filter: grayscale(0.8); }
.arcade .bal-trait-top { display: flex; justify-content: space-between; gap: 6px; align-items: center; }
.arcade .bal-key { font-family: var(--f-pixel); font-size: 9px; background: #000; color: var(--gold); padding: 2px 5px; border-radius: 3px; }
.arcade .bal-stat { font-family: var(--f-pixel); font-size: 9px; color: var(--muted); text-transform: uppercase; }
.arcade .bal-trait-name { font-family: var(--f-display); font-weight: 800; font-size: 19px; line-height: 1.05; text-transform: uppercase; color: var(--chalk); }
.arcade .bal-led { font-family: var(--f-pixel); font-size: 24px; line-height: 1; color: var(--gold); text-shadow: 0 0 12px #ffc83d55; background: #05070d; border-radius: 6px; padding: 8px; text-align: center; box-shadow: inset 0 0 0 2px #000; font-variant-numeric: tabular-nums; }
.arcade .bal-meter { display: flex; align-items: center; gap: 6px; font-family: var(--f-pixel); font-size: 9px; color: var(--muted); text-transform: uppercase; }
.arcade .bal-meter i { flex: 1; height: 6px; border-radius: 3px; background: var(--panel-3); overflow: hidden; box-shadow: inset 0 0 0 1px var(--line); }
.arcade .bal-meter i b { display: block; height: 100%; background: var(--gold); border-radius: 0 3px 3px 0; }
.arcade .bal-lock { display: flex; align-items: center; gap: 6px; font-family: var(--f-pixel); font-size: 9px; color: var(--muted); text-transform: uppercase; }
.arcade .bal-slot { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 8px; padding: 6px 8px; border-radius: 6px; background: #05070d; box-shadow: inset 0 0 0 1px #ffffff14; min-width: 0; }
.arcade .bal-slot > span { font-family: var(--f-pixel); font-size: 9px; color: var(--muted); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arcade .bal-slot > b { font-family: var(--f-display); font-size: 19px; line-height: 1.1; color: var(--chalk); font-variant-numeric: tabular-nums; grid-row: span 2; grid-column: 2; grid-row-start: 1; align-self: center; text-align: right; }
.arcade .bal-slot em { font-style: normal; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arcade .bal-slot.open > b { color: #ffffff33; }
.arcade .bal-live { margin-top: 10px; display: grid; gap: 6px; justify-items: start; }
.arcade .bal-live p { margin: 0; font-size: 13px; color: var(--chalk); }
.arcade .bal-reveal { display: grid; gap: 18px; }
.arcade .bal-stage { text-align: center; padding: 8px 0; }
.arcade .bal-scan { font-family: var(--f-pixel); font-size: 13px; color: var(--sky); min-height: 1.4em; }
.arcade .bal-kicker { font-family: var(--f-display); font-weight: 600; font-size: clamp(22px, 3.2vw, 30px); text-transform: uppercase; color: var(--muted); margin: 0; }
.arcade .bal-kicker:focus { outline: none; }
.arcade .bal-hero { display: grid; gap: 14px; justify-items: center; }
.arcade .bal-hero-card { width: min(420px, 100%); }
.arcade .bal-sim { font-family: var(--f-display); font-weight: 800; font-size: clamp(54px, 9vw, 88px); line-height: 0.9; color: var(--gold); font-variant-numeric: tabular-nums; text-shadow: 3px 3px 0 #000; }
.arcade .bal-sim small { font-size: 0.4em; color: var(--chalk); margin-left: 6px; }
.arcade .bal-verdict { font-family: var(--f-pixel); font-size: 12px; text-transform: uppercase; padding: 6px 10px; border-radius: 4px; background: #000; color: var(--turf); }
.arcade .bal-grid2 { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 900px) { .arcade .bal-grid2 { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); } }
.arcade .bal-panel { padding: 14px; border-radius: 10px; background: var(--panel); box-shadow: 0 0 0 2px var(--line); min-width: 0; }
.arcade .bal-panel h4 { margin: 0 0 4px; font-family: var(--f-display); font-weight: 800; font-size: 20px; text-transform: uppercase; }
.arcade .bal-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--chalk); margin: 4px 0 12px; }
.arcade .bal-legend span { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.arcade .bal-legend i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.arcade .bal-chart { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.arcade .bal-row { position: relative; display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 2px 10px; align-items: center; padding: 6px 4px; border-radius: 6px; }
.arcade .bal-row:hover, .arcade .bal-row:focus-visible, .arcade .bal-row.on { background: #ffffff0a; }
.arcade .bal-row-k { font-family: var(--f-pixel); font-size: 9px; color: var(--muted); text-transform: uppercase; line-height: 1.3; }
.arcade .bal-track { position: relative; height: 20px; }
.arcade .bal-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: #ffffff1f; }
.arcade .bal-track .mid { position: absolute; left: 50%; top: 2px; bottom: 2px; width: 1px; background: #ffffff1f; }
.arcade .bal-link { position: absolute; top: calc(50% - 1px); height: 2px; background: #ffffff55; }
.arcade .bal-dot { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; box-shadow: 0 0 0 2px var(--panel); }
.arcade .bal-row-v { grid-column: 2; display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.arcade .bal-row-v b { color: var(--chalk); font-weight: 600; }
.arcade .bal-tip { position: absolute; z-index: 5; right: 4px; bottom: calc(100% - 2px); max-width: min(320px, 92%); padding: 6px 8px; border-radius: 6px; background: #05070d; box-shadow: 0 0 0 1px var(--line), 0 8px 18px #000a; font-size: 12px; line-height: 1.35; color: var(--chalk); pointer-events: none; }
.arcade .bal-axis { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 10px; padding: 0 4px; font-family: var(--f-pixel); font-size: 9px; color: var(--muted); text-transform: uppercase; }
.arcade .bal-axis div { display: flex; justify-content: space-between; }
.arcade .bal-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
.arcade .bal-table th, .arcade .bal-table td { padding: 5px 6px; border-bottom: 1px solid #ffffff14; text-align: right; font-variant-numeric: tabular-nums; }
.arcade .bal-table th:first-child, .arcade .bal-table td:first-child { text-align: left; }
.arcade .bal-table td:last-child, .arcade .bal-table th:last-child { text-align: left; color: var(--muted); }
.arcade .bal-details summary { cursor: pointer; font-family: var(--f-pixel); font-size: 11px; color: var(--sky); text-transform: uppercase; margin-top: 12px; }
.arcade .bal-facts { display: grid; gap: 10px; align-content: start; }
.arcade .bal-fact { padding: 10px 12px; border-radius: 8px; background: #05070d; box-shadow: inset 0 0 0 1px #ffffff14; }
.arcade .bal-fact .k { font-family: var(--f-pixel); font-size: 10px; color: var(--muted); text-transform: uppercase; }
.arcade .bal-fact .v { font-family: var(--f-display); font-weight: 800; font-size: 26px; line-height: 1.05; text-transform: uppercase; }
.arcade .bal-fact p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
.arcade .bal-runners { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
.arcade .bal-badge { display: inline-flex; gap: 6px; align-items: center; font-family: var(--f-pixel); font-size: 11px; text-transform: uppercase; padding: 6px 10px; border-radius: 4px; background: #2a1f00; color: var(--gold); box-shadow: inset 0 0 0 1px #ffc83d66; }
.arcade .bal-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }

.arcade .bal-scoreboard { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; justify-content: center; width: fit-content; max-width: 100%; margin: 0 auto 14px; padding: 6px 12px; border-radius: 4px; background: #000; border: 1px solid #333; box-shadow: inset 0 0 8px #ffc83d33; font-family: var(--f-pixel); font-size: 11px; color: var(--gold); text-transform: uppercase; }
.arcade .bal-scoreboard b { color: var(--chalk); font-weight: 400; margin-left: 4px; }
.arcade .bal-scoreboard span:first-child b { margin: 0; color: var(--gold); }
.arcade .bal-play { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1000px) { .arcade .bal-play { grid-template-columns: minmax(0, 1fr) 300px; align-items: start; } }
.arcade .bal-main { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.arcade .bal-machine { --row: 84px; width: min(620px, 100%); margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 16px; border-radius: 18px; background: linear-gradient(180deg, #2a2350, #120f26); box-shadow: 0 0 0 3px #000, 0 0 0 6px #e0a3ff55, 0 22px 50px #000b, 0 0 70px #e0a3ff2e; }
@media (max-width: 600px) { .arcade .bal-machine { --row: 64px; padding: 12px; gap: 10px; } }
.arcade .bal-window { position: relative; height: calc(var(--row) * 3); overflow: hidden; border-radius: 12px; background: #05070d; box-shadow: inset 0 0 0 3px #000, inset 0 0 30px #000; }
.arcade .bal-window::before, .arcade .bal-window::after { content: ''; position: absolute; left: 0; right: 0; height: var(--row); z-index: 2; pointer-events: none; }
.arcade .bal-window::before { top: 0; background: linear-gradient(#05070d, #05070dcc 45%, #05070d66); }
.arcade .bal-window::after { bottom: 0; background: linear-gradient(#05070d66, #05070dcc 55%, #05070d); }
.arcade .bal-payline { position: absolute; left: 6px; right: 6px; top: var(--row); height: var(--row); z-index: 3; border-radius: 8px; pointer-events: none; box-shadow: inset 0 0 0 3px var(--gold), 0 0 22px #ffc83d55; }
.arcade .bal-payline::before, .arcade .bal-payline::after { content: ''; position: absolute; top: 50%; width: 0; height: 0; transform: translateY(-50%); border-top: 10px solid transparent; border-bottom: 10px solid transparent; }
.arcade .bal-payline::before { left: -6px; border-left: 12px solid var(--gold); }
.arcade .bal-payline::after { right: -6px; border-right: 12px solid var(--gold); }
.arcade .bal-machine.spinning .bal-payline { animation: bal-tickflash 0.14s steps(2, end) infinite; }
@keyframes bal-tickflash { 50% { box-shadow: inset 0 0 0 3px #fff3c4, 0 0 34px #ffc83daa; } }
.arcade .bal-strip { position: relative; z-index: 1; padding-top: var(--row); will-change: transform, filter; transform: translateY(var(--end)); }
.arcade .bal-strip.rolling { animation: bal-roll var(--dur) cubic-bezier(0.15, 0.62, 0.12, 1) both, bal-blur var(--dur) ease-out both; }
@keyframes bal-roll { from { transform: translateY(0); } to { transform: translateY(var(--end)); } }
@keyframes bal-blur { 0% { filter: blur(0); } 12% { filter: blur(3.5px) brightness(1.15); } 65% { filter: blur(2px); } 100% { filter: blur(0); } }
.arcade .bal-reelrow { height: var(--row); display: flex; align-items: center; gap: 14px; padding: 0 22px; font-family: var(--f-display); font-weight: 800; font-size: clamp(26px, 6vw, 40px); text-transform: uppercase; white-space: nowrap; overflow: hidden; color: var(--chalk); }
.arcade .bal-reelrow > span { overflow: hidden; text-overflow: ellipsis; }
.arcade .bal-reelrow img { width: calc(var(--row) * 0.56); height: calc(var(--row) * 0.56); flex: none; object-fit: contain; }
.arcade .bal-reelrow.idle { justify-content: center; color: var(--muted); font-size: clamp(18px, 4vw, 26px); }
.arcade .bal-landflash { position: absolute; left: 6px; right: 6px; top: var(--row); height: var(--row); z-index: 2; border-radius: 8px; background: linear-gradient(110deg, var(--c1), var(--c2)); opacity: 0.32; animation: bal-land 0.9s ease-out both; pointer-events: none; }
@keyframes bal-land { 0% { opacity: 0; } 12% { opacity: 1; filter: brightness(1.8); } 35% { opacity: 0.55; } 100% { opacity: 0.32; } }
.arcade .bal-landlogo { position: absolute; right: 18px; top: calc(var(--row) * 0.5); z-index: 3; width: calc(var(--row) * 2); height: calc(var(--row) * 2); object-fit: contain; opacity: 0.22; pointer-events: none; animation: bal-logo 0.9s ease-out both; }
@keyframes bal-logo { 0% { opacity: 0; transform: scale(1.6); } 25% { opacity: 0.6; } 100% { opacity: 0.22; transform: none; } }
.arcade .bal-controls { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.arcade .bal-lever { position: relative; width: 34px; height: calc(var(--row) * 1.6); margin-top: 14px; border: 0; padding: 0; background: transparent; }
.arcade .bal-lever i { position: absolute; left: 50%; bottom: 0; width: 10px; height: 100%; margin-left: -5px; border-radius: 5px; transform-origin: 50% 100%; background: linear-gradient(90deg, #8a8fa8, #e6e9f5, #8a8fa8); transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1); }
.arcade .bal-lever i::before { content: ''; position: absolute; left: 50%; top: -14px; width: 30px; height: 30px; margin-left: -15px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff9aa2, var(--flag) 55%, #8a1020); box-shadow: 0 0 14px #ff4f6188, 0 3px 0 #000; }
.arcade .bal-lever b { position: absolute; left: 50%; bottom: -8px; width: 30px; height: 16px; margin-left: -15px; border-radius: 6px; background: #000; }
.arcade .bal-machine.spinning .bal-lever i, .arcade .bal-lever:active i { transform: scaleY(0.4); }
.arcade .bal-lever:disabled { cursor: default; opacity: 0.7; }
@media (max-width: 600px) { .arcade .bal-lever { display: none; } }
.arcade .bal-spin-btn { min-width: 132px; min-height: 52px; padding: 8px 18px; border: 0; border-radius: 999px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #ffe08a, var(--gold) 45%, #b8860b); color: #1a1300; box-shadow: 0 0 0 3px #000, 0 5px 0 3px #000, 0 0 22px #ffc83d77; font-family: var(--f-display); font-weight: 800; font-size: 26px; line-height: 1; text-transform: uppercase; transition: transform 0.12s, filter 0.15s; }
.arcade .bal-spin-btn small { font-family: var(--f-pixel); font-size: 9px; font-weight: 400; margin-top: 3px; }
.arcade .bal-spin-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.arcade .bal-spin-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 0 0 3px #000, 0 2px 0 3px #000; }
.arcade .bal-spin-btn:disabled { cursor: default; filter: saturate(0.4) brightness(0.75); }
.arcade .bal-spin-btn.respin { background: radial-gradient(circle at 35% 30%, #f3d6ff, #e0a3ff 45%, #8a4fb0); color: #1b0826; font-size: 20px; box-shadow: 0 0 0 3px #000, 0 5px 0 3px #000, 0 0 22px #e0a3ff77; }
.arcade .bal-spin-btn:focus-visible { outline: 3px solid var(--chalk); outline-offset: 4px; }
@media (max-width: 600px) { .arcade .bal-machine { grid-template-columns: 1fr; } .arcade .bal-controls { flex-direction: row; justify-content: center; } }
.arcade .bal-cue { margin: 4px 0 0; text-align: center; font-family: var(--f-pixel); font-size: 11px; color: var(--muted); text-transform: uppercase; }
.arcade .bal-landed { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.arcade .bal-landed-card { width: min(420px, 100%); }
.arcade .bal-emerge { animation: bal-emerge 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.15) both; transform-origin: 50% 0; }
@keyframes bal-emerge { from { opacity: 0; transform: translateY(-70px) scale(0.55); } to { opacity: 1; transform: none; } }
.arcade .bal-traits { width: 100%; list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
@media (max-width: 420px) { .arcade .bal-traits { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
.arcade .bal-fan { min-width: 0; animation: bal-fan 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: calc(0.25s + var(--i) * 55ms); }
@keyframes bal-fan { from { opacity: 0; transform: translateY(-60px) rotate(var(--fan)) scale(0.7); } to { opacity: 1; transform: none; } }
.arcade .bal-build { border-radius: 10px; background: var(--panel-3); box-shadow: 0 0 0 2px var(--line); }
.arcade .bal-build-title { margin: 0 0 8px; font-family: var(--f-pixel); font-size: 11px; font-weight: 400; color: var(--muted); text-transform: uppercase; }
.arcade .bal-build-body ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.arcade .bal-sheet-toggle { display: none; }
.arcade .bal-grade { display: inline-grid; place-items: center; border-radius: 6px; color: #0b1020; font-family: var(--f-display); font-weight: 800; line-height: 1; box-shadow: inset 0 -3px 0 #0003, 0 0 0 2px #000; font-variant-numeric: tabular-nums; }
.arcade .bal-grade--sm { min-width: 30px; height: 22px; padding: 0 5px; font-size: 15px; border-radius: 4px; vertical-align: middle; }
.arcade .bal-grade--md { min-width: 40px; height: 30px; padding: 0 6px; font-size: 20px; }
.arcade .bal-grade--lg { min-width: 64px; height: 46px; padding: 0 10px; font-size: 32px; }
.arcade .bal-grade--s { background: linear-gradient(120deg, #fff3b0, #ffd84a 30%, #ff9de2 55%, #8fe3ff 75%, #ffd84a) !important; background-size: 220% 100% !important; box-shadow: inset 0 -3px 0 #0003, 0 0 0 2px #000, 0 0 14px #ffd84acc; animation: bal-holo 2.4s linear infinite; }
@keyframes bal-holo { from { background-position: 0% 0; } to { background-position: 220% 0; } }
.arcade .bal-ob { --ob1: #3a466e; --ob2: #232c48; --obtx: #f1f4ff; position: relative; display: flex; align-items: stretch; gap: 0; margin-bottom: 10px; border-radius: 10px; overflow: hidden; color: var(--obtx); background: linear-gradient(100deg, var(--ob1) 0 34%, var(--ob2) 34% 100%); box-shadow: 0 0 0 2px #000, 0 6px 16px #0008; transition: --ob1 0.5s, --ob2 0.5s, background 0.5s; }
.arcade .bal-ob::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, #0000 0 22px, #ffffff0c 22px 26px); pointer-events: none; }
.arcade .bal-ob-num { width: 34%; display: grid; place-items: center; font-family: var(--f-display); font-weight: 800; font-style: italic; font-size: 46px; line-height: 1; text-shadow: 2px 2px 0 #0006; font-variant-numeric: tabular-nums; padding: 8px 4px; }
.arcade .bal-ob-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; padding: 8px 10px; }
.arcade .bal-ob-k { font-family: var(--f-pixel); font-size: 10px; text-transform: uppercase; opacity: 0.85; }
.arcade .bal-ob-tier { font-family: var(--f-display); font-weight: 800; font-size: 22px; line-height: 1.05; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arcade .bal-ob-sub { font-family: var(--f-pixel); font-size: 9px; text-transform: uppercase; opacity: 0.8; margin-top: 2px; }
.arcade .bal-ob-grade { align-self: center; margin-right: 10px; min-width: 52px; height: 44px; padding: 0 8px; display: grid; place-items: center; border-radius: 8px; background: #000a; color: #fff; font-family: var(--f-display); font-weight: 800; font-size: 28px; box-shadow: inset 0 0 0 2px #ffffff33; animation: arc-pop 0.35s ease; }
.arcade .bal-ob--none { --ob1: #2b3760; --ob2: #141b30; --obtx: #93a1c9; }
.arcade .bal-ob--s { --ob1: #b8860b; --ob2: #3a2a00; --obtx: #fff7d6; background: linear-gradient(110deg, #fff3b0, #ffd84a 18%, #ff9de2 34%, #8fe3ff 52%, #ffd84a 70%, #b8860b); background-size: 240% 100%; animation: bal-holo 3s linear infinite; color: #1a1300; }
.arcade .bal-ob--s .bal-ob-num { text-shadow: 0 0 14px #fff8; }
.arcade .bal-ob--a { --ob1: #1f9d5a; --ob2: #0f3d27; }
.arcade .bal-ob--b { --ob1: #2f6fd6; --ob2: #13284d; }
.arcade .bal-ob--c { --ob1: #7b5cc4; --ob2: #2a2148; }
.arcade .bal-ob--d { --ob1: #e07a1f; --ob2: #4a2508; }
.arcade .bal-ob--f { --ob1: #d63a44; --ob2: #4a0e14; }
.arcade .bal-ob--top { display: none; width: min(620px, 100%); margin: 0; }
@media (max-width: 999px) { .arcade .bal-ob--top { display: flex; } .arcade .bal-ob--panel { display: none; } }
@property --ob1 { syntax: '<color>'; inherits: true; initial-value: #3a466e; }
@property --ob2 { syntax: '<color>'; inherits: true; initial-value: #232c48; }
.arcade .bal-grade-row { display: flex; justify-content: center; padding: 4px 0; }
.arcade .bal-trait:disabled .bal-grade { filter: grayscale(1); }
.arcade .bal-slot.fresh { box-shadow: inset 0 0 0 2px var(--turf); }
@media (min-width: 1000px) {
  .arcade .bal-build { padding: 12px; position: sticky; top: 76px; }
  .arcade .bal-build-body ol { grid-template-columns: 1fr; }
}
@media (max-width: 999px) {
  .arcade .bal-draft { padding-bottom: 64px; }
  .arcade .bal-build { position: fixed; z-index: 45; left: 0; right: 0; bottom: 0; border-radius: 12px 12px 0 0; box-shadow: 0 0 0 2px var(--line), 0 -10px 30px #000c; padding: 0 12px calc(8px + env(safe-area-inset-bottom, 0px)); }
  .arcade .bal-build-title { display: none; }
  .arcade .bal-sheet-toggle { display: flex; width: 100%; justify-content: space-between; align-items: center; min-height: 48px; padding: 0 4px; border: 0; background: transparent; font-family: var(--f-pixel); font-size: 12px; color: var(--gold); text-transform: uppercase; }
  .arcade .bal-build-body { display: none; max-height: 55vh; overflow: auto; padding-bottom: 6px; }
  .arcade .bal-build.open .bal-build-body { display: block; }
}
`;

// ---------- Reveal chart: paired dots on a percentile scale ----------

const StyleChart = ({ result, baseline }: { result: BuildResult; baseline: Map<string, number[]> }) => {
  const [active, setActive] = useState<number | null>(null);
  const top = result.matches[0];
  const pos = result.position;
  const rows = result.features.map((f, i) => {
    const sorted = baseline.get(f.id) ?? [];
    const mine = result.vector[i];
    const his = f.get(top.player);
    return { f, name: traitName(pos, f), mine, his, pMine: skillPct(f, sorted, mine), pHis: skillPct(f, sorted, his), from: result.picks[i] };
  });
  const tipFor = (r: (typeof rows)[number]) =>
    `${r.name} (${r.f.label}): your build ${fmtFeature(r.f, r.mine)} (${ordinal(r.pMine)} pct) · ${top.player.name} ${fmtFeature(r.f, r.his)} (${ordinal(r.pHis)} pct)`;

  return (
    <div className="bal-panel">
      <h4>Your build vs {top.player.name}</h4>
      <p className="hint" style={{ margin: 0 }}>
        Percentile among league {plural(pos)} with 8+ games (flipped for INT% and fumbles, so right is always better). Hover or focus a row for values.
      </p>
      <div className="bal-legend" aria-hidden="true">
        <span>
          <i style={{ background: C_BUILD }} />
          Your build
        </span>
        <span>
          <i style={{ background: C_MATCH }} />
          {top.player.name}
        </span>
      </div>
      <ul className="bal-chart" aria-label={`Percentile comparison of your build and ${top.player.name}`} onMouseLeave={() => setActive(null)}>
        {rows.map((r, i) => {
          const a = Number.isFinite(r.pMine) ? r.pMine : 50;
          const b = Number.isFinite(r.pHis) ? r.pHis : null;
          return (
            <li
              key={r.f.id}
              className={cn('bal-row', active === i && 'on')}
              tabIndex={0}
              aria-label={tipFor(r)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="bal-row-k" aria-hidden="true">
                {r.name}
              </span>
              <div className="bal-track" aria-hidden="true">
                <span className="mid" />
                {b != null && <span className="bal-link" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />}
                {b != null && <span className="bal-dot" style={{ left: `${b}%`, background: C_MATCH }} />}
                <span className="bal-dot" style={{ left: `${a}%`, background: C_BUILD }} />
              </div>
              <div className="bal-row-v" aria-hidden="true">
                <span>
                  You <b>{fmtFeature(r.f, r.mine)}</b>
                </span>
                <span>
                  Him <b>{fmtFeature(r.f, r.his)}</b>
                </span>
              </div>
              {active === i && (
                <span className="bal-tip" aria-hidden="true">
                  {tipFor(r)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="bal-axis" aria-hidden="true">
        <span />
        <div>
          <span>0</span>
          <span>50th</span>
          <span>100th pct</span>
        </div>
      </div>
      <details className="bal-details">
        <summary>Show as table</summary>
        <table className="bal-table">
          <caption className="sr-only">Your build compared with {top.player.name}</caption>
          <thead>
            <tr>
              <th scope="col">Trait</th>
              <th scope="col">You</th>
              <th scope="col">{top.player.name.split(' ').slice(-1)[0]}</th>
              <th scope="col">Taken from</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f.id}>
                <th scope="row" style={{ fontWeight: 600 }}>
                  {r.name} <span className="muted">({r.f.label})</span>
                </th>
                <td>{fmtFeature(r.f, r.mine)}</td>
                <td>{fmtFeature(r.f, r.his)}</td>
                <td>{r.from?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

// ---------- Grades ----------

const GradeChip = ({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' | 'lg' }) => {
  const g = gradeFor(pct);
  return (
    <span className={cn('bal-grade', `bal-grade--${size}`, g?.grade === 'S' && 'bal-grade--s')} style={{ background: g?.color ?? '#3a466e' }}>
      {g?.grade ?? '—'}
    </span>
  );
};

/** Number that ticks from its previous value to the new one (instant with reduced motion). */
const TickNumber = ({ value }: { value: number }) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reducedMotion() || start === value) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 600);
      setShown(Math.round(start + (value - start) * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
};

/** Banner colour family for an overall: S gold holo, A green, B blue, C purple, D orange, F red. */
const bannerTone = (o: Overall | null) => (o ? (o.grade.grade === 'S' ? 's' : o.grade.grade[0].toLowerCase()) : 'none');

/** Live overall as a broadcast ratings ribbon: big OVR, letter grade, traits filled; colour keyed to the grade. */
const OverallBanner = ({ overall, filled, total, className }: { overall: Overall | null; filled: number; total: number; className?: string }) => (
  <div
    className={cn('bal-ob', `bal-ob--${bannerTone(overall)}`, className)}
    aria-live="polite"
    aria-label={overall ? `Overall ${overall.rating}, grade ${overall.grade.grade}, ${overall.tier}. ${filled} of ${total} traits` : `Overall not rated yet. ${filled} of ${total} traits`}
  >
    <div className="bal-ob-num" aria-hidden="true">
      {overall ? <TickNumber value={overall.rating} /> : '—'}
    </div>
    <div className="bal-ob-body" aria-hidden="true">
      <div className="bal-ob-k">Overall</div>
      <div className="bal-ob-tier">{overall ? overall.tier : 'Lock a trait'}</div>
      <div className="bal-ob-sub">
        {filled}/{total} traits
      </div>
    </div>
    <div className="bal-ob-grade" aria-hidden="true" key={overall?.grade.grade ?? 'none'}>
      {overall?.grade.grade ?? '—'}
    </div>
  </div>
);

// ---------- Slot reel ----------

const STRIP_LEN = 28;
const SPIN_MS = 2600;
const FADE_MS = 220;

interface SpinState {
  /** Increments every spin, so a re-armed timer never lands an old spin twice */
  id: number;
  target: Player;
  /** Names that roll past the payline; the last one is the target */
  strip: Player[];
  endAt: number;
  landed: boolean;
  /** A trait was locked from this player: the reel rests, waiting for the next spin */
  done: boolean;
}

const SlotMachine = ({
  spinState,
  mystery,
  spinning,
  controls,
  onLever,
  leverDisabled,
}: {
  spinState: SpinState | null;
  mystery: boolean;
  spinning: boolean;
  controls: ReactNode;
  onLever: () => void;
  leverDisabled: boolean;
}) => {
  const strip = spinState?.strip ?? [];
  const landed = !!spinState?.landed && !spinning;
  const target = spinState?.target ?? null;
  const st = target && !mystery ? teamStyle(target.team) : MYSTERY_STYLE;
  const logo = target && !mystery ? findNFLTeam(target.team)?.logoUrl : null;
  return (
    <div className={cn('bal-machine', spinning && 'spinning', landed && 'landed')}>
      <div className="bal-window" aria-hidden="true">
        <div
          key={spinState?.id ?? 'idle'}
          className={cn('bal-strip', spinning && 'rolling')}
          style={{ '--end': `calc(var(--row) * -${Math.max(0, strip.length - 1)})`, '--dur': `${SPIN_MS}ms` } as CSSProperties}
        >
          {strip.length ? (
            strip.map((p, i) => {
              const l = mystery ? null : findNFLTeam(p.team)?.logoUrl;
              return (
                <div key={i} className="bal-reelrow">
                  {l && <img src={l} alt="" />}
                  <span>{mystery ? '? ? ?' : p.name}</span>
                </div>
              );
            })
          ) : (
            <div className="bal-reelrow idle">Pull to spin</div>
          )}
        </div>
        {landed && (
          <>
            <span key={`f${spinState?.id}`} className="bal-landflash" style={{ '--c1': st.c1, '--c2': st.c2 } as CSSProperties} />
            {logo && <img key={`l${spinState?.id}`} className="bal-landlogo" src={logo} alt="" />}
          </>
        )}
        <span className="bal-payline" />
      </div>
      <div className="bal-controls">
        <button type="button" className="bal-lever" onClick={onLever} disabled={leverDisabled} tabIndex={-1} aria-hidden="true">
          <i />
          <b />
        </button>
        {controls}
      </div>
    </div>
  );
};

// ---------- Game ----------

const BuildALegend = ({ players, ovrMap }: { players: GamePlayer[]; ovrMap?: Map<string, number> }) => {
  const available = useMemo(() => BUILD_POSITIONS.filter((p) => spinPool(players, p).length >= MIN_SPIN_POOL), [players]);
  const [position, setPosition] = useState<Position>(() => BUILD_POSITIONS[loadGameStat(POS_KEY, 0)] ?? 'QB');
  const pos = available.includes(position) ? position : available[0];
  const features = useMemo(() => (pos ? compFeatures(pos) : []), [pos]);
  const pool = useMemo(() => (pos ? spinPool(players, pos) : []), [players, pos]);

  const [mystery, setMystery] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'draft' | 'reveal'>('setup');
  const [game, setGame] = useState(0);
  const [slots, setSlots] = useState<(Slot | null)[]>([]);
  const [spinState, setSpinState] = useState<SpinState | null>(null);
  const [respins, setRespins] = useState(RESPINS);
  const [lastLocked, setLastLocked] = useState<number | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<BuildResult | null>(null);
  const [stage, setStage] = useState(3);
  const [scanName, setScanName] = useState('');
  const [best, setBest] = useState(() => loadGameStat(BEST_KEY, -1));
  const [clones, setClones] = useState(() => loadGameStat(CLONES_KEY, 0));
  const [confetti, setConfetti] = useState<number | false>(false);
  const [newBest, setNewBest] = useState(false);
  const seen = useRef(new Set<Player>());
  const spinSeq = useRef(0);
  const headRef = useRef<HTMLHeadingElement>(null);
  const hubRef = useRef<HTMLButtonElement>(null);
  const traitsRef = useRef<HTMLOListElement>(null);

  const current = spinState?.landed && !spinState.done ? spinState.target : null;
  const spinning = !!spinState && !spinState.landed;

  const baseline = useMemo(() => (pos ? positionBaseline(players, pos) : new Map<string, number[]>()), [players, pos]);

  const filled = slots.filter(Boolean).length;
  const overall = useMemo(() => (pos ? overallFor(features, baseline, slots.map((s) => (s ? s.value : null)), pos) : null), [features, baseline, slots, pos]);
  const live = useMemo(
    () => (pos && showLive && filled >= LIVE_AFTER ? (matchSlots(players, pos, slots, 1)[0] ?? null) : null),
    [players, pos, slots, showLive, filled],
  );

  const finish = useCallback(
    (all: (Slot | null)[]) => {
      if (!pos) return;
      const r = scoreBuild(players, pos, all);
      const sim = r.matches[0]?.similarity ?? 0;
      const rounded = Math.round(sim * 10) / 10;
      setNewBest(rounded > best);
      if (rounded > best) {
        setBest(rounded);
        saveGameStat(BEST_KEY, rounded);
      }
      if (Math.round(sim) >= CLONE_THRESHOLD) {
        const c = clones + 1;
        setClones(c);
        saveGameStat(CLONES_KEY, c);
        awardPack('premium', `Build-a-Legend perfect clone, ${Math.round(sim)}%`, { once: r });
      } else if (Math.round(sim) >= 85) {
        awardPack('standard', `Build-a-Legend, ${Math.round(sim)}% match`, { once: r });
      }
      setSpinState(null);
      setResult(r);
      setStage(reducedMotion() ? 3 : 0);
      setPhase('reveal');
    },
    [players, pos, best, clones],
  );

  /**
   * Starts a spin. The landing is driven by state (spinState.endAt) and an effect-owned timer, never by
   * transitionend or a fire-and-forget timeout, so a re-render, an effect re-run or a skipped animation
   * can't strand the game between "spinning" and "landed".
   */
  const doSpin = useCallback(
    (open: (Slot | null)[]) => {
      if (!pos || spinning) return;
      let target = spin(pool, pos, open, seen.current);
      if (!target) {
        // Everyone has come up: start the rotation over before giving up
        seen.current = new Set();
        target = spin(pool, pos, open, seen.current);
      }
      if (!target) {
        // No league player has data for any open slot: reveal with what we have rather than stall
        setAnnounce('No player left has data for your open slots. Revealing your build.');
        finish(open);
        return;
      }
      seen.current.add(target);
      const landOn = target;
      setSpinState((prev) => {
        // Names roll past the payline (shuffled pool, starting from the last landed player) and stop on the target
        const filler: Player[] = [];
        while (filler.length < STRIP_LEN - 2) filler.push(...shuffle(pool));
        const strip = [prev?.target ?? filler[0], ...filler.slice(0, STRIP_LEN - 2), landOn];
        return {
          id: ++spinSeq.current,
          target: landOn,
          strip,
          endAt: Date.now() + (reducedMotion() ? FADE_MS : SPIN_MS),
          landed: false,
          done: false,
        };
      });
      setLastLocked(null);
      setAnnounce('Spinning…');
    },
    [pos, pool, spinning, finish],
  );

  // Land the spin when its time is up (re-armed on every render pass, so it can't be lost)
  useEffect(() => {
    if (!spinState || spinState.landed) return;
    const id = spinState.id;
    const t = window.setTimeout(
      () => {
        setSpinState((s) => (s && s.id === id ? { ...s, landed: true } : s));
      },
      Math.max(0, spinState.endAt - Date.now()),
    );
    return () => window.clearTimeout(t);
  }, [spinState]);

  // On landing: announce, bring the traits into view and focus the first open one
  const landedId = spinState?.landed && !spinState.done ? spinState.id : null;
  useEffect(() => {
    if (landedId == null || !current) return;
    setAnnounce(mystery ? `The reel landed on a sealed ${pos}. Pick one of his traits.` : `The reel landed on ${current.name}. Pick one of his traits.`);
    const t = window.setTimeout(() => {
      document.querySelector('.arcade .bal-landed')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      traitsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedId]);

  const start = useCallback(() => {
    if (!pos) return;
    saveGameStat(POS_KEY, BUILD_POSITIONS.indexOf(pos));
    seen.current = new Set();
    setSlots(features.map(() => null));
    setSpinState(null);
    setRespins(RESPINS);
    setLastLocked(null);
    setResult(null);
    setGame((g) => g + 1);
    setPhase('draft');
    setAnnounce('');
  }, [pos, features]);

  const lock = useCallback(
    (i: number) => {
      if (!current || slots[i] || !Number.isFinite(features[i].get(current))) return;
      const next = slots.map((s, j) => (j === i ? { player: current, value: features[i].get(current) } : s));
      setAnnounce(`Locked ${traitName(current.position, features[i])}: ${fmtFeature(features[i], features[i].get(current))}.`);
      setSlots(next);
      setLastLocked(i);
      setSpinState((s) => (s ? { ...s, done: true } : s));
      if (next.every(Boolean)) finish(next);
      else window.setTimeout(() => hubRef.current?.focus({ preventScroll: true }), 0);
    },
    [current, slots, features, finish],
  );

  const respin = () => {
    if (!current || respins <= 0) return;
    setRespins((r) => r - 1);
    doSpin(slots);
  };

  // Focus the hub / reveal heading on screen changes (keyboard + screen reader users)
  useEffect(() => {
    if (phase === 'reveal') headRef.current?.focus({ preventScroll: false });
    if (phase === 'draft') hubRef.current?.focus({ preventScroll: true });
  }, [phase, game]);

  // 1–N lock a trait of the landed player
  useEffect(() => {
    if (phase !== 'draft' || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < features.length) {
        e.preventDefault();
        lock(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, current, features, lock]);

  // Reveal sequence: scan the league → "plays like…" → the match → the breakdown
  useEffect(() => {
    if (phase !== 'reveal' || !result || stage >= 3) return;
    const t = window.setTimeout(() => setStage((s) => s + 1), stage === 0 ? 1300 : stage === 1 ? 900 : 1400);
    let iv = 0;
    if (stage === 0) {
      const ms = result.matches;
      iv = window.setInterval(() => setScanName(ms[Math.floor(Math.random() * ms.length)]?.player.name ?? ''), 70);
    }
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [phase, result, stage]);

  useEffect(() => {
    if (phase === 'reveal' && stage === 3 && result && Math.round(result.matches[0]?.similarity ?? 0) >= CLONE_THRESHOLD) setConfetti(Date.now());
  }, [phase, stage, result]);

  if (!pos) return <p className="empty">Not enough league players at any position to build a legend yet.</p>;

  const scoreboard = (
    <div className="bal-scoreboard" role="group" aria-label="Scoreboard">
      <span>
        <b>{pos}</b>
      </span>
      {phase === 'draft' && (
        <span>
          Traits <b>{`${filled}/${features.length}`}</b>
        </span>
      )}
      {phase !== 'setup' && (
        <span>
          Overall <b data-overall="header">{overall ? `${overall.grade.grade} ${overall.rating}` : '—'}</b>
        </span>
      )}
      <span>
        Best <b>{best >= 0 ? `${Math.round(best)}%` : '—'}</b>
      </span>
      <span>
        Clones <b>{clones}</b>
      </span>
      {mystery && (
        <span>
          <b>Mystery</b>
        </span>
      )}
    </div>
  );

  // ---------- Setup ----------
  if (phase === 'setup') {
    return (
      <div>
        <style>{CSS}</style>
        {scoreboard}
        <div className="bal-setup">
          <h3 className="question" style={{ margin: 0 }}>
            Pull the lever, steal a trait, build a <b>{POSITION_NAMES[pos]}</b>
          </h3>
          <div>
            <div className="bal-k">Position</div>
            <ChipGroup
              label="Position"
              value={pos}
              options={BUILD_POSITIONS.map((p) => ({ value: p, label: p, disabled: !available.includes(p), title: POSITION_NAMES[p] }))}
              onChange={(p) => setPosition(p)}
            />
          </div>
          <div>
            <div className="bal-k">Difficulty</div>
            <ChipGroup
              label="Difficulty"
              value={mystery ? 'mystery' : 'scout'}
              options={[
                { value: 'scout', label: 'Scout: names shown' },
                { value: 'mystery', label: 'Mystery: names hidden' },
              ]}
              onChange={(v) => setMystery(v === 'mystery')}
            />
          </div>
          <div>
            <div className="bal-k">{features.length} trait slots to fill</div>
            <ul className="bal-feats">
              {features.map((f) => (
                <li key={f.id} title={`${f.label}: ${f.definition}`}>
                  {traitName(pos, f)}
                </li>
              ))}
            </ul>
          </div>
          <p className="hint" style={{ margin: 0, maxWidth: '62ch' }}>
            Each spin lands on a random player from the league's {plural(pos)}. Lock one of his traits into an open slot. A filled slot is
            gone for good, so grab a player's best trait while you can. You get {RESPINS} respin. When every slot is full we find who plays
            most like your creation. Hit {CLONE_THRESHOLD}% for a perfect clone.
          </p>
          <ArcadeButton tone="go" onClick={start}>
            Start building
          </ArcadeButton>
        </div>
      </div>
    );
  }

  // ---------- Spin & lock ----------
  if (phase === 'draft') {
    const canSpin = !current && !spinning;
    const hub = current ? (
      <button
        ref={hubRef}
        type="button"
        className="bal-spin-btn respin"
        onClick={respin}
        disabled={respins <= 0}
        aria-label={respins > 0 ? `Respin: reroll ${mystery ? 'this player' : current.name} (${respins} left)` : 'No respins left'}
      >
        <span>Respin</span>
        <small>{respins} left</small>
      </button>
    ) : (
      <button
        ref={hubRef}
        type="button"
        className="bal-spin-btn"
        onClick={() => doSpin(slots)}
        disabled={!canSpin}
        aria-label={spinning ? 'Spinning' : `Spin the reel for a ${POSITION_NAMES[pos].toLowerCase()} (trait ${filled + 1} of ${features.length})`}
      >
        <span>{spinning ? '…' : 'Spin'}</span>
        {!spinning && <small>{filled === 0 ? 'Enter' : `${filled + 1}/${features.length}`}</small>}
      </button>
    );

    const buildPanel = (
      <>
        <OverallBanner overall={overall} filled={filled} total={features.length} className="bal-ob--panel" />
        <ol>
          {features.map((f, i) => {
            const s = slots[i];
            const pct = s ? skillPct(f, baseline.get(f.id) ?? [], s.value) : NaN;
            return (
              <li
                key={f.id}
                className={cn('bal-slot', !s && 'open', lastLocked === i && 'fresh')}
                title={s ? `${f.label} ${fmtFeature(f, s.value)} · ${ordinal(pct)} percentile` : f.definition}
              >
                <span>{traitName(pos, f)}</span>
                <b>{s ? <GradeChip pct={pct} size="sm" /> : '?'}</b>
                <em>{s ? (mystery ? 'Sealed player' : s.player.name) : 'Open'}</em>
              </li>
            );
          })}
        </ol>
        <div className="bal-live">
          <button
            type="button"
            className="chip"
            aria-pressed={showLive}
            disabled={filled < LIVE_AFTER}
            onClick={() => setShowLive((v) => !v)}
            title={filled < LIVE_AFTER ? `Unlocks after ${LIVE_AFTER} traits` : undefined}
          >
            {showLive ? 'Hide live match' : `Peek live match${filled < LIVE_AFTER ? ` (${LIVE_AFTER}+ traits)` : ''}`}
          </button>
          {live && (
            <p aria-live="polite">
              Currently plays like <b>{live.player.name}</b> · {Math.round(live.similarity)}%
            </p>
          )}
          <ArcadeButton tone="ghost" onClick={() => setPhase('setup')}>
            Scrap this build
          </ArcadeButton>
        </div>
      </>
    );

    return (
      <div className="bal-draft">
        <style>{CSS}</style>
        {scoreboard}
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        <div className="bal-play">
          <div className="bal-main">
            <OverallBanner overall={overall} filled={filled} total={features.length} className="bal-ob--top" />
            <SlotMachine
              spinState={spinState}
              mystery={mystery}
              spinning={spinning}
              controls={hub}
              onLever={() => (current ? respin() : doSpin(slots))}
              leverDisabled={spinning || (!!current && respins <= 0)}
            />
            {!current && (
              <p className="bal-cue" aria-hidden="true">
                {spinning ? 'Spinning…' : `Spin for trait ${filled + 1} of ${features.length}`}
              </p>
            )}

            {current && spinState && (
              <div className="bal-landed" key={spinState.id}>
                <div className="bal-landed-card bal-emerge">
                  <GameBanner player={current as GamePlayer} size="card" sealed={mystery} sealedHint={pos} />
                </div>
                <p className="bal-cue">
                  Lock one trait. <span className="hidden sm:inline">Press 1–{features.length} or click. </span>Grey cards are filled slots.
                </p>
                <ol className="bal-traits" ref={traitsRef} aria-label="His traits">
                  {features.map((f, i) => {
                    const v = f.get(current);
                    const pct = skillPct(f, baseline.get(f.id) ?? [], v);
                    const taken = slots[i];
                    const ok = !taken && Number.isFinite(v);
                    const name = traitName(pos, f);
                    const mid = (features.length - 1) / 2;
                    return (
                      <li key={f.id} className="bal-fan" style={{ '--i': i, '--fan': `${(i - mid) * 3}deg` } as CSSProperties}>
                        <button
                          type="button"
                          className="bal-trait"
                          disabled={!ok}
                          onClick={() => lock(i)}
                          title={`${f.label} ${fmtFeature(f, v)} · ${ordinal(pct)} percentile${f.lowerIsBetter ? ' (lower is better, inverted)' : ''}. ${f.definition}`}
                          aria-label={`${i + 1}: ${name}, grade ${gradeFor(pct)?.grade ?? 'none'}: ${f.label} ${fmtFeature(f, v)}, ${ordinal(pct)} percentile. ${f.definition}${
                            taken ? ` Slot already filled with ${fmtFeature(f, taken.value)}.` : !Number.isFinite(v) ? ' No data.' : ' Lock this trait.'
                          }`}
                        >
                          <span className="bal-trait-top" aria-hidden="true">
                            <span className="bal-key">{i + 1}</span>
                            <span className="bal-stat">{f.label}</span>
                          </span>
                          <span className="bal-trait-name" aria-hidden="true">
                            {name}
                          </span>
                          <span className="bal-grade-row" aria-hidden="true">
                            <GradeChip pct={pct} size="lg" />
                          </span>
                          {taken && (
                            <span className="bal-lock" aria-hidden="true">
                              Filled · <GradeChip pct={skillPct(f, baseline.get(f.id) ?? [], taken.value)} size="sm" />
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          <aside className={cn('bal-build', sheetOpen && 'open')} aria-label="Your build">
            <button type="button" className="bal-sheet-toggle" aria-expanded={sheetOpen} onClick={() => setSheetOpen((o) => !o)}>
              <span>
                Your build · {filled}/{features.length} · Overall {overall ? `${overall.grade.grade} ${overall.rating}` : '—'}
              </span>
              <span aria-hidden="true">{sheetOpen ? '▼' : '▲'}</span>
            </button>
            <h4 className="bal-build-title">
              Your build · {filled}/{features.length}
            </h4>
            <div className="bal-build-body">{buildPanel}</div>
          </aside>
        </div>
      </div>
    );
  }

  // ---------- Reveal ----------
  if (!result) return null;
  const top = result.matches[0];
  const runners = result.matches.slice(1, 3);
  const sim = top?.similarity ?? 0;
  const hof = hofVerdict(result.hofComps, result.compsConsidered);
  const finalOverall = result.overall;
  return (
    <div>
      <style>{CSS}</style>
      <Confetti fire={confetti} />
      {scoreboard}
      <div className="bal-reveal">
        <div className="bal-stage">
          <h3 ref={headRef} tabIndex={-1} className="bal-kicker">
            {stage === 0 ? `Scanning ${result.matches.length} league ${plural(result.position)}…` : 'Your creation plays like…'}
          </h3>
          {stage === 0 && (
            <p className="bal-scan" aria-hidden="true">
              {scanName}
            </p>
          )}
          {stage < 3 && (
            <ArcadeButton tone="ghost" onClick={() => setStage(3)} style={{ marginTop: 10 }}>
              Skip to the result
            </ArcadeButton>
          )}
        </div>

        {stage >= 2 && top && (
          <div className="bal-hero">
            <div className="bal-hero-card flip-y">
              <GameBanner player={top.player as GamePlayer} size="card" reveal ovr={ovrMap?.get(playerKey(top.player)) ?? null} nameAs="h4" />
            </div>
            <div className="bal-sim" aria-hidden="true">
              <CountUp value={Math.round(sim)} duration={900} />%<small>similar</small>
            </div>
            <div className="bal-actions">
              <span className="bal-verdict pop">{verdictFor(sim)}</span>
              {finalOverall && (
                <span className="bal-verdict pop" style={{ color: 'var(--chalk)' }}>
                  Your overall <GradeChip pct={finalOverall.pct} size="sm" /> <span data-overall="result">{`${finalOverall.grade.grade} ${finalOverall.rating}`}</span>
                </span>
              )}
            </div>
            {top.smallSample && <span className="hint">Small sample: he has played {top.player.games} games.</span>}
          </div>
        )}

        {stage >= 3 && top && (
          <>
            <p className="sr-only" role="status">
              Your creation plays like {top.player.name}, {Math.round(sim)}% similar. {verdictFor(sim)}.
            </p>
            {(Math.round(sim) >= CLONE_THRESHOLD || newBest) && (
              <div className="bal-actions">
                {Math.round(sim) >= CLONE_THRESHOLD && <span className="bal-badge">★ Achievement: Perfect clone</span>}
                {newBest && <span className="bal-badge">New best: {Math.round(sim)}%</span>}
              </div>
            )}
            <div className="bal-grid2 rise">
              <StyleChart result={result} baseline={baseline} />
              <div className="bal-facts">
                {finalOverall && (
                  <div className="bal-fact">
                    <div className="k">Build overall</div>
                    <div className="v gold" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <GradeChip pct={finalOverall.pct} size="md" />
                      <span data-overall="card">{`${finalOverall.grade.grade} ${finalOverall.rating}`}</span> · {finalOverall.tier}
                    </div>
                    <p>
                      Your traits average the {ordinal(finalOverall.pct)} percentile among league {plural(result.position)}, on the official 62–99 OVR curve.
                    </p>
                  </div>
                )}
                <div className="bal-fact">
                  <div className="k">Hall of Fame bound?</div>
                  <div className="v" style={{ color: result.hofComps / Math.max(1, result.compsConsidered) >= 0.5 ? 'var(--turf)' : 'var(--chalk)' }}>
                    {hof.label}
                  </div>
                  <p>{hof.detail}</p>
                </div>
                {runners.length > 0 && (
                  <div>
                    <div className="bal-k" style={{ marginBottom: 6 }}>
                      Next closest
                    </div>
                    <ol className="bal-runners">
                      {runners.map((c, i) => (
                        <li key={playerKey(c.player)} style={{ minWidth: 0 }}>
                          <GameBanner
                            player={c.player as GamePlayer}
                            size="compact"
                            reveal
                            ovr={ovrMap?.get(playerKey(c.player)) ?? null}
                            topRight={<span className="lamp">{Math.round(c.similarity)}%</span>}
                            eyebrow={`#${i + 2} match${c.smallSample ? ' · small sample' : ''}`}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
            <div className="bal-actions">
              <ArcadeButton tone="go" onClick={start} autoFocus>
                Build another {result.position}
              </ArcadeButton>
              <ArcadeButton tone="ghost" onClick={() => setPhase('setup')}>
                Change position
              </ArcadeButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BuildALegend;
