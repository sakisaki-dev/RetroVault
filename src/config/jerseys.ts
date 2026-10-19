// Jersey number configuration. See src/utils/jerseys.ts for how numbers are assigned.

/**
 * Real jersey numbers, keyed by "POS:Name" exactly as the player appears in the league sheet
 * (e.g. "QB:Lamar Jackson": 8, "WR:Ja’Marr Chase": 1).
 *
 * Put real numbers here. Anyone not listed gets a stable, position-appropriate number derived
 * from their name. An override still has to be unique within the player's franchise: if two
 * players on the same team claim the same number (or one claims a number retired for someone
 * else), the first claim wins and the other player falls back to an automatic number.
 */
export const JERSEY_OVERRIDES: Record<string, number> = {
  // Pinned so the Seahawks' retired #48 (below) always matches the number he wears.
  'RB:Rondale Ikarras': 48,
};

export interface RetiredNumberEntry {
  /** Jersey number to retire */
  number: number;
  /** Who it honors. If this matches a player on the team ("POS:Name" or just the name), that player wears it. */
  name?: string;
  position?: string;
  /** Free text such as "Y15–30" */
  years?: string;
}

export interface RetiredOverride {
  /** Extra numbers to retire for this franchise */
  add?: RetiredNumberEntry[];
  /** Numbers that should NOT be retired even though a Hall of Famer wore them */
  remove?: number[];
}

/**
 * Per-franchise retirement tweaks. By default every franchise retires the number of each Hall of
 * Famer whose team is that franchise. Keys are a team id from nflTeams.ts ("bills", "49ers"), an
 * abbreviation ("BUF"), a nickname ("Bills") or a full name ("Buffalo Bills").
 *
 * Example:
 *   bills: { add: [{ number: 34, name: 'Micky Celek', position: 'RB' }], remove: [12] },
 */
export const RETIRED_OVERRIDES: Record<string, RetiredOverride> = {
  // Ikarras is a Seahawks legend (titles Y36–38, Ikarras era). He finished with one season as a
  // Jet, so the Jets don't retire his number; the Seahawks do.
  seahawks: { add: [{ number: 48, name: 'Rondale Ikarras', position: 'RB', years: 'Y36–46' }] },
  jets: { remove: [48] },
};

/**
 * Real-life numbers for the real NFL players in public/data/legends.json (keyed by name as it
 * appears there). Used only for players flagged `isRealLegend`; legends never take part in
 * franchise uniqueness or retirements. Anyone missing falls back to a generated number.
 * Where a player wore several numbers, this is the one most associated with him.
 */
export const LEGEND_NUMBERS: Record<string, number> = {
  // Sheet legends
  'Tom Brady': 12,
  'Aaron Rodgers': 12,
  'Jerry Rice': 80,
  'Rob Gronkowski': 87,
  'Bruce Matthews': 74,
  // Retired legends
  'Peyton Manning': 18,
  'Drew Brees': 9,
  'Joe Montana': 16,
  'Dan Marino': 13,
  'Brett Favre': 4,
  'John Elway': 7,
  'Steve Young': 8,
  'Emmitt Smith': 22,
  'Walter Payton': 34,
  'Barry Sanders': 20,
  'LaDainian Tomlinson': 21,
  'Adrian Peterson': 28,
  'Jim Brown': 32,
  'Randy Moss': 84,
  'Terrell Owens': 81,
  'Larry Fitzgerald': 11,
  'Calvin Johnson': 81,
  'Tony Gonzalez': 88,
  'Shannon Sharpe': 84,
  'Ray Lewis': 52,
  'Lawrence Taylor': 56,
  'Reggie White': 92,
  'J.J. Watt': 99,
  'Ed Reed': 20,
  'Deion Sanders': 21,
  'Troy Polamalu': 43,
  'Charles Woodson': 24,
  'Johnny Unitas': 19,
  'Terry Bradshaw': 12,
  'Roger Staubach': 12,
  'Eric Dickerson': 29,
  'Marvin Harrison': 88,
  'Steve Largent': 80,
  'Tim Brown': 81,
  'Michael Irvin': 88,
  'Antonio Gates': 85,
  'Kellen Winslow': 80,
  'Anthony Muñoz': 78,
  'Jonathan Ogden': 75,
  'Larry Allen': 73,
  'Dick Butkus': 51,
  'Ronnie Lott': 42,
  'Bruce Smith': 78,
  // Current stars (isCurrentNFL)
  'Patrick Mahomes': 15,
  'Josh Allen': 17,
  'Joe Burrow': 9,
  'Saquon Barkley': 26,
  'Derrick Henry': 22,
  'Christian McCaffrey': 23,
  'Bijan Robinson': 7,
  'Justin Jefferson': 18,
  'Tyreek Hill': 10,
  'Jaxon Smith-Njigba': 11,
  'Travis Kelce': 87,
  'George Kittle': 85,
  'T.J. Watt': 90,
  'Fred Warner': 54,
  'Myles Garrett': 95,
  'Patrick Surtain II': 2,
  // Left out (number changed recently / not certain): Puka Nacua, Micah Parsons
};
