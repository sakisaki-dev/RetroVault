import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { Player } from '@/types/player';
import PixelLoader from '@/components/ui/PixelLoader';

const DdGraphs = lazy(() => import('./DdGraphs'));

/** Mounts the career graphs (their code and data) only once the section comes within a screen of the viewport. */
const DdGraphsLazy = ({ player, players, wide }: { player: Player; players: Player[]; wide: boolean }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return void setNear(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const loader = <PixelLoader label="Charting" what="the career graphs" minHeight={wide ? 420 : 520} />;
  return (
    <div ref={ref}>
      {near ? (
        <Suspense fallback={loader}>
          <DdGraphs player={player} players={players} wide={wide} />
        </Suspense>
      ) : (
        loader
      )}
    </div>
  );
};

export default DdGraphsLazy;
