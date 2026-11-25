/**
 * A tap anywhere on a player card opens him, through the card's own name button (the card keeps one real button for
 * keyboards and screen readers). Buttons and links inside keep their own tap. Put it on the card's onClick and give the
 * card the `ix-card` class for the lift, rim and figure hop (src/styles/interact.css).
 */
export const cardTap = (e: { target: EventTarget; currentTarget: HTMLElement }) => {
  if ((e.target as HTMLElement).closest('button, a')) return;
  e.currentTarget.querySelector<HTMLButtonElement>('button')?.click();
};
