import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string[];
  maxSize?: number;
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string;
  allowCsv?: boolean;
}

export function FileUpload({
  onFileSelect,
  accept = ['.xlsx', '.xls'],
  maxSize = 100 * 1024 * 1024,
  isLoading = false,
  loadingMessage,
  error,
  allowCsv = false,
}: FileUploadProps) {
  const [typeError, setTypeError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const validExtensions = allowCsv ? ['.xlsx', '.xls', '.csv'] : ['.xlsx', '.xls'];

  const onDrop = useCallback((files: File[]) => {
    setTypeError(null);
    setSizeError(null);

    const file = files[0];
    if (!file) return;

    const ext = '.' + file.name.toLowerCase().split('.').pop();
    if (!validExtensions.includes(ext)) {
      setTypeError(`Formato não suportado. Use ${validExtensions.join(', ')}.`);
      return;
    }

    if (file.size > maxSize) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const limit = (maxSize / (1024 * 1024)).toFixed(0);
      setSizeError(`Arquivo muito grande (${mb}MB). Tamanho máximo: ${limit}MB.`);
      return;
    }

    onFileSelect(file);
  }, [onFileSelect, validExtensions, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: isLoading,
    // Sem 'accept' aqui — validamos por extensão no onDrop para evitar
    // rejeições por MIME type não-padrão (ex.: Domínio, Alterdata, etc.)
  });

  const hasError = !!(error || typeError || sizeError);
  const errorMsg = error || typeError || sizeError;

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : hasError
            ? 'border-destructive bg-destructive/5'
            : isLoading
            ? 'border-muted-foreground/25 bg-muted/30'
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
                : isLoading
                ? 'bg-primary/10'
                : isDragActive
                ? 'bg-primary/10'
                : 'bg-muted'
            }`}>
              {isLoading ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : hasError ? (
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
                  ? (loadingMessage ?? 'Processando arquivo...')
                  : 'Selecione ou arraste o arquivo Excel'
                }
              </h3>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Aguarde, isso pode levar alguns segundos para arquivos grandes.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Formatos aceitos: {validExtensions.join(', ')} (máx. {(maxSize / (1024 * 1024)).toFixed(0)}MB)
                </p>
              )}

              {!isLoading && (
                <Button variant="outline" type="button">
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Arquivo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
