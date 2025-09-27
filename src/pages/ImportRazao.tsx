import { useState } from 'react';
import { FileUpload } from '@/components/import/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountingStore } from '@/store/accounting';
import { CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export function ImportRazao() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStats, setImportStats] = useState<{
    totalLines: number;
    validLines: number;
    ignoredLines: number;
    errors: string[];
  } | null>(null);

  const { setRazaoData, addImportHistory } = useAccountingStore();
  const { toast } = useToast();

  const isRowEmpty = (row: any[]): boolean => {
    return !row || row.every(cell => !cell || cell.toString().trim() === '');
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewData([]);
    setImportStats(null);
    
    try {
      setIsLoading(true);
      
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Remove completely empty rows and clean data
      const cleanedData = rawData
        .filter((row: any) => !isRowEmpty(row))
        .slice(1) // Skip header
        .filter((row: any) => {
          // Basic validation for razão data
          return row.length >= 6 && 
                 row[0] && // Has account
                 row[1] && // Has date
                 row[4] !== undefined && // Has debit
                 row[5] !== undefined; // Has credit
        })
        .map((row: any, index: number) => {
          const dateValue = row[1];
          let parsedDate = new Date();
          
          // Try to parse different date formats
          if (dateValue) {
            if (typeof dateValue === 'number') {
              // Excel serial date
              parsedDate = new Date((dateValue - 25569) * 86400 * 1000);
            } else {
              parsedDate = new Date(dateValue);
            }
          }

          return {
            id: index,
            conta: row[0]?.toString() || '',
            data: parsedDate,
            lote: row[2]?.toString() || '',
            historico: row[3]?.toString() || '',
            debito: parseFloat(row[4]) || 0,
            credito: parseFloat(row[5]) || 0,
            saldoExercicio: parseFloat(row[6]) || 0,
          };
        });

      setPreviewData(cleanedData.slice(0, 10)); // Show first 10 for preview
      
      setImportStats({
        totalLines: rawData.length - 1,
        validLines: cleanedData.length,
        ignoredLines: (rawData.length - 1) - cleanedData.length,
        errors: [],
      });

    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Verifique se o arquivo está no formato correto.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !importStats) return;

    try {
      setIsLoading(true);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const processedData = rawData
        .filter((row: any) => !isRowEmpty(row))
        .slice(1)
        .filter((row: any) => {
          return row.length >= 6 && 
                 row[0] && 
                 row[1] && 
                 row[4] !== undefined && 
                 row[5] !== undefined;
        })
        .map((row: any) => {
          const dateValue = row[1];
          let parsedDate = new Date();
          
          if (dateValue) {
            if (typeof dateValue === 'number') {
              parsedDate = new Date((dateValue - 25569) * 86400 * 1000);
            } else {
              parsedDate = new Date(dateValue);
            }
          }

          return {
            conta: row[0]?.toString() || '',
            data: parsedDate,
            lote: row[2]?.toString() || '',
            historico: row[3]?.toString() || '',
            debito: parseFloat(row[4]) || 0,
            credito: parseFloat(row[5]) || 0,
            saldoExercicio: parseFloat(row[6]) || 0,
          };
        });

      setRazaoData(processedData);
      
      addImportHistory({
        id: Date.now().toString(),
        tipo: 'RAZAO',
        arquivo: file.name,
        data: new Date(),
        usuario: 'Sistema',
        linhasLidas: importStats.totalLines,
        linhasIgnoradas: importStats.ignoredLines,
        erros: [],
        status: 'SUCESSO',
      });

      toast({
        title: 'Importação realizada com sucesso!',
        description: `${processedData.length} movimentações foram importadas do razão.`,
      });

      // Reset form
      setFile(null);
      setPreviewData([]);
      setImportStats(null);

    } catch (error) {
      console.error('Error importing data:', error);
      toast({
        title: 'Erro na importação',
        description: 'Não foi possível importar os dados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Razão</h1>
        <p className="text-muted-foreground">
          Importe as movimentações do razão contábil a partir de arquivos Excel (.xlsx, .xls)
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
          <CardDescription>
            Carregue o arquivo Excel contendo as movimentações do razão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFileSelect={handleFileSelect}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Import Stats */}
      {importStats && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              <div>
                <div className="font-medium">Total de linhas</div>
                <div className="text-2xl font-bold">{importStats.totalLines}</div>
              </div>
              <div>
                <div className="font-medium">Linhas válidas</div>
                <div className="text-2xl font-bold text-success">{importStats.validLines}</div>
              </div>
              <div>
                <div className="font-medium">Linhas ignoradas</div>
                <div className="text-2xl font-bold text-muted-foreground">{importStats.ignoredLines}</div>
              </div>
              <div>
                <div className="font-medium">Erros</div>
                <div className="text-2xl font-bold text-destructive">{importStats.errors.length}</div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Preview dos Dados (primeiras 10 linhas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead>Débito</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead>Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{row.conta}</TableCell>
                      <TableCell>
                        {row.data.toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{row.lote}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {row.historico}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {row.debito.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {row.credito.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {row.saldoExercicio.toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <Button 
                onClick={handleImport} 
                disabled={isLoading}
                className="min-w-32"
              >
                {isLoading ? 'Importando...' : 'Confirmar Importação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}