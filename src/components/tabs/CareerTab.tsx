import { useLeague } from '@/context/LeagueContext';
import FileUpload from '../FileUpload';
import QBTable from '../tables/QBTable';
import RBTable from '../tables/RBTable';
import ReceiverTable from '../tables/ReceiverTable';
import OLTable from '../tables/OLTable';
import DefenseTable from '../tables/DefenseTable';
import LeagueOverview from './LeagueOverview';
import { Trophy, Users, Award } from 'lucide-react';

const CareerTab = () => {
  const { careerData, loadCareerData, isLoading } = useLeague();

  const handleFileLoad = (content: string, filename: string) => {
    loadCareerData(content);
  };

  if (!careerData) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4 glow-text">
            Welcome to Retro Vault
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your league CSV file to begin tracking career stats, 
            analyzing player performance, and discovering statistical leaders.
          </p>
        </div>
        <div className="max-w-md mx-auto">
          <FileUpload onFileLoad={handleFileLoad} label="Upload Career Data CSV" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <LeagueOverview data={careerData} />
          
          <div className="space-y-6">
            {/* Offense */}
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold tracking-wide text-primary flex items-center gap-2">
                <Award className="w-5 h-5" />
                OFFENSE
              </h2>
              
              {careerData.quarterbacks.length > 0 && (
                <QBTable players={careerData.quarterbacks} />
              )}
              
              {careerData.runningbacks.length > 0 && (
                <RBTable players={careerData.runningbacks} />
              )}
              
              {careerData.widereceivers.length > 0 && (
                <ReceiverTable 
                  players={careerData.widereceivers} 
                  position="WR" 
                  title="Wide Receivers" 
                />
              )}
              
              {careerData.tightends.length > 0 && (
                <ReceiverTable 
                  players={careerData.tightends} 
                  position="TE" 
                  title="Tight Ends" 
                />
              )}
              
              {careerData.offensiveline.length > 0 && (
                <OLTable players={careerData.offensiveline} />
              )}
            </div>

            {/* Defense */}
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold tracking-wide text-accent flex items-center gap-2">
                <Users className="w-5 h-5" />
                DEFENSE
              </h2>
              
              {careerData.linebackers.length > 0 && (
                <DefenseTable 
                  players={careerData.linebackers} 
                  position="LB" 
                  title="Linebackers" 
                />
              )}
              
              {careerData.defensivebacks.length > 0 && (
                <DefenseTable 
                  players={careerData.defensivebacks} 
                  position="DB" 
                  title="Defensive Backs" 
                />
              )}
              
              {careerData.defensiveline.length > 0 && (
                <DefenseTable 
                  players={careerData.defensiveline} 
                  position="DL" 
                  title="Defensive Line" 
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CareerTab;
