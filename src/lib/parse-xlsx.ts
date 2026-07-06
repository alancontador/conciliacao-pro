export type XlsxParseResult =
  | { ok: true; rawData: unknown[][]; sheetName: string }
  | { ok: false; error: 'no-sheet'; sheets: string[] }
  | { ok: false; error: 'parse-failed'; message: string };

export type XlsxParseOptions = {
  defval?: string;
  blankrows?: boolean;
  raw?: boolean;
};

/**
 * Parses an XLSX/XLS ArrayBuffer in a Web Worker so the main thread stays
 * responsive even for large files (10–50 MB).
 */
export function parseXlsxInWorker(
  arrayBuffer: ArrayBuffer,
  options?: XlsxParseOptions,
): Promise<XlsxParseResult> {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL('../workers/xlsx.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<XlsxParseResult>) => {
      worker.terminate();
      resolve(e.data);
    };

    worker.onerror = (e) => {
      worker.terminate();
      resolve({ ok: false, error: 'parse-failed', message: e.message ?? 'Unknown worker error' });
    };

    // Transfer (not copy) the buffer for zero-copy efficiency
    worker.postMessage({ buffer: arrayBuffer, options }, [arrayBuffer]);
  });
}
