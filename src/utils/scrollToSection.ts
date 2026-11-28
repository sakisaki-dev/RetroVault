/*
 * In-page jumps that land exactly at a section's top, just under whatever covers the top of the screen once the scroll
 * is done. scrollIntoView can't: the page's scroll-padding (header + Stats bar) stacked on the sections' own scroll
 * margin left every Deep Dive jump ~270 px short, and the header tucks away on the way down (html[data-chrome]), so the
 * cover at the start of a jump is not the cover at its end. Here the cover is worked out as it will be (the chrome
 * away for a jump down, back for one up, sticky bars counted as stuck), and one check after the scroll settles corrects
 * any drift (content above that grew while lazy parts mounted).
 */
const GAP = 10;

const coverBottom = (target: Element, down: boolean): number => {
  // the header (.chrome-hide) and the Stats bar (.chrome-hide-bar) tuck away on a scroll down and return on one up; bars
  // that follow them (.chrome-follow) stick at the header's foot, or at the page top while it is away (index.css)
  const headerH = parseFloat(document.documentElement.style.getPropertyValue('--site-header-h')) || 0;
  const hiddenNow = document.documentElement.getAttribute('data-chrome') === 'hidden';
  const vw = window.innerWidth;
  let cover = 0;
  document.querySelectorAll<HTMLElement>('[data-site-header], [data-chrome-bar], .sticky, .chrome-follow').forEach((el) => {
    if (down && el.matches('.chrome-hide, .chrome-hide-bar')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.5 || r.height === 0) return;
    let bottom: number;
    if (cs.position === 'fixed') {
      if (r.top > 2 || r.bottom <= 0) return;
      bottom = r.bottom;
    } else if (cs.position === 'sticky') {
      // it only sticks inside its parent: a bar from another part of the page doesn't cover this section
      if (!el.parentElement?.contains(target) || el.contains(target)) return;
      // a follower's top includes the header while it shows: shift it to the state at the end of the jump
      const shift = el.matches('.chrome-follow') ? (down ? 0 : headerH) - (hiddenNow ? 0 : headerH) : 0;
      const top = parseFloat(cs.top) + shift;
      if (!Number.isFinite(top)) return;
      bottom = top + r.height;
    } else return;
    if (bottom < window.innerHeight * 0.5) cover = Math.max(cover, bottom);
  });
  return cover;
};

const yFor = (el: Element, down: boolean) => el.getBoundingClientRect().top + window.scrollY - coverBottom(el, down) - GAP;

let token = 0;
export const scrollToSection = (id: string | Element, smooth = true): void => {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  const mine = ++token;
  const down = el.getBoundingClientRect().top > 0;
  window.scrollTo({ top: Math.max(0, yFor(el, down)), behavior: smooth ? 'smooth' : 'auto' });
  // once the scroll has settled, put the section's top exactly under the cover (a small instant nudge, if any)
  let last = -1;
  let still = 0;
  const settle = () => {
    if (mine !== token) return;
    const y = window.scrollY;
    still = y === last ? still + 1 : 0;
    last = y;
    if (still < 3) return void window.setTimeout(settle, 60);
    const want = yFor(el, down);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(Math.min(Math.max(0, want), max) - y) > 3) window.scrollTo({ top: Math.max(0, want), behavior: 'auto' });
  };
  window.setTimeout(settle, smooth ? 120 : 0);
};
