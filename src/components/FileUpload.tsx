import { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onFileLoad: (content: string, filename: string) => void;
  label?: string;
}

const FileUpload = ({ onFileLoad, label = 'Upload CSV' }: FileUploadProps) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileLoad(content, file.name);
      };
      reader.readAsText(file);
    }
  }, [onFileLoad]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
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
  );
};

export default FileUpload;
