/**
 * Ref callback for an <img>: one still on its way starts transparent and fades in when it lands, so a lazy image
 * never pops into its (already reserved) box. One that is already decoded (cached) shows at once, with no fade.
 * Opacity only; reduced motion keeps a short fade (motion tokens shorten it).
 */
export const fadeInOnLoad = (img: HTMLImageElement | null) => {
  if (!img || img.complete) return;
  img.style.opacity = '0';
  const done = () => {
    img.style.transition = 'opacity var(--dur-2, 200ms) var(--ease-out, ease-out)';
    img.style.opacity = '';
    // Hand the element back to its own CSS transitions (hover effects) once the fade is over
    window.setTimeout(() => {
      img.style.transition = '';
    }, 400);
  };
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
};
