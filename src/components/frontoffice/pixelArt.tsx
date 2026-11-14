/**
 * Small pixel drawings for the Club office (ClubOffice.tsx): facility buildings and counter-group icons, drawn as SVG
 * rects from character grids (crisp edges, no images). Each character is a colour key; "." is empty.
 */

type Palette = Record<string, string>;

const Grid = ({ rows, palette, px, title, className }: { rows: string[]; palette: Palette; px: number; title?: string; className?: string }) => {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rects: JSX.Element[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const fill = palette[c];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * px}
      height={h * px}
      shapeRendering="crispEdges"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
};

/* ---- Facilities: 22 x 14 scenes. a = club colour, b = club dark, g = gold lamp, w = chalk, s = steel, t = turf, r = red ---- */
const STADIUM = [
  '..g..............g....',
  '.ggg............ggg...',
  '..s..............s....',
  '..s...wwwwwwwww..s....',
  '..s.wwaaaaaaaaaww.s...',
  '..swaaaaaaaaaaaaaws...',
  '..waabbbbbbbbbbbaaw...',
  '..wabtttttttttttbaw...',
  '..wabtwtttwtttwtbaw...',
  '..wabtttttttttttbaw...',
  '..waabbbbbbbbbbbaaw...',
  '..swaaaaaaaaaaaaaws...',
  '..s.wwwwwwwwwwwww.s...',
  'ssssssssssssssssssssss',
];
const TRAINING = [
  '......................',
  '....aaaaaaaaaaaaaa....',
  '...aaaaaaaaaaaaaaaa...',
  '..aaaaaaaaaaaaaaaaaa..',
  '..wwwwwwwwwwwwwwwwww..',
  '..wbbbbbbbbbbbbbbbbw..',
  '..wb.ss........ss.bw..',
  '..wb.ssgggggggggssbw..',
  '..wb.ss........ss.bw..',
  '..wbbbbbbbbbbbbbbbbw..',
  '..wttttttbbbbttttttw..',
  '..wttttttb..bttttttw..',
  '..wttttttb..bttttttw..',
  'ssssssssssssssssssssss',
];
const REHAB = [
  '.......wwwwwwww.......',
  '.......w..rr..w.......',
  '.......w.rrrr.w.......',
  '.......w..rr..w.......',
  '..wwwwwwwwwwwwwwwwww..',
  '..waaaaaaaaaaaaaaaaw..',
  '..wa.gg.gg..gg.gg.aw..',
  '..wa.gg.gg..gg.gg.aw..',
  '..waaaaaaaaaaaaaaaaw..',
  '..wa.gg.gg..gg.gg.aw..',
  '..waaaaaabbbbaaaaaaw..',
  '..waaaaaab..baaaaaaw..',
  '..waaaaaab..baaaaaaw..',
  'ssssssssssssssssssssss',
];
export const FACILITY_ART = { stadium: STADIUM, training: TRAINING, rehab: REHAB } as const;

export const Facility = ({ id, ink, dark, lit, px = 4 }: { id: keyof typeof FACILITY_ART; ink: string; dark: string; lit: boolean; px?: number }) => (
  <Grid
    rows={FACILITY_ART[id]}
    px={px}
    palette={{
      a: ink,
      b: dark,
      g: lit ? 'hsl(43 100% 62%)' : 'hsl(43 30% 30%)',
      w: 'hsl(228 60% 90%)',
      s: 'hsl(226 20% 45%)',
      t: 'hsl(147 67% 30%)',
      r: 'hsl(354 100% 65%)',
    }}
  />
);

/* ---- Counter-group icons, 7 x 7 ---- */
const ICONS = {
  // two arrows passing: trades
  roster: ['...x...', '..xxx..', '.x.x.x.', '...x...', '.x.x.x.', '..xxx..', '...x...'],
  // trophy: results
  results: ['xxxxxxx', 'x.xxx.x', '.xxxxx.', '..xxx..', '...x...', '..xxx..', '.xxxxx.'],
  // football: game feats
  feats: ['..xxx..', '.xxxxx.', 'xx.x.xx', 'xxxxxxx', 'xx.x.xx', '.xxxxx.', '..xxx..'],
  // building: facilities
  facilities: ['...x...', '..xxx..', '.xxxxx.', 'x.x.x.x', 'xxxxxxx', 'x.x.x.x', 'xxxxxxx'],
  // goal post: doinks
  post: ['x.....x', 'x.....x', 'x.....x', 'xxxxxxx', '...x...', '...x...', '...x...'],
  // coin
  coin: ['..xxx..', '.xyyyx.', 'xyyxyyx', 'xyxxxyx', 'xyyxyyx', '.xyyyx.', '..xxx..'],
} as const;
export type PixelIconId = keyof typeof ICONS;

export const PixelIcon = ({ id, color, px = 2, title }: { id: PixelIconId; color: string; px?: number; title?: string }) => (
  <Grid rows={[...ICONS[id]]} px={px} title={title} palette={{ x: color, y: id === 'coin' ? 'hsl(43 100% 75%)' : color }} />
);

/* ---- A coordinator: cap, headset and clipboard. a = club colour, c = cap brim (dark club), s = skin, k = headset,
   m = mic, w = paper, p = clipboard, b = trousers, d = shoes, e = eyes ---- */
const COACH = [
  '....aaaaaa......',
  '...aaaaaaaa.....',
  '..ccccccccc.....',
  '..kssssssk......',
  '..ksesseskm.....',
  '...ssssssm......',
  '....sssssm......',
  '...aaaaaaaa.....',
  '..aaaaaaaaaa....',
  '.aaaaaaaapppp...',
  '.asaaaaaapwwp...',
  '.asaaaaaapwwp...',
  '.ssaaaaaapwwp...',
  '...aaaaaapppp...',
  '...bbbbbbb......',
  '...bbb.bbb......',
  '...bbb.bbb......',
  '..dddd.dddd.....',
];
export const Coach = ({ ink, dark, px = 4 }: { ink: string; dark: string; px?: number }) => (
  <Grid
    rows={COACH}
    px={px}
    palette={{ a: ink, c: dark, s: 'hsl(28 45% 62%)', e: 'hsl(228 47% 7%)', k: 'hsl(228 30% 18%)', m: 'hsl(228 20% 40%)', w: 'hsl(228 60% 92%)', p: 'hsl(28 45% 35%)', b: 'hsl(228 30% 22%)', d: 'hsl(228 47% 7%)' }}
  />
);

/* ---- A warning sign: r = red, w = white ---- */
const SIGN = ['....r....', '...rrr...', '...rwr...', '..rrwrr..', '..rrwrr..', '.rrrrrrr.', '.rrrwrrr.', 'rrrrrrrrr'];
export const WarnSign = ({ px = 3 }: { px?: number }) => <Grid rows={SIGN} px={px} palette={{ r: 'hsl(354 100% 62%)', w: '#fff' }} />;
const CHECK = ['..ggggg..', '.ggggggg.', 'gggggggwg', 'ggggggwgg', 'gwgggwggg', 'ggwgwgggg', '.ggwgggg.', '..ggggg..'];
export const SafeSign = ({ px = 3 }: { px?: number }) => <Grid rows={CHECK} px={px} palette={{ g: 'hsl(149 64% 43%)', w: 'hsl(150 80% 6%)' }} />;
