/**
 * Structured logger — JSON in production, pretty in development.
 *
 * Levels (ascending severity): debug → info → warn → error → fatal
 * Override minimum level via VITE_LOG_LEVEL env var (default: debug dev / info prod).
 *
 * Data masking: any key in SENSITIVE_KEYS is replaced with '[REDACTED]'.
 * String values are scanned for JWT and Supabase key patterns.
 * Passwords, tokens, secrets NEVER appear in logs.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  userId?: string;
  tenantId?: string;
  empresaId?: string;
  action?: string;
  [key: string]: unknown;
}

interface LogPayload {
  context?: LogContext;
  error?: unknown;
  data?: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Record<string, unknown>;
  data?: unknown;
  [key: string]: unknown;
}

// ── Sanitization ──────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'senha', 'pass', 'passwd', 'pwd',
  'token', 'access_token', 'refresh_token', 'id_token',
  'secret', 'api_key', 'apikey', 'anon_key', 'service_key', 'service_role',
  'authorization', 'auth', 'bearer', 'jwt', 'credential',
  'pin', 'cvv', 'otp', 'mfa', 'totp',
]);

const SENSITIVE_PATTERNS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, '[JWT_REDACTED]'],
  [/sb_(?:publishable|secret)_[A-Za-z0-9_]+/g, '[SUPABASE_KEY_REDACTED]'],
  [/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, 'Bearer [REDACTED]'],
];

function sanitizeString(value: string): string {
  let s = value;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack?.split('\n').slice(0, 6).join('\n'),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : sanitize(v, depth + 1);
    }
    return result;
  }

  return String(value);
}

// ── Level control ─────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

const IS_DEV = import.meta.env.DEV;

const MIN_LEVEL: LogLevel =
  (import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined) ??
  (IS_DEV ? 'debug' : 'info');

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

// ── In-memory log buffer (para painel de suporte) ─────────────────────────────

const MAX_BUFFER = 200;
const _buffer: LogEntry[] = [];
const _subscribers: Array<(entries: LogEntry[]) => void> = [];

export const logStore = {
  getEntries: (): LogEntry[] => [..._buffer],

  clear: (): void => {
    _buffer.length = 0;
    _subscribers.forEach((fn) => fn([]));
  },

  /** Retorna função de cancelamento */
  subscribe: (fn: (entries: LogEntry[]) => void): (() => void) => {
    _subscribers.push(fn);
    return () => {
      const i = _subscribers.indexOf(fn);
      if (i !== -1) _subscribers.splice(i, 1);
    };
  },
};

// ── Emit ──────────────────────────────────────────────────────────────────────

function emit(level: LogLevel, message: string, payload?: LogPayload): void {
  if (!shouldLog(level)) return;

  const raw = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(payload?.context !== undefined ? { context: payload.context } : {}),
    ...(payload?.error !== undefined ? { error: payload.error } : {}),
    ...(payload?.data !== undefined ? { data: payload.data } : {}),
  };

  const entry = sanitize(raw) as LogEntry;

  // Armazena no buffer circular (remove o mais antigo quando cheio)
  _buffer.push(entry);
  if (_buffer.length > MAX_BUFFER) _buffer.shift();
  _subscribers.forEach((fn) => fn([..._buffer]));

  const consoleFn =
    level === 'fatal' || level === 'error'
      ? console.error
      : level === 'warn'
      ? console.warn
      : console.log;

  if (IS_DEV) {
    const STYLES: Record<LogLevel, string> = {
      debug: 'color:#6b7280',
      info:  'color:#3b82f6',
      warn:  'color:#d97706;font-weight:bold',
      error: 'color:#ef4444;font-weight:bold',
      fatal: 'color:#fff;background:#dc2626;font-weight:900;padding:1px 4px;border-radius:2px',
    };
    const extras: unknown[] = [];
    if (payload?.context !== undefined) extras.push('ctx →', entry.context);
    if (payload?.error !== undefined)   extras.push('err →', entry.error);
    if (payload?.data !== undefined)    extras.push('data →', entry.data);
    consoleFn(`%c${level.toUpperCase()}%c  ${message}`, STYLES[level], 'color:inherit', ...extras);
  } else {
    consoleFn(JSON.stringify(entry));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

type BoundLogger = {
  debug: (message: string, extra?: { data?: unknown }) => void;
  info:  (message: string, extra?: { data?: unknown }) => void;
  warn:  (message: string, extra?: { error?: unknown; data?: unknown }) => void;
  error: (message: string, extra?: { error?: unknown; data?: unknown }) => void;
  fatal: (message: string, extra?: { error?: unknown; data?: unknown }) => void;
};

export const logger = {
  debug: (message: string, payload?: LogPayload) => emit('debug', message, payload),
  info:  (message: string, payload?: LogPayload) => emit('info',  message, payload),
  warn:  (message: string, payload?: LogPayload) => emit('warn',  message, payload),
  error: (message: string, payload?: LogPayload) => emit('error', message, payload),
  fatal: (message: string, payload?: LogPayload) => emit('fatal', message, payload),

  withContext: (context: LogContext): BoundLogger => ({
    debug: (msg, extra) => emit('debug', msg, { context, ...extra }),
    info:  (msg, extra) => emit('info',  msg, { context, ...extra }),
    warn:  (msg, extra) => emit('warn',  msg, { context, ...extra }),
    error: (msg, extra) => emit('error', msg, { context, ...extra }),
    fatal: (msg, extra) => emit('fatal', msg, { context, ...extra }),
  }),
};
