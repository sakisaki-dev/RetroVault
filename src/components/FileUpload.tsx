import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Calendar } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FileUploadProps {
  onFileLoad: (content: string, filename: string, seasonNumber?: number) => void;
  label?: string;
  askForSeason?: boolean;
}

const FileUpload = ({ onFileLoad, label = 'Upload CSV', askForSeason = false }: FileUploadProps) => {
  const [pendingFile, setPendingFile] = useState<{ content: string; filename: string } | null>(null);
  const [seasonNumber, setSeasonNumber] = useState<string>('');
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);

  const processFile = useCallback((content: string, filename: string) => {
    if (askForSeason) {
      // Try to auto-detect season from filename
      const match = filename.match(/y(\d+)/i);
      if (match) {
        setSeasonNumber(match[1]);
      } else {
        setSeasonNumber('');
      }
      setPendingFile({ content, filename });
      setShowSeasonDialog(true);
    } else {
      onFileLoad(content, filename);
    }
  }, [askForSeason, onFileLoad]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        processFile(content, file.name);
      };
      reader.readAsText(file);
    }
  }, [processFile]);

  const handleConfirmSeason = () => {
    if (pendingFile && seasonNumber) {
      const num = parseInt(seasonNumber, 10);
      onFileLoad(pendingFile.content, pendingFile.filename, num);
      setShowSeasonDialog(false);
      setPendingFile(null);
      setSeasonNumber('');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
    <>
      <div 
        {...getRootProps()} 
        className={`upload-zone cursor-pointer ${isDragActive ? 'dragging' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="relative">
          {isDragActive ? (
            <FileSpreadsheet className="w-12 h-12 text-primary animate-pulse" />
          ) : (
            <Upload className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="text-foreground font-medium">{label}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isDragActive ? 'Drop the file here...' : 'Drag & drop or click to select'}
          </p>
        </div>
      </div>

      <Dialog open={showSeasonDialog} onOpenChange={setShowSeasonDialog}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Calendar className="w-5 h-5 text-accent" />
              What season is this?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="season-number" className="text-sm text-muted-foreground">
              Enter the season number (e.g., 31 for Year 31)
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg text-muted-foreground">Y</span>
              <Input
                id="season-number"
                type="number"
                min="1"
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value)}
                placeholder="31"
                className="w-24 text-lg font-mono"
                autoFocus
              />
            </div>
            {pendingFile && (
              <p className="text-xs text-muted-foreground mt-3">
                File: {pendingFile.filename}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeasonDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSeason}
              disabled={!seasonNumber || parseInt(seasonNumber, 10) <= 0}
            >
              Confirm Season Y{seasonNumber || '?'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileUpload;
