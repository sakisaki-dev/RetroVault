import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Roving tabindex for a group of buttons: one tab stop for the group,
 * arrow keys / Home / End move focus within it.
 */
export const useRovingFocus = (count: number, initialIndex = 0) => {
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0)));
  const refs = useRef<(HTMLElement | null)[]>([]);

  const focusAt = useCallback(
    (i: number) => {
      if (!count) return;
      const next = Math.min(Math.max(i, 0), count - 1);
      setIndex(next);
      refs.current[next]?.focus();
    },
    [count],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const current = refs.current.findIndex((el) => el === document.activeElement);
      if (current < 0) return;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = current + 1;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = current - 1;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        case 'PageDown':
          next = current + 10;
          break;
        case 'PageUp':
          next = current - 10;
          break;
      }
      if (next !== null) {
        e.preventDefault();
        focusAt(next);
      }
    },
    [count, focusAt],
  );

  const itemProps = useCallback(
    (i: number) => ({
      ref: (el: HTMLElement | null) => {
        refs.current[i] = el;
      },
      tabIndex: i === index ? 0 : -1,
      onFocus: () => setIndex(i),
    }),
    [index],
  );

  return { index, setIndex, focusAt, onKeyDown, itemProps };
};
