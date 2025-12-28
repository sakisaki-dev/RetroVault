const STORAGE_KEY = 'retroVault:teamOverrides' as const;

export type TeamOverrides = Record<string, string>;

export const loadTeamOverrides = (): TeamOverrides => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as TeamOverrides;
  } catch {
    return {};
  }
};

export const saveTeamOverrides = (overrides: TeamOverrides) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
};

export const mergeTeamOverrides = (next: TeamOverrides) => {
  const current = loadTeamOverrides();
  const merged = { ...current, ...next };
  saveTeamOverrides(merged);
  return merged;
};
