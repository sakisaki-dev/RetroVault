/*
 * Cached number formatters. `n.toLocaleString('en-US', { … })` builds a new Intl.NumberFormat on every call, which is
 * slow enough to show up as dropped frames when a table or chart formats hundreds of values in one render (the Stats
 * page spent ~0.2-0.8 s in it on a throttled phone). These keep one formatter per option set and give the same strings.
 */
const cache = new Map<string, Intl.NumberFormat>();

const formatter = (min: number | undefined, max: number | undefined): Intl.NumberFormat => {
  const key = `${min ?? ''}|${max ?? ''}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
    cache.set(key, f);
  }
  return f;
};

/** `n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })` */
export const fmtFixed = (n: number, decimals: number): string => formatter(decimals, decimals).format(n);

/** `n.toLocaleString('en-US', { maximumFractionDigits: d })` */
export const fmtMaxDecimals = (n: number, decimals: number): string => formatter(undefined, decimals).format(n);
