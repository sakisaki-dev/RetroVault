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
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary/80"
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        title="Edit player"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
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
