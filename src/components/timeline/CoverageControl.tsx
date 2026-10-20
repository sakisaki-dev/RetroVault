import type { ContentSource } from '@/utils/leagueContent';

interface CoverageControlProps {
  source: ContentSource;
  season?: string;
  storyCount: number;
}

/**
 * Where the league history comes from. It is generated from the save's data on every rebuild
 * (scripts/build_league_content.py); new information enters through an upload bundle, not here.
 */
const CoverageControl = ({ source, season, storyCount }: CoverageControlProps) => (
  <span className="rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
    {source === 'none' ? 'No league history loaded' : `Generated from the ${season ?? ''} data`}
    {storyCount ? ` · ${storyCount} eras` : ''}
  </span>
);

export default CoverageControl;
