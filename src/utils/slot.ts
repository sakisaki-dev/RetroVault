import { useState, useSyncExternalStore } from 'react';

/**
 * A value held outside React state, for what a page opens over itself (the player card, the card detail). Setting it
 * re-renders only the components that read it (the dialog), never the page that opened it: a page-wide re-render of
 * every tile or table row used to sit in the tap's own task, before the dialog's first frame.
 */
export interface Slot<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
}

export const createSlot = <T,>(initial: T): Slot<T> => {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      const v = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      subs.forEach((f) => f());
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
};

/** One slot per component instance (stable across renders). */
export const useNewSlot = <T,>(initial: T): Slot<T> => useState(() => createSlot<T>(initial))[0];

/** The slot's current value; re-renders the caller when it changes. */
export const useSlot = <T,>(slot: Slot<T>): T => useSyncExternalStore(slot.subscribe, slot.get, slot.get);
