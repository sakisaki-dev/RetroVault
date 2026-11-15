import PixelLoader from '@/components/ui/PixelLoader';

/**
 * Shown while a tab's code chunk loads on a cold start (pages/Index.tsx lazy-loads every tab; later switches keep the
 * old tab up instead). The pixel football holds the page's height and shows only after ~180 ms, so a quick load never
 * flashes it; the tab then cross-fades in (.rv-view-in).
 */
const TabFallback = ({ label = 'Kickoff' }: { label?: string }) => (
  <PixelLoader label={label} what="the page" minHeight="70vh" className="container justify-start pt-[18vh]" />
);

export default TabFallback;
