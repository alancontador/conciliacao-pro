import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string[];
  maxSize?: number;
  isLoading?: boolean;
  error?: string;
}

export function FileUpload({ 
  onFileSelect, 
  accept = ['.xlsx', '.xls'], 
  maxSize = 10 * 1024 * 1024,
  isLoading = false,
  error 
}: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      return;
    }
    
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize,
    maxFiles: 1,
    disabled: isLoading,
  });

  const hasError = error || fileRejections.length > 0;

  return (
    <div className="space-y-4">
      <Card 
        className={`border-2 border-dashed transition-colors ${
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : hasError
            ? 'border-destructive bg-destructive/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <CardContent className="p-8">
          <div 
            {...getRootProps()} 
            className="flex flex-col items-center justify-center space-y-4 cursor-pointer"
          >
            <input {...getInputProps()} />
            
            <div className={`p-4 rounded-full ${
              hasError 
                ? 'bg-destructive/10' 
                : isDragActive 
                ? 'bg-primary/10' 
                : 'bg-muted'
            }`}>
              {hasError ? (
                <AlertCircle className="w-8 h-8 text-destructive" />
              ) : (
                <FileSpreadsheet className={`w-8 h-8 ${
                  isDragActive ? 'text-primary' : 'text-muted-foreground'
                }`} />
              )}
            </div>

            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">
                {isDragActive 
                  ? 'Solte o arquivo aqui' 
                  : isLoading
                  ? 'Processando arquivo...'
                  : 'Selecione ou arraste o arquivo Excel'
                }
              </h3>
              
              <p className="text-sm text-muted-foreground mb-4">
                Formatos aceitos: .xlsx, .xls (máx. {(maxSize / (1024 * 1024)).toFixed(0)}MB)
              </p>

              {!isLoading && (
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Arquivo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {fileRejections.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {fileRejections[0].errors[0].message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}