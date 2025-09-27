import { useState } from 'react';
import { FileUpload } from '@/components/import/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountingStore } from '@/store/accounting';
import { CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export function ImportBalancete() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [minCharacters, setMinCharacters] = useState(3);
  const [importStats, setImportStats] = useState<{
    totalLines: number;
    validLines: number;
    ignoredLines: number;
    errors: string[];
  } | null>(null);

  const { setBalanceteData, addImportHistory } = useAccountingStore();
  const { toast } = useToast();

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

      // Process and filter data
      const processedData = rawData
        .slice(1) // Skip header
        .filter((row: any) => {
          // Check if row has data and classification starts with "1 =" or "2 ="
          const classification = row[1]?.toString() || '';
          return (
            row.length >= 4 && 
            row[0] && // Has account number
            (classification.startsWith('1 =') || classification.startsWith('2 =')) &&
            classification.length >= minCharacters
          );
        })
        .map((row: any, index: number) => ({
          id: index,
          codigo: row[0]?.toString() || '',
          classificacao: row[1]?.toString() || '',
          descricao: row[2]?.toString() || '',
          saldoAtual: parseFloat(row[3]) || 0,
          natureza: row[1]?.toString().startsWith('1 =') ? 'ATIVO' as const : 'PASSIVO' as const,
        }));

      setPreviewData(processedData.slice(0, 10)); // Show first 10 for preview
      
      setImportStats({
        totalLines: rawData.length - 1,
        validLines: processedData.length,
        ignoredLines: (rawData.length - 1) - processedData.length,
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
        .slice(1)
        .filter((row: any) => {
          const classification = row[1]?.toString() || '';
          return (
            row.length >= 4 && 
            row[0] && 
            (classification.startsWith('1 =') || classification.startsWith('2 =')) &&
            classification.length >= minCharacters
          );
        })
        .map((row: any) => ({
          codigo: row[0]?.toString() || '',
          classificacao: row[1]?.toString() || '',
          descricao: row[2]?.toString() || '',
          saldoAtual: parseFloat(row[3]) || 0,
          natureza: row[1]?.toString().startsWith('1 =') ? 'ATIVO' as const : 'PASSIVO' as const,
        }));

      setBalanceteData(processedData);
      
      addImportHistory({
        id: Date.now().toString(),
        tipo: 'BALANCETE',
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
        description: `${processedData.length} contas foram importadas do balancete.`,
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
        <h1 className="text-3xl font-bold text-foreground">Importar Balancete</h1>
        <p className="text-muted-foreground">
          Importe os dados do balancete a partir de arquivos Excel (.xlsx, .xls)
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Importação</CardTitle>
          <CardDescription>
            Configure os parâmetros para filtrar e processar os dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="minChars">Número mínimo de caracteres para filtro</Label>
            <Input
              id="minChars"
              type="number"
              min="1"
              max="10"
              value={minCharacters}
              onChange={(e) => setMinCharacters(parseInt(e.target.value) || 3)}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Contas com classificação menor que este número serão ignoradas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
          <CardDescription>
            Carregue o arquivo Excel contendo os dados do balancete
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
                    <TableHead>Código</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Saldo Atual</TableHead>
                    <TableHead>Natureza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{row.codigo}</TableCell>
                      <TableCell>{row.classificacao}</TableCell>
                      <TableCell>{row.descricao}</TableCell>
                      <TableCell className="text-right">
                        R$ {row.saldoAtual.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          row.natureza === 'ATIVO' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-secondary/10 text-secondary-foreground'
                        }`}>
                          {row.natureza}
                        </span>
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