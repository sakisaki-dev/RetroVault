import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { mergeRefs, useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { pushOverlay } from "@/utils/overlayHistory";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "dlg-overlay fixed inset-0 z-50 bg-black/80",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Swipe down to close on touch screens (on by default) */
  swipeToClose?: boolean;
  /** Hide the built-in close button (the dialog draws its own; swipe still closes) */
  hideClose?: boolean;
  /** Swipe-to-close hands the release to onOpenChange where the finger left it (the dialog runs its own exit) */
  swipeHandoff?: boolean;
  /**
   * Extra classes for this dialog's backdrop. Style the backdrop through this, never with a `:has(+ .my-dialog)`
   * rule: a sibling `:has()` makes every modal open restyle the whole page (Radix inserts focus guards into <body>).
   */
  overlayClassName?: string;
  /**
   * On phones (up to 640 px) the dialog becomes a bottom sheet: full width, anchored to the bottom edge with rounded
   * top corners and the grab handle, sliding up from below and back down to close (index.css, .dlg--psheet). For big,
   * content-heavy dialogs (the player card); small confirmations stay centred.
   */
  phoneSheet?: boolean;
  /**
   * Phones: also swipe right to close (a full-screen card or page-like dialog). The panel follows the finger and the
   * page shows behind it; drags from the left 24 px (the system's own Back swipe) and on sideways scrollers are left alone.
   */
  swipeRight?: boolean;
}

/*
 * The close button and the phone grab handle sit in a zero-height sticky bar at the top of the content, so they stay
 * in view (and inside the safe area) while a long dialog scrolls. The bar is pulled out to the content's edges and
 * cancels the layout gap after it, so it never shifts the dialog's own layout. It comes last in the DOM (so opening
 * focuses the dialog's first control, not Close, as before) and is moved to the top with `order: -1`.
 * Shared by DialogContent and SheetContent.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useModalChrome = <T extends HTMLElement>(
  ref: React.ForwardedRef<T>,
  swipeToClose: boolean,
  hideClose = false,
  swipeHandoff = false,
  swipeRight = false,
) => {
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const swipeRef = useSwipeToDismiss<T>({
    onDismiss: () => closeRef.current?.click(),
    enabled: swipeToClose || swipeRight,
    down: swipeToClose,
    right: swipeRight,
    backdrop: () => overlayRef.current,
    handoff: swipeHandoff,
  });
  const nodeRef = React.useRef<T | null>(null);
  const [node, setNode] = React.useState<T | null>(null);
  const contentRef = React.useMemo(() => mergeRefs<T>(ref, swipeRef, nodeRef, setNode), [ref, swipeRef]);
  /*
   * Phones: an open dialog or sheet is a history entry (utils/overlayHistory), so the system Back (Safari's edge swipe,
   * Android Back) closes it. It counts as open while Radix says data-state="open": the entry is let go the moment the
   * close starts (X, tap outside, Escape, swipe), not when the exit animation ends, and taken again if it reopens.
   */
  React.useEffect(() => {
    if (!node) return;
    let release: (() => void) | null = null;
    const sync = () => {
      const open = node.getAttribute("data-state") !== "closed";
      if (open && !release) release = pushOverlay(() => closeRef.current?.click());
      else if (!open && release) {
        release();
        release = null;
      }
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(node, { attributes: true, attributeFilter: ["data-state"] });
    return () => {
      mo.disconnect();
      release?.();
    };
  }, [node]);
  React.useLayoutEffect(() => {
    const bar = barRef.current;
    const box = bar?.parentElement;
    if (!bar || !box) return;
    const cs = getComputedStyle(box);
    const gap = parseFloat(cs.rowGap) || 0;
    bar.style.margin = `-${cs.paddingTop} -${cs.paddingRight} ${gap ? -gap : 0}px -${cs.paddingLeft}`;
  });
  const bar = (
    <div ref={barRef} className="dlg-bar">
      {swipeToClose && (
        <div className="dlg-grab" data-swipe-handle aria-hidden="true">
          <span />
        </div>
      )}
      <DialogPrimitive.Close ref={closeRef} className="dlg-x" hidden={hideClose}>
        <X className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </div>
  );
  return { overlayRef, contentRef, nodeRef, bar };
};

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, swipeToClose = true, hideClose = false, swipeHandoff = false, overlayClassName, phoneSheet = false, swipeRight = false, ...props }, ref) => {
    const { overlayRef, contentRef, bar } = useModalChrome(ref, swipeToClose, hideClose, swipeHandoff, swipeRight);
    return (
      <DialogPortal>
        <DialogOverlay ref={overlayRef} className={overlayClassName} />
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn(
            // Motion: .dlg-anim in index.css (spring rise on open, quicker fade-and-drop on close; a slide-up on phones)
            "dlg dlg-anim fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
            className,
            phoneSheet && "dlg--psheet",
          )}
          {...props}
        >
          {children}
          {bar}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
