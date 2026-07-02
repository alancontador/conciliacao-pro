import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUpload } from '@/components/import/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountingStore } from '@/store/accounting';
import { CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// ----------------- Helpers -----------------
const norm = (v: unknown) => (v ?? '').toString().trim().replace(/\s+/g, ' ');

// 1.234,56 -> 1234.56 | aceita numbers e strings
const normNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const s = norm(v);
  if (!s) return 0;
  const br = s.replace(/\./g, '').replace(',', '.');
  const n = Number(br);
  return Number.isNaN(n) ? 0 : n;
};

// começa com 1 ou 2
const startsWith1or2 = (s: string) => /^[12]/.test(s);

// localiza a linha do cabeçalho da grade
function findHeaderIndex(rows: any[][]): number {
  const isHeader = (r: any[]) => {
    const a = norm(r[0]).toLowerCase();
    const b = norm(r[1]).toLowerCase();
    const c = norm(r[2]).toLowerCase();
    const d = norm(r[3]).toLowerCase();
    const e = norm(r[4]).toLowerCase();
    const f = norm(r[5]).toLowerCase();
    const g = norm(r[6]).toLowerCase();
    return (
      (a === 'código' || a === 'codigo') &&
      (b === 'classificação' || b === 'classificacao') &&
      c.startsWith('descrição conta') &&
      d.startsWith('saldo anterior') &&
      (e === 'débito' || e === 'debito') &&
      (f === 'crédito' || f === 'credito') &&
      g.startsWith('saldo atual')
    );
  };
  return rows.findIndex(isHeader);
}

type Linha = {
  codigo: string;
  classificacao: string;
  descricao: string;
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldoAtual: number;
  natureza: 'ATIVO' | 'PASSIVO';
};

type LinhaPreview = Linha & { id: number };

// extrai linhas do layout (A,B,C,D,E,F,G) após o cabeçalho
function extractRowsFromLayout(raw: any[][], minChars: number, withIds = false) {
  const hdr = findHeaderIndex(raw);
  if (hdr === -1) return [];

  const data = raw.slice(hdr + 1);

  const out = data
    .map((r, i) => {
      const codigo = norm(r[0]);              // Col A
      const classif = norm(r[1]);             // Col B
      const classifDigits = classif.replace(/\D/g, '');
      const descricao = norm(r[2]);           // Col C
      const saldoAnterior = normNum(r[3]);    // Col D
      const debito = normNum(r[4]);           // Col E
      const credito = normNum(r[5]);          // Col F
      const saldoAtualRaw = r[6];            // Col G (bruto, antes de normalizar)
      let saldoAtual = normNum(saldoAtualRaw);

      // Fallback APENAS quando a célula está genuinamente vazia (não quando é zero de fato).
      // Usa a fórmula correta por natureza: ATIVO = ant + deb − cred; PASSIVO = ant − deb + cred.
      const isSaldoAtualBlank = saldoAtualRaw == null || saldoAtualRaw === ''
        || (typeof saldoAtualRaw === 'string' && saldoAtualRaw.trim() === '');
      if (isSaldoAtualBlank && (saldoAnterior || debito || credito)) {
        const isAtivo = /^1/.test(classif);
        saldoAtual = isAtivo
          ? saldoAnterior + debito - credito
          : saldoAnterior - debito + credito;
      }

      const valida =
        !!codigo &&
        !!classif &&
        startsWith1or2(classif) &&
        classifDigits.length >= minChars;

      if (!valida) return null;

      const natureza: 'ATIVO' | 'PASSIVO' = /^1/.test(classif) ? 'ATIVO' : 'PASSIVO';

      const base: Linha = {
        codigo,
        classificacao: classif,
        descricao,
        saldoAnterior,
        debito,
        credito,
        saldoAtual,
        natureza,
      };
      return withIds ? ({ id: i, ...base } as LinhaPreview) : base;
    })
    .filter(Boolean) as any[];

  return out;
}

// --------------- Componente ----------------
export function ImportBalancete() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<LinhaPreview[]>([]);
  const [minCharacters, setMinCharacters] = useState(1);
  const rawDataRef = useRef<any[][] | null>(null);
  const [importStats, setImportStats] = useState<{
    totalLines: number;
    validLines: number;
    ignoredLines: number;
    errors: string[];
  } | null>(null);

  // paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setCurrentPage(1); }, [previewData, pageSize]);

  // Refiltra o preview quando o usuário muda minCharacters sem re-fazer upload
  useEffect(() => {
    if (!rawDataRef.current) return;
    const processed = extractRowsFromLayout(rawDataRef.current, minCharacters, true);
    setPreviewData(processed);
    const hdrIdx = findHeaderIndex(rawDataRef.current);
    const dataLen = hdrIdx === -1 ? 0 : Math.max(rawDataRef.current.length - (hdrIdx + 1), 0);
    setImportStats(prev => prev === null ? null : {
      totalLines: dataLen,
      validLines: processed.length,
      ignoredLines: dataLen - processed.length,
      errors: [],
    });
  }, [minCharacters]);

  const totalPages = Math.max(1, Math.ceil(previewData.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, previewData.length);

  const pageRows = useMemo(
    () => previewData.slice(startIdx, endIdx),
    [previewData, startIdx, endIdx]
  );

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

      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: true,
      });

      rawDataRef.current = rawData;

      const processedForPreview = extractRowsFromLayout(rawData, minCharacters, true);

      setPreviewData(processedForPreview);

      const hdrIdx = findHeaderIndex(rawData);
      const dataLen = hdrIdx === -1 ? 0 : Math.max(rawData.length - (hdrIdx + 1), 0);
      setImportStats({
        totalLines: dataLen,
        validLines: processedForPreview.length,
        ignoredLines: dataLen - processedForPreview.length,
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

      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: true,
      });

      const processedData = extractRowsFromLayout(rawData, minCharacters, false);

      setBalanceteData(processedData);

      addImportHistory({
        id: Date.now().toString(),
        tipo: 'BALANCETE',
        arquivo: file.name,
        data: new Date(),
        usuario: 'Sistema',
        linhasLidas: importStats.totalLines,
        linhasIgnoradas: importStats.totalLines - processedData.length,
        erros: [],
        status: 'SUCESSO',
      });

      toast({
        title: 'Importação realizada com sucesso!',
        description: `${processedData.length} contas foram importadas do balancete.`,
      });

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

  // helpers UI paginação
  const goPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const goTo = (p: number) => setCurrentPage(() => {
    if (!Number.isFinite(p)) return 1;
    return Math.min(totalPages, Math.max(1, Math.trunc(p)));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Balancete</h1>
        <p className="text-muted-foreground">
          Importe os dados do balancete a partir de arquivos Excel (.xlsx, .xls)
        </p>
      </div>

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Importação</CardTitle>
          <CardDescription>Configure os parâmetros para filtrar e processar os dados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="minChars">Número mínimo de caracteres para filtro</Label>
            <Input
              id="minChars"
              type="number"
              min="1"
              max="15"
              value={minCharacters}
              onChange={(e) => setMinCharacters(parseInt(e.target.value) || 1)}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Considera a quantidade de <b>dígitos</b> da Classificação (somente contas iniciadas por 1 ou 2).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
          <CardDescription>Carregue o arquivo Excel contendo os dados do balancete</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Stats */}
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

      {/* Preview + paginação */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Preview dos Dados
            </CardTitle>

            {/* Barra de paginação superior */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Mostrando <b>{previewData.length === 0 ? 0 : startIdx + 1}</b>–<b>{endIdx}</b> de <b>{previewData.length}</b>
              </span>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={currentPage <= 1}>
                  Anterior
                </Button>
                <span className="text-sm">Página</span>
                <Input
                  type="number"
                  className="h-8 w-16"
                  value={currentPage}
                  min={1}
                  max={totalPages}
                  onChange={(e) => goTo(parseInt(e.target.value))}
                />
                <span className="text-sm">de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={goNext} disabled={currentPage >= totalPages}>
                  Próxima
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm">Linhas por página</span>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                >
                  {[10, 25, 50, 100].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Saldo Anterior</TableHead>
                    <TableHead>Débito</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead>Saldo Atual</TableHead>
                    <TableHead>Natureza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">{row.codigo}</TableCell>
                      <TableCell>{row.classificacao}</TableCell>
                      <TableCell>{row.descricao}</TableCell>
                      <TableCell className="text-right">
                        R$ {row.saldoAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {row.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {row.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {row.saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            row.natureza === 'ATIVO'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary/10 text-secondary-foreground'
                          }`}
                        >
                          {row.natureza}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={handleImport} disabled={isLoading} className="min-w-32">
                {isLoading ? 'Importando...' : 'Confirmar Importação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
