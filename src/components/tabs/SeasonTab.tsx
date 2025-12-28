import { useLeague } from '@/context/LeagueContext';
import FileUpload from '../FileUpload';
import { Calendar, ArrowRight, BarChart3 } from 'lucide-react';

const SeasonTab = () => {
  const { careerData, loadSeasonData, currentSeason } = useLeague();

  const handleFileLoad = (content: string, filename: string) => {
    // Extract season from filename (e.g., "y31.csv" -> "Y31")
    const seasonMatch = filename.match(/y(\d+)/i);
    const seasonName = seasonMatch ? `Y${seasonMatch[1]}` : 'New Season';
    loadSeasonData(content, seasonName);
  };

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-6">
            <Calendar className="w-10 h-10 text-accent" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4 glow-text-accent" style={{ color: 'hsl(var(--accent))' }}>
            Season Stats
          </h2>
          <p className="text-muted-foreground text-lg">
            First, upload your career data in the Career tab to establish a baseline.
            Then return here to upload new season data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Current Season Header */}
        <div className="glass-card-glow p-8 mb-8 text-center">
          <p className="text-muted-foreground text-sm uppercase tracking-wider mb-2">Current Season</p>
          <h2 className="font-display text-5xl font-bold glow-text mb-4">{currentSeason}</h2>
          <p className="text-muted-foreground">
            Upload a new CSV file to advance to the next season
          </p>
        </div>

        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="glass-card p-6">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" />
              Upload New Season
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Upload your updated CSV file with the latest player stats. 
              The system will automatically calculate season stats by comparing 
              with the previous data.
            </p>
            <FileUpload onFileLoad={handleFileLoad} label="Upload Season CSV" />
          </div>

          <div className="glass-card p-6">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              How It Works
            </h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">1</span>
                <span className="text-muted-foreground">Upload your new season CSV with updated career totals</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">2</span>
                <span className="text-muted-foreground">System compares new data with previous season</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">3</span>
                <span className="text-muted-foreground">Season stats are calculated as the difference</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">4</span>
                <span className="text-muted-foreground">Commentary tab generates season analysis</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonTab;
