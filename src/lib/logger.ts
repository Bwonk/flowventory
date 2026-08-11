/**
 * Yapılandırılmış sunucu tarafı logger.
 *
 * - Development: okunaklı `[level] mesaj {context}` formatı.
 * - Production: satır başına tek JSON — log toplayıcılar (Datadog, Loki,
 *   CloudWatch vb.) doğrudan parse edebilir.
 *
 * Kurallar:
 * - Token/secret ASLA loglanmaz (CLAUDE.md güvenlik kuralı).
 * - Context'e merchantId gibi ayıklanabilir alanlar konur, serbest metin değil.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const IS_PROD = process.env.NODE_ENV === 'production';

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: IS_PROD ? undefined : value.stack };
  }
  return value;
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const fn = level === 'debug' ? console.debug : console[level];
  if (IS_PROD) {
    const payload: Record<string, unknown> = {
      level,
      message,
      time: new Date().toISOString(),
    };
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        payload[key] = serializeError(value);
      }
    }
    fn(JSON.stringify(payload));
    return;
  }
  if (context) {
    fn(`[${level}] ${message}`, context);
  } else {
    fn(`[${level}] ${message}`);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
