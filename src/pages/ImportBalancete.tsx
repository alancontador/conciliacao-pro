import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUpload } from '@/components/import/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountingStore } from '@/store/accounting';
import { logger } from '@/lib/logger';
import { AlertCircle, CheckCircle, FileSpreadsheet, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

type FormatoBalancete = 'sem-cabecalho' | 'com-cabecalho';

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

// Normaliza string para comparação robusta: NFC + lowercase + trim
const nl = (v: any): string => String(v ?? '').normalize('NFC').trim().toLowerCase();

// Mapeamento dinâmico de colunas detectado a partir da linha de cabeçalho
interface ColMap {
  codigo: number;
  classificacao: number;
  descricao: number;
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldoAtual: number;
}

// Lê a linha de cabeçalho e descobre em qual coluna está cada campo.
// Suporta qualquer layout (colunas em posições fixas, deslocadas por "carac", ou
// intercaladas com nulos por células mescladas).
function detectColumnMap(headerRow: any[]): ColMap | null {
  let codigo = -1, classificacao = -1, descricao = -1;
  let saldoAnterior = -1, debito = -1, credito = -1, saldoAtual = -1;

  headerRow.forEach((cell, i) => {
    const v = nl(cell);
    if (!v) return;

    if ((v === 'código' || v === 'codigo' || v === 'cod' || v === 'cod.') && codigo === -1)
      codigo = i;
    else if (v.includes('classif') && classificacao === -1)
      classificacao = i;
    else if (v.includes('descri') && descricao === -1)
      descricao = i;
    else if (v.includes('saldo') && v.includes('anterior') && saldoAnterior === -1)
      saldoAnterior = i;
    else if ((v.includes('déb') || v.includes('deb')) && debito === -1)
      debito = i;
    else if ((v.includes('créd') || v.includes('cred')) && credito === -1)
      credito = i;
    else if (v.includes('saldo') && v.includes('atual') && saldoAtual === -1)
      saldoAtual = i;
  });

  if (codigo === -1 || classificacao === -1 || descricao === -1 || saldoAnterior === -1
    || debito === -1 || credito === -1 || saldoAtual === -1) return null;

  return { codigo, classificacao, descricao, saldoAnterior, debito, credito, saldoAtual };
}

// Localiza a linha de títulos de colunas em qualquer posição do arquivo.
// Procura a primeira linha que contenha "código", "classif", "descri" e "saldo anterior"
// em QUALQUER coluna — tolerante a colunas extras (ex: "carac") e células mescladas.
function findHeaderIndex(rows: any[][]): number {
  return rows.findIndex(r => {
    if (!Array.isArray(r)) return false;
    const vals = r.map(v => nl(v));
    return (
      vals.some(v => v === 'código' || v === 'codigo') &&
      vals.some(v => v.includes('classif')) &&
      vals.some(v => v.includes('descri')) &&
      vals.some(v => v.includes('saldo') && v.includes('anterior'))
    );
  });
}

// Detecta se o arquivo tem um bloco de informações (empresa/CNPJ/período) antes dos dados.
// Verifica col 0 ou col 1, pois alguns layouts têm col 0 nula na linha de empresa.
function hasInfoBlock(rows: any[][]): boolean {
  if (!rows.length) return false;
  const check = (v: string) =>
    v.startsWith('empresa') || v.startsWith('razão') || v.startsWith('razao')
    || v.startsWith('cnpj') || v.startsWith('c.n.p.j')
    || v.startsWith('periodo') || v.startsWith('período');
  return check(nl(rows[0]?.[0] ?? '')) || check(nl(rows[0]?.[1] ?? ''));
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

// extrai linhas do balancete após o cabeçalho, usando mapeamento dinâmico de colunas.
// formato: 'sem-cabecalho' = arquivo começa direto nos dados (header na 1ª linha)
//          'com-cabecalho' = arquivo tem bloco empresa/CNPJ/período antes dos dados
function extractRowsFromLayout(
  raw: any[][],
  minChars: number,
  withIds = false,
  formato: FormatoBalancete = 'sem-cabecalho',
) {
  const hdr = findHeaderIndex(raw);
  if (hdr === -1) return [];

  const colMap = detectColumnMap(raw[hdr]);
  if (!colMap) return [];

  const data = raw.slice(hdr + 1);

  const out = data
    .map((r, i) => {
      const codigo   = norm(r[colMap.codigo]);
      const classif  = norm(r[colMap.classificacao]);
      const classifDigits = classif.replace(/[^0-9]/g, '');
      const descricao = norm(r[colMap.descricao]);
      const saldoAnterior = normNum(r[colMap.saldoAnterior]);
      const debito        = normNum(r[colMap.debito]);
      const credito       = normNum(r[colMap.credito]);
      const saldoAtualRaw = r[colMap.saldoAtual];
      let   saldoAtual    = normNum(saldoAtualRaw);

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
        descricao: descricao.replace(/^\s+/, ''), // remove indentação do sistema
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
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<LinhaPreview[]>([]);
  const [minCharacters, setMinCharacters] = useState(1);
  const [formato, setFormato] = useState<FormatoBalancete>('sem-cabecalho');
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

  // Refiltra o preview quando o usuário muda minCharacters ou formato sem re-fazer upload
  useEffect(() => {
    if (!rawDataRef.current) return;
    const processed = extractRowsFromLayout(rawDataRef.current, minCharacters, true, formato);
    setPreviewData(processed);
    const hdrIdx = findHeaderIndex(rawDataRef.current);
    const dataLen = hdrIdx === -1 ? 0 : Math.max(rawDataRef.current.length - (hdrIdx + 1), 0);
    setImportStats(prev => prev === null ? null : {
      totalLines: dataLen,
      validLines: processed.length,
      ignoredLines: dataLen - processed.length,
      errors: [],
    });
  }, [minCharacters, formato]);

  const totalPages = Math.max(1, Math.ceil(previewData.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, previewData.length);

  const pageRows = useMemo(
    () => previewData.slice(startIdx, endIdx),
    [previewData, startIdx, endIdx]
  );

  const { setBalanceteData, addImportHistory, currentUser, selectedEmpresaId } = useAccountingStore();
  const { toast } = useToast();
  const log = logger.withContext({ userId: currentUser?.id, empresaId: selectedEmpresaId ?? undefined, action: 'import-balancete' });

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewData([]);
    setImportStats(null);
    setParseError(null);

    log.info('file-selected', { data: { fileName: selectedFile.name, sizeBytes: selectedFile.size, sizeKB: Math.round(selectedFile.size / 1024) } });

    try {
      setIsLoading(true);

      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        const msg = 'Arquivo não pôde ser lido. Abra-o no Excel, salve como .xlsx e tente novamente.';
        setParseError(msg);
        log.warn('file-no-sheet', { data: { fileName: selectedFile.name, sheets: workbook.SheetNames } });
        return;
      }

      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: true,
      });

      rawDataRef.current = rawData;

      // Auto-detecta formato se o arquivo indicar a presença do bloco de cabeçalho
      if (hasInfoBlock(rawData) && formato === 'sem-cabecalho') {
        setFormato('com-cabecalho');
      }

      const processedForPreview = extractRowsFromLayout(rawData, minCharacters, true, formato);

      setPreviewData(processedForPreview);

      const hdrIdx = findHeaderIndex(rawData);
      const dataLen = hdrIdx === -1 ? 0 : Math.max(rawData.length - (hdrIdx + 1), 0);
      setImportStats({
        totalLines: dataLen,
        validLines: processedForPreview.length,
        ignoredLines: dataLen - processedForPreview.length,
        errors: [],
      });

      if (processedForPreview.length === 0) {
        const headerFound = hdrIdx !== -1;
        const msg = headerFound
          ? `Arquivo lido (${dataLen} linha${dataLen !== 1 ? 's' : ''} encontrada${dataLen !== 1 ? 's' : ''}), mas nenhuma conta reconhecida. Verifique se as colunas estão corretas.`
          : 'Cabeçalho do balancete não encontrado. O arquivo deve ter colunas: Código, Classificação, Descrição, Saldo Anterior, Débito, Crédito, Saldo Atual.';
        setParseError(msg);
        log.warn('file-no-rows', { data: { fileName: selectedFile.name, totalRows: rawData.length, headerFound, hdrIdx } });
      } else {
        log.info('file-parsed', { data: { fileName: selectedFile.name, validRows: processedForPreview.length, totalRows: dataLen } });
      }
    } catch (error) {
      log.error('file-parse-failed', { error, data: { fileName: selectedFile.name } });
      setParseError('Erro ao processar o arquivo. Verifique se está no formato correto.');
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

      if (!sheet) {
        toast({
          title: 'Arquivo XLS não suportado',
          description: 'Este arquivo XLS não pôde ser lido. Abra-o no Excel, salve como .xlsx e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: true,
      });

      const processedData = extractRowsFromLayout(rawData, minCharacters, false, formato);

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
      log.error('import-failed', { error, data: { fileName: file?.name } });
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
        <CardContent className="space-y-6">
          {/* Formato do balancete */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Formato do balancete</Label>
            <RadioGroup
              value={formato}
              onValueChange={(v) => setFormato(v as FormatoBalancete)}
              className="space-y-2"
            >
              <label
                htmlFor="fmt-sem"
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  formato === 'sem-cabecalho' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="sem-cabecalho" id="fmt-sem" className="mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Sem bloco de cabeçalho</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O arquivo começa diretamente com os títulos das colunas (Código, Classificação, Descrição…)
                  </p>
                </div>
              </label>

              <label
                htmlFor="fmt-com"
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  formato === 'com-cabecalho' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="com-cabecalho" id="fmt-com" className="mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Com bloco de cabeçalho</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O arquivo começa com empresa, CNPJ, período e data de emissão antes da tabela de dados
                  </p>
                </div>
              </label>
            </RadioGroup>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>O sistema também detecta o formato automaticamente ao carregar o arquivo.</span>
            </div>
          </div>

          {/* Filtro de dígitos */}
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
          <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} maxSize={100 * 1024 * 1024} />
        </CardContent>
      </Card>

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

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
