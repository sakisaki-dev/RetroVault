import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayerEditDialog from './PlayerEditDialog';
import type { Player } from '@/types/player';

interface PlayerEditButtonProps {
  player: Player;
  onSave?: () => void;
}

const PlayerEditButton = ({ player, onSave }: PlayerEditButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from triggering
    setIsOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleClick}
        title="Edit player"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
      </Button>

      <PlayerEditDialog
        player={isOpen ? player : null}
        onClose={() => setIsOpen(false)}
        onSave={() => {
          onSave?.();
          setIsOpen(false);
        }}
      />
    </>
  );
};

export default PlayerEditButton;
