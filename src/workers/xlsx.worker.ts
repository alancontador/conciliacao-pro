import * as XLSX from 'xlsx';

type WorkerRequest = {
  buffer: ArrayBuffer;
  options?: {
    defval?: string;
    blankrows?: boolean;
    raw?: boolean;
  };
};

type WorkerResponse =
  | { ok: true; rawData: unknown[][]; sheetName: string }
  | { ok: false; error: 'no-sheet'; sheets: string[] }
  | { ok: false; error: 'parse-failed'; message: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { buffer, options = {} } = event.data;

    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellText: false,
      cellNF: false,
      cellDates: false,
      sheetStubs: false,
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

    if (!sheet) {
      const response: WorkerResponse = { ok: false, error: 'no-sheet', sheets: workbook.SheetNames };
      self.postMessage(response);
      return;
    }

    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: options.defval ?? '',
      raw: options.raw ?? true,
      blankrows: options.blankrows ?? true,
    });

    const response: WorkerResponse = { ok: true, rawData, sheetName };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      ok: false,
      error: 'parse-failed',
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
