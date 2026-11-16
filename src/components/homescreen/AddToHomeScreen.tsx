import { useEffect, useState } from 'react';
import { PlusSquare, Share, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INSTALL_EVENT, initPersistence, installGuideDue, markInstallGuideShown, openInstallGuide, requestPersistence, usePersistence } from '@/utils/homeScreen';
import './homeScreen.css';

/**
 * A gentle Add to Home Screen card for iPhone browser tabs (src/utils/homeScreen.ts): the two steps and the reason in
 * one line. It shows a few seconds after the page settles, at most once a week, and never in the Home Screen app.
 * "Not now" and the close button dismiss it; the Collection's storage tag can open it again.
 */
export const AddToHomeScreen = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    initPersistence();
    const show = () => {
      markInstallGuideShown();
      setOpen(true);
    };
    window.addEventListener(INSTALL_EVENT, show);
    const t = installGuideDue() ? window.setTimeout(show, 6000) : 0;
    return () => {
      window.removeEventListener(INSTALL_EVENT, show);
      window.clearTimeout(t);
    };
  }, []);

  if (!open) return null;
  return (
    <aside className="a2hs" role="dialog" aria-modal="false" aria-labelledby="a2hs-title" aria-describedby="a2hs-why">
      <img className="a2hs__icon" src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" width={48} height={48} />
      <div className="min-w-0 flex-1">
        <p id="a2hs-title" className="a2hs__title">
          Add Retro Vault to your Home Screen
        </p>
        <p id="a2hs-why" className="a2hs__why">
          It opens full screen and keeps your card collection safe.
        </p>
        <ol className="a2hs__steps">
          <li>
            <span className="a2hs__n">1</span> Tap <Share className="a2hs__glyph" aria-label="Share" /> <b>Share</b>
          </li>
          <li>
            <span className="a2hs__n">2</span> Choose <PlusSquare className="a2hs__glyph" aria-hidden="true" /> <b>Add to Home Screen</b>
          </li>
        </ol>
        <button type="button" className="a2hs__later" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
      <button type="button" className="a2hs__x" onClick={() => setOpen(false)} aria-label="Close">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
};

/**
 * The collection's storage state, beside the coin and shard counters: "Saved on this device" once the browser has
 * granted persistent storage (always in the Home Screen app); on an iPhone tab a button to the Add to Home Screen
 * steps; elsewhere "Browser storage" (or, in Firefox, a tap to ask for it).
 */
export const StorageTag = ({ className }: { className?: string }) => {
  const { persist, standalone, ios, askOnTap } = usePersistence();
  if (persist === 'persisted' || (standalone && ios)) {
    return (
      <span className={cn('a2hs-tag a2hs-tag--ok', className)} title="Your collection is stored on this device and won't be cleared by the browser">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Saved on this device
      </span>
    );
  }
  if (persist === 'unknown' || persist === 'unsupported') return null;
  if (ios && !standalone) {
    return (
      <button type="button" className={cn('a2hs-tag', className)} onClick={openInstallGuide} title="Safari clears a site's saved data after 7 days without a visit; Home Screen apps are exempt">
        <PlusSquare className="h-3.5 w-3.5" aria-hidden="true" />
        Add to Home Screen
      </button>
    );
  }
  if (askOnTap) {
    return (
      <button
        type="button"
        className={cn('a2hs-tag', className)}
        onClick={() => void requestPersistence()}
        title="Ask the browser to keep your collection when it clears space"
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Keep on this device
      </button>
    );
  }
  return (
    <span className={cn('a2hs-tag', className)} title="Stored in this browser; clearing site data removes it">
      Browser storage
    </span>
  );
};

export default AddToHomeScreen;
