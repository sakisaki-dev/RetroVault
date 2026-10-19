import { useCallback } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileLoad: (content: string, filename: string) => void;
  label?: string;
}

/** CSV drop zone: drag and drop, click, or focus and press Enter/Space to pick a file. */
const FileUpload = ({ onFileLoad, label = 'Upload CSV' }: FileUploadProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => onFileLoad(e.target?.result as string, file.name);
      reader.onerror = () => toast.error(`Couldn't read ${file.name}`);
      reader.readAsText(file);
    },
    [onFileLoad],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: () => toast.error('Please upload a single .csv file'),
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps({ role: 'button', 'aria-label': `${label}: drag and drop a CSV file, or press Enter to choose one` })}
      className={cn('upload-zone cursor-pointer bg-card/60 px-4 py-8 sm:p-10', isDragActive && 'dragging')}
    >
      <input {...getInputProps()} />
      <span
        aria-hidden="true"
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full border-2 transition-colors',
          isDragActive ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-panel-2 text-muted-foreground',
        )}
      >
        {isDragActive ? <FileSpreadsheet className="h-8 w-8 motion-safe:animate-pulse" /> : <Upload className="h-8 w-8" />}
      </span>
      <div className="text-center">
        <p className="font-display text-xl font-bold uppercase tracking-wide text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
          {isDragActive ? 'Drop the file to load it' : 'Drag & drop, or click to choose a .csv file'}
        </p>
        <span className="lamp mt-3">Format <b>CSV</b></span>
      </div>
    </div>
  );
};

export default FileUpload;
