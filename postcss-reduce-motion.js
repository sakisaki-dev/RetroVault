/*
 * Reduce motion, one source of truth for CSS. src/hooks/usePerfMode.ts sets <html data-reduce-motion> when the OS asks
 * for reduced motion OR the site's own switch (Performance mode "On") is on. Every stylesheet already writes its motion
 * rules against the OS media query, so this plugin makes the attribute count too, with no per-file edits:
 *
 *   @media (prefers-reduced-motion: reduce) { X }   gets a twin: the same rules under the attribute
 *                                                   (:where(:root[data-reduce-motion]) X, same specificity as X)
 *   @media (prefers-reduced-motion: no-preference) { X }   has its selectors scoped to :root:not([data-reduce-motion]),
 *                                                   so the site's switch also turns the "motion on" rules off
 *
 * Runs after Tailwind, so `motion-reduce:` / `motion-safe:` utilities are covered as well.
 */
const ATTR = '[data-reduce-motion]';
const REDUCE = /\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/;
const NOPREF = /\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/;

const on = (sel) => {
  const s = sel.trim();
  if (/^:root/.test(s)) return `:root${ATTR}` + s.slice(5);
  if (/^html(?![\w-])/.test(s)) return `html${ATTR}` + s.slice(4);
  return `:where(:root${ATTR}) ${s}`;
};
const off = (sel) => {
  const s = sel.trim();
  if (/^:root/.test(s)) return `:root:not(${ATTR})` + s.slice(5);
  if (/^html(?![\w-])/.test(s)) return `html:not(${ATTR})` + s.slice(4);
  return `:where(:root:not(${ATTR})) ${s}`;
};

const retarget = (container, fn) => {
  container.walkRules((rule) => {
    let p = rule.parent;
    while (p && p !== container) {
      if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
      p = p.parent;
    }
    rule.selectors = rule.selectors.map(fn);
  });
};

const plugin = () => ({
  postcssPlugin: 'rv-reduce-motion',
  Once(root) {
    const found = [];
    root.walkAtRules('media', (a) => {
      if (REDUCE.test(a.params) || NOPREF.test(a.params)) found.push(a);
    });
    for (const a of found) {
      if (REDUCE.test(a.params)) {
        const parts = a.params.split(',').map((p) => p.trim());
        const rest = [];
        let always = false;
        for (const p of parts) {
          if (!REDUCE.test(p)) continue;
          const r = p.replace(REDUCE, '').replace(/^\s*and\s+/i, '').replace(/\s+and\s*$/i, '').replace(/\s+and\s+(?=and\b)/i, ' ').trim();
          if (!r || r === 'and') always = true;
          else rest.push(r.replace(/^and\s+/i, ''));
        }
        const twin = a.clone();
        retarget(twin, on);
        if (always || !rest.length) {
          a.after(twin.nodes.map((n) => n.clone()));
        } else {
          twin.params = rest.join(', ');
          a.after(twin);
        }
      } else if (NOPREF.test(a.params)) {
        retarget(a, off);
      }
    }
  },
});
plugin.postcss = true;
export default plugin;
