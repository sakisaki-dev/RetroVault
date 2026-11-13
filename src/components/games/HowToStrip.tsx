import { useEffect, useState, type ReactNode } from 'react';
import './howToStrip.css';

const storeKey = (id: string) => `retroVault:games:howto:${id}`;

/** Seen = folded. Also honours the two older schemes (stageKit wrote 'closed', rosterKit used arcade:howto:<id>). */
const readSeen = (id: string) => {
  try {
    const v = localStorage.getItem(storeKey(id));
    if (v === '1' || v === 'closed') return true;
    if (v === 'open') return false;
    return localStorage.getItem(`arcade:howto:${id}`) === '1';
  } catch {
    return false;
  }
};

/**
 * The Arcade's one how-to: numbered steps in one strip above the game, used by every game. Open on the first
 * visit; "Got it" folds it into a small "How to play" button (remembered per browser under
 * retroVault:games:howto:<id>); the game is playable the whole time. `keys` adds a keyboard hint line
 * (hidden on touch screens).
 */
const HowToStrip = ({
  id,
  steps,
  accent = 'var(--gold)',
  closeLabel = 'Got it',
  keys,
  onOpenChange,
}: {
  id: string;
  steps: ReactNode[];
  accent?: string;
  closeLabel?: string;
  /** Keyboard shortcuts, shown under the steps on devices with a pointer */
  keys?: ReactNode;
  /** Told whenever the strip opens or folds (and once on mount) */
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(() => !readSeen(id));
  useEffect(() => {
    onOpenChange?.(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(storeKey(id), '1');
      localStorage.removeItem(`arcade:howto:${id}`);
    } catch {
      // storage unavailable: the strip just reopens next visit
    }
  };
  if (!open) {
    return (
      <div className="howto-min">
        <button type="button" className="howto-reopen" onClick={() => setOpen(true)} aria-expanded={false} aria-controls={`howto-${id}`}>
          <span aria-hidden="true">?</span> How to play
        </button>
      </div>
    );
  }
  return (
    <section id={`howto-${id}`} className="howto" aria-label="How to play" style={{ ['--ht' as string]: accent }}>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>
            <b aria-hidden="true">{i + 1}</b>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {keys && <p className="howto-keys">{keys}</p>}
      <button type="button" className="howto-close" onClick={close}>
        {closeLabel}
      </button>
    </section>
  );
};

export default HowToStrip;
