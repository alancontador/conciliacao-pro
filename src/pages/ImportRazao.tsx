import { useState, useMemo, useEffect } from 'react';
import { FileUpload } from '@/components/import/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountingStore } from '@/store/accounting';
import { CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// ===== Tipos =====
type LinhaRazao = {
  id?: number;          // para paginação/keys
  conta: string;
  data: Date | null;
  lote: string;
  historico: string;
  debito: number;
  credito: number;
  saldoExercicio: number;
};

// ===== Helpers (mesmos do seu parser tolerante) =====
const normalize = (s: any): string => {
  const map: Record<string, string> = {'Á':'A','À':'A','Â':'A','Ã':'A','É':'E','È':'E','Ê':'E','Í':'I','Ó':'O','Ò':'O','Ô':'O','Õ':'O','Ú':'U','Ù':'U','Ü':'U','Ç':'C'};
  let t = (s ?? '').toString().toUpperCase().trim();
  t = t.replace(/[ÁÀÂÃÉÈÊÍÓÒÔÕÚÙÜÇ]/g, (m)=>map[m]||m).replace(/\s{2,}/g, ' ');
  return t;
};
const parseNumberBR = (v: any): number => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = v.toString().trim();
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(,\d{3})*\.\d{1,2}$/.test(s)) return parseFloat(s.replace(/,/g, ''));
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const excelSerialToDate = (n: number): Date => new Date((n - 25569) * 86400 * 1000);
const isValidDate = (d: Date | null) => !!d && !isNaN(d.getTime());
const parseDateCell = (v: any): Date | null => {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number') { const d = excelSerialToDate(v); return isValidDate(d) ? d : null; }
  const s = v.toString().trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const dd=+m[1], mm=+m[2]-1, yy=+m[3]; const yyyy = yy<100?yy+2000:yy; const d=new Date(yyyy,mm,dd); return isValidDate(d)?d:null; }
  const d = new Date(s); return isValidDate(d)?d:null;
};
const rowEmpty = (row: any[]) => !row || row.every(c => c == null || String(c).trim() === '');

// “UsedRange” à esquerda
const trimLeftEmptyColumns = (matrix: any[][], lookRows = 20) => {
  const rows = matrix.slice(0, Math.min(lookRows, matrix.length));
  let firstCol = Infinity;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const idx = r.findIndex(v => v != null && String(v).trim() !== '');
    if (idx >= 0) firstCol = Math.min(firstCol, idx);
  }
  if (!isFinite(firstCol) || firstCol <= 0) return { trimmed: matrix, offset: 0 };
  return { trimmed: matrix.map(r => (Array.isArray(r) ? r.slice(firstCol) : r)), offset: firstCol };
};

// header por pontuação + fallback “CONSOLIDADO”
const detectHeaderRow = (mat: any[][]): number => {
  const maxScan = Math.min(15, mat.length);
  let bestIdx = -1, bestScore = -1;
  const tokens = ['DATA','HISTORICO','DEBITO','CREDITO','SALDO'];
  const hasConsolidado = (mat[3] || []).some(c => normalize(c).includes('CONSOLIDADO'));
  for (let i=0;i<maxScan;i++){
    const row = mat[i] || [];
    let score = 0;
    for (const c of row) {
      const n = normalize(c);
      if (!n) continue;
      for (const t of tokens) if (n.includes(t)) score++;
    }
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  if (hasConsolidado && mat[7]) {
    const row8 = mat[7].map(normalize);
    const s8 = row8.filter(x => tokens.some(t => x.includes(t))).length;
    if (s8 >= Math.max(2, bestScore - 1)) return 7;
  }
  if (bestIdx < 0 || bestScore < 2) return Math.min(6, mat.length - 1);
  return bestIdx;
};

// mapear colunas por nome/tipo + fallbacks C/E
const mapColumnsSmart = (header: any[], sampleRows: any[][]) => {
  const H = header.map(normalize);
  const idx: Record<string, number|undefined> = {};
  H.forEach((h,i)=>{
    if (h.includes('DATA') && idx.DATA==null) idx.DATA=i;
    if (h.includes('HISTORICO') && idx.HISTORICO==null) idx.HISTORICO=i;
    if (h.includes('DEBITO') && idx.DEBITO==null) idx.DEBITO=i;
    if (h.includes('CREDITO') && idx.CREDITO==null) idx.CREDITO=i;
    if (h.replace(/\s/g,'').includes('SALDOEXERCICIO') && idx.SALDOEX==null) idx.SALDOEX=i;
    if ((h.includes('LOTE')||h.includes('LANC')||h.includes('LANÇ')) && idx.LOTE==null) idx.LOTE=i;
    if ((h.includes('CONTA')||h.includes('CONTA N')) && idx.CONTA==null) idx.CONTA=i;
  });
  const colCount = header.length;
  const stats = Array.from({length: colCount}, (_,c)=>{
    let dateHits=0,numHits=0,nonEmpty=0;
    for (const r of sampleRows){
      const v=r[c];
      if (v!=null && String(v).trim()!==''){
        nonEmpty++;
        if (parseDateCell(v)) dateHits++;
        const n=parseNumberBR(v); if (Number.isFinite(n)) numHits++;
      }
    }
    return {c,dateHits,numHits,nonEmpty};
  });
  if (idx.DATA==null){
    const cand = stats.filter(s=>s.nonEmpty>0 && s.dateHits/s.nonEmpty>=0.6)
                      .sort((a,b)=>(b.dateHits/b.nonEmpty)-(a.dateHits/a.nonEmpty))[0];
    if (cand) idx.DATA=cand.c;
  }
  const numericCols = stats.filter(s=>s.numHits/Math.max(1,s.nonEmpty)>=0.6).map(s=>s.c);
  const preferByHeader = (needle:string)=> H.map((h,i)=>({i,h})).filter(x=>normalize(x.h).includes(needle)).map(x=>x.i);
  const pickNumeric = (current:number|undefined, needles:string[])=>{
    if (current!=null) return current;
    for (const nd of needles){
      const prefers = preferByHeader(nd).filter(i=>numericCols.includes(i));
      if (prefers.length) return prefers[0];
    }
    return numericCols.find(c => c !== idx.DEBITO && c !== idx.CREDITO && c !== idx.SALDOEX);
  };
  idx.DEBITO  = pickNumeric(idx.DEBITO,  ['DEB']);
  idx.CREDITO = pickNumeric(idx.CREDITO, ['CRED']);
  if (idx.SALDOEX==null){
    const prefers = preferByHeader('SALDO');
    const cand = prefers.find(i=> i!==idx.DEBITO && i!==idx.CREDITO && numericCols.includes(i));
    idx.SALDOEX = cand ?? numericCols.find(i => i!==idx.DEBITO && i!==idx.CREDITO);
  }
  if (idx.CONTA==null && header.length>2) idx.CONTA=2;
  if (idx.LOTE==null  && header.length>4) idx.LOTE=4;
  return idx as {DATA?:number;HISTORICO?:number;DEBITO?:number;CREDITO?:number;SALDOEX?:number;CONTA?:number;LOTE?:number;};
};
const looksLikeHeaderRepeat = (row:any[], idx:any)=>{
  const toks:Array<[keyof typeof idx,string]> = [
    ['DATA','DATA'],['HISTORICO','HISTORICO'],['DEBITO','DEBITO'],['CREDITO','CREDITO'],['SALDOEX','SALDOEXERCICIO']
  ];
  let hits=0;
  for (const [k,t] of toks){
    const i=idx[k]; if (i==null) continue;
    if (normalize(row[i]??'').includes(normalize(t))) hits++;
  }
  return hits>=2;
};
const fillDownConta = (rows: LinhaRazao[]) => {
  let last=''; for (const r of rows){ if (!r.conta) r.conta=last; else last=r.conta; }
};

const readAsWindows1252 = (file: File): Promise<string> =>
  file.arrayBuffer().then(buf => {
    try { return new TextDecoder('windows-1252').decode(buf); }
    catch { return new TextDecoder('utf-8').decode(buf); }
  });

// Parser compartilhado entre CSV e XLSX para razão contábil.
// Detecta dinamicamente as colunas a partir do cabeçalho (linha com DATA + DEBITO/CREDITO).
// Suporta dois layouts exportados pelo mesmo sistema:
//   FRIGEL: lote=col4, hist=col10, débito=col22, crédito=col24, saldo=col29 (formato esparso)
//   PA:     lote=col1, hist=col2,  débito=col7,  crédito=col8,  saldo=col11 (formato compacto)
// Linha de conta: "Conta:" no col0; short code em col1 (PA) ou col2 (FRIGEL quando col1 vazio).
const processFixedLayoutRows = (matrix: any[][]): { rows: LinhaRazao[]; totalRaw: number } => {
  // Fase 1 — detectar posições de colunas a partir do cabeçalho
  let colLote = 4, colHist = 10, colDebito = 22, colCredito = 24, colSaldo = 29;

  for (let i = 0; i < Math.min(20, matrix.length); i++) {
    const row = matrix[i] || [];
    const normed = row.map((v: any) => normalize(v));
    if (!normed.some(h => h === 'DATA')) continue;
    if (!normed.some(h => h.includes('DEB') || h.includes('CRED'))) continue;

    normed.forEach((h, j) => {
      if (!h) return;
      if (h.includes('LOTE') || h.includes('LANC')) colLote = j;
      else if (h.includes('HIST')) colHist = j;
      else if (h.includes('DEB')) colDebito = j;
      else if (h.includes('CRED')) colCredito = j;
      else if (h.includes('SALDO')) colSaldo = j;
    });
    break;
  }

  // Fase 2 — extrair linhas de transação
  const out: LinhaRazao[] = [];
  let currentConta = '';

  for (const cols of matrix) {
    if (!cols || cols.every(c => c == null || String(c).trim() === '')) continue;
    const col0 = String(cols[0] ?? '').trim().toUpperCase();

    if (col0 === 'CONTA:') {
      // FRIGEL: "Conta:;;5;;..."      → col1="" → usa col2="5"
      // PA:     "Conta:;10202;1.1...." → col1="10202" → usa col1
      const c1 = String(cols[1] ?? '').trim();
      const c2 = String(cols[2] ?? '').trim();
      currentConta = c1 !== '' ? c1 : c2;
      continue;
    }

    const lineUpper = cols.map(c => String(c ?? '')).join(' ').toUpperCase();
    if (
      lineUpper.includes('SALDO ANTERIOR') ||
      lineUpper.includes('TOTAL DO M') ||
      lineUpper.includes('SALDO GERAL') ||
      lineUpper.includes('ENCERRAMENT') ||
      col0 === 'DATA' ||
      col0 === 'RAZ' ||
      col0.startsWith('RAZ\xC3') ||
      col0 === 'EMPRESA:' ||
      col0 === 'C.N.P.J.:' ||
      col0.startsWith('PER') ||
      col0 === 'FOLHA:'
    ) {
      continue;
    }

    const data = parseDateCell(cols[0]);
    if (!isValidDate(data)) continue;

    const lote = String(cols[colLote] ?? '').trim();
    const historico = String(cols[colHist] ?? '').trim();
    const debito = parseNumberBR(cols[colDebito]);
    const credito = parseNumberBR(cols[colCredito]);
    const saldoRaw = typeof cols[colSaldo] === 'string'
      ? cols[colSaldo].trim().replace(/[dDcC]$/, '')
      : cols[colSaldo];
    const saldoExercicio = parseNumberBR(saldoRaw);

    out.push({ conta: currentConta, data: data as Date, lote, historico, debito, credito, saldoExercicio });
  }

  out.forEach((r, i) => { r.id = i; });
  return { rows: out, totalRaw: matrix.length };
};

const processCSV = (text: string): { rows: LinhaRazao[]; totalRaw: number } => {
  const lines = text.split(/\r?\n/);
  const matrix = lines.map(line => line.split(';'));
  return processFixedLayoutRows(matrix);
};

// ===== parser principal =====
const processWorkbook = (wb: XLSX.WorkBook) => {
  const sheetName = wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const raw: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, blankrows: false }) as any[][];
  if (!raw.length) return { rows: [] as LinhaRazao[], totalRaw: 0 };

  // Tenta primeiro o layout fixo (mesmo do parser de .csv): muitas planilhas Excel são o
  // mesmo relatório do razão exportado com as mesmas colunas na mesma ordem. Só cai para a
  // detecção inteligente por cabeçalho abaixo se o layout fixo não achar nenhuma linha válida.
  const fixedLayout = processFixedLayoutRows(raw);
  if (fixedLayout.rows.length > 0) return fixedLayout;

  const { trimmed } = trimLeftEmptyColumns(raw, 20);
  const headerIdx = detectHeaderRow(trimmed);
  const header = trimmed[headerIdx] || [];
  const body = trimmed.slice(headerIdx + 1);

  const idx = mapColumnsSmart(header, body.slice(0, 50));

  const out: LinhaRazao[] = [];
  for (const row of body) {
    if (rowEmpty(row)) continue;
    if (looksLikeHeaderRepeat(row, idx)) continue;

    const vData = idx.DATA != null ? row[idx.DATA] : undefined;
    if (idx.DATA != null) {
      const d = parseDateCell(vData);
      if (!isValidDate(d)) continue;
    }

    const r: LinhaRazao = {
      conta: idx.CONTA!=null ? String(row[idx.CONTA] ?? '').trim() : '',
      data:  idx.DATA !=null ? parseDateCell(vData) : null,
      lote:  idx.LOTE !=null ? String(row[idx.LOTE] ?? '').trim() : '',
      historico: idx.HISTORICO!=null ? String(row[idx.HISTORICO] ?? '').trim() : '',
      debito: idx.DEBITO!=null ? parseNumberBR(row[idx.DEBITO]) : 0,
      credito: idx.CREDITO!=null ? parseNumberBR(row[idx.CREDITO]) : 0,
      saldoExercicio: idx.SALDOEX!=null ? parseNumberBR(row[idx.SALDOEX]) : 0,
    };
    out.push(r);
  }

  // Remove linhas de rodapé comuns em razões (totais/resumos no final)
  while (out.length > 0) {
    const last = out[out.length - 1];
    const hist = normalize(last.historico);
    const isSummary =
      hist.includes('TOTAL') ||
      hist.includes('SALDO GERAL') ||
      hist.includes('ENCERRAMENT') ||
      (!last.lote && hist.startsWith('SALDO'));
    if (isSummary) out.pop();
    else break;
  }
  fillDownConta(out);

  // anexa ids para paginação
  out.forEach((r, i) => { r.id = i; });

  return { rows: out, totalRaw: raw.length };
};

// ===== Componente =====
export function ImportRazao() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<LinhaRazao[]>([]);
  const [importStats, setImportStats] = useState<{
    totalLines: number; validLines: number; ignoredLines: number; errors: string[];
  } | null>(null);

  // paginação (igual ao balancete)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setCurrentPage(1); }, [previewData, pageSize]);
  const totalPages = Math.max(1, Math.ceil(previewData.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, previewData.length);
  const pageRows = useMemo(() => previewData.slice(startIdx, endIdx), [previewData, startIdx, endIdx]);

  const { setRazaoData, addImportHistory } = useAccountingStore();
  const { toast } = useToast();

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewData([]);
    setImportStats(null);
    try {
      setIsLoading(true);
      const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');
      let rows: LinhaRazao[];
      let totalRaw: number;

      if (isCsv) {
        const text = await readAsWindows1252(selectedFile);
        ({ rows, totalRaw } = processCSV(text));
      } else {
        const buf = await selectedFile.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false, cellText: false });
        ({ rows, totalRaw } = processWorkbook(wb));
      }

      setPreviewData(rows);
      setImportStats({
        totalLines: Math.max(totalRaw - 1, 0),
        validLines: rows.length,
        ignoredLines: Math.max(0, (totalRaw - 1) - rows.length),
        errors: [],
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao processar arquivo', description: 'Cheque o layout e tente novamente.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !importStats) return;
    try {
      setIsLoading(true);
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      let rows: LinhaRazao[];
      let totalRaw: number;

      if (isCsv) {
        const text = await readAsWindows1252(file);
        ({ rows, totalRaw } = processCSV(text));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false, cellText: false });
        ({ rows, totalRaw } = processWorkbook(wb));
      }

      setRazaoData(rows);
      addImportHistory({
        id: Date.now().toString(),
        tipo: 'RAZAO',
        arquivo: file.name,
        data: new Date(),
        usuario: 'Sistema',
        linhasLidas: Math.max(totalRaw - 1, 0),
        linhasIgnoradas: Math.max(0, (totalRaw - 1) - rows.length),
        erros: [],
        status: 'SUCESSO',
      });

      toast({ title: 'Importação realizada com sucesso!', description: `${rows.length} movimentações foram importadas do razão.` });
      setFile(null); setPreviewData([]); setImportStats(null);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro na importação', description: 'Não foi possível importar os dados.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // helpers UI paginação (igual ao balancete)
  const goPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const goTo = (p: number) => setCurrentPage(() => {
    if (!Number.isFinite(p)) return 1;
    return Math.min(totalPages, Math.max(1, Math.trunc(p)));
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Importar Razão</h1>
        <p className="text-muted-foreground">Importe as movimentações do razão contábil a partir de arquivos Excel (.xlsx, .xls)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Arquivo</CardTitle>
          <CardDescription>Carregue o arquivo Excel contendo as movimentações do razão</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} allowCsv />
        </CardContent>
      </Card>

      {importStats && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              <div><div className="font-medium">Total de linhas</div><div className="text-2xl font-bold">{importStats.totalLines}</div></div>
              <div><div className="font-medium">Linhas válidas</div><div className="text-2xl font-bold text-success">{importStats.validLines}</div></div>
              <div><div className="font-medium">Linhas ignoradas</div><div className="text-2xl font-bold text-muted-foreground">{importStats.ignoredLines}</div></div>
              <div><div className="font-medium">Erros</div><div className="text-2xl font-bold text-destructive">{importStats.errors.length}</div></div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {previewData.length > 0 && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Preview dos Dados
            </CardTitle>

            {/* Barra de paginação superior (igual balancete) */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Mostrando <b>{previewData.length === 0 ? 0 : startIdx + 1}</b>–<b>{endIdx}</b> de <b>{previewData.length}</b>
              </span>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={currentPage <= 1}>Anterior</Button>
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
                <Button variant="outline" size="sm" onClick={goNext} disabled={currentPage >= totalPages}>Próxima</Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm">Linhas por página</span>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                >
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
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
                  {pageRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">{row.conta}</TableCell>
                      <TableCell>{row.data ? row.data.toLocaleDateString('pt-BR') : ''}</TableCell>
                      <TableCell>{row.lote}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.historico}</TableCell>
                      <TableCell className="text-right">R$ {row.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">R$ {row.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">R$ {row.saldoExercicio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
