import { useState, useEffect } from 'react';
import { logStore, type LogEntry } from '@/lib/logger';

export function useLogBuffer() {
  const [entries, setEntries] = useState<LogEntry[]>(() => logStore.getEntries());

  useEffect(() => {
    return logStore.subscribe(setEntries);
  }, []);

  return { entries, clear: logStore.clear };
}
