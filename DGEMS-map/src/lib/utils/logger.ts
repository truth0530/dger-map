/**
 * 로깅 유틸리티
 * 구조화된 로깅 및 성능 추적
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ===== 글로벌 로그 스토리지 (개발환경용) =====
const globalForLogs = globalThis as unknown as {
  _logHistory: LogEntry[];
  _performanceMetrics: PerformanceEntry[];
};

if (!globalForLogs._logHistory) {
  globalForLogs._logHistory = [];
}
if (!globalForLogs._performanceMetrics) {
  globalForLogs._performanceMetrics = [];
}

const MAX_LOG_ENTRIES = 1000;
const MAX_PERF_ENTRIES = 100;

// ===== 로그 레벨 설정 =====
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

// ===== 로거 클래스 =====
class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
  }

  private createEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
    };

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, data, error);

    // 콘솔 출력
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      case 'info':
        console.info(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '', error || '');
        break;
    }

    // 히스토리 저장
    globalForLogs._logHistory.push(entry);
    if (globalForLogs._logHistory.length > MAX_LOG_ENTRIES) {
      globalForLogs._logHistory.shift();
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('error', message, data, error);
  }

  // 성능 측정 시작
  startTimer(name: string, metadata?: Record<string, unknown>): () => number {
    const entry: PerformanceEntry = {
      name: `${this.context}:${name}`,
      startTime: performance.now(),
      metadata,
    };

    globalForLogs._performanceMetrics.push(entry);
    if (globalForLogs._performanceMetrics.length > MAX_PERF_ENTRIES) {
      globalForLogs._performanceMetrics.shift();
    }

    return () => {
      entry.endTime = performance.now();
      entry.duration = entry.endTime - entry.startTime;
      this.debug(`${name} completed`, { duration: `${entry.duration.toFixed(2)}ms` });
      return entry.duration;
    };
  }

  // API 요청 로깅
  logApiRequest(method: string, url: string, params?: Record<string, unknown>): void {
    this.info('API Request', { method, url, params });
  }

  // API 응답 로깅
  logApiResponse(
    method: string,
    url: string,
    status: number,
    duration: number,
    itemCount?: number
  ): void {
    this.info('API Response', {
      method,
      url,
      status,
      duration: `${duration.toFixed(2)}ms`,
      itemCount,
    });
  }

  // 캐시 이벤트 로깅
  logCacheEvent(
    event: 'hit' | 'miss' | 'set' | 'evict',
    key: string,
    metadata?: Record<string, unknown>
  ): void {
    this.debug(`Cache ${event}`, { key, ...metadata });
  }
}

// ===== 팩토리 함수 =====
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// ===== 글로벌 로거 =====
export const logger = createLogger('app');

// ===== 로그 히스토리 조회 =====
export function getLogHistory(options?: {
  level?: LogLevel;
  context?: string;
  limit?: number;
}): LogEntry[] {
  let logs = [...globalForLogs._logHistory];

  if (options?.level) {
    logs = logs.filter((l) => l.level === options.level);
  }

  if (options?.context) {
    logs = logs.filter((l) => l.context === options.context);
  }

  if (options?.limit) {
    logs = logs.slice(-options.limit);
  }

  return logs;
}

// ===== 성능 메트릭 조회 =====
export function getPerformanceMetrics(options?: {
  name?: string;
  limit?: number;
}): PerformanceEntry[] {
  let metrics = [...globalForLogs._performanceMetrics];

  if (options?.name) {
    const filterName = options.name;
    metrics = metrics.filter((m) => m.name.includes(filterName));
  }

  if (options?.limit) {
    metrics = metrics.slice(-options.limit);
  }

  return metrics;
}

// ===== 평균 성능 계산 =====
export function getAveragePerformance(name: string): number | null {
  const metrics = globalForLogs._performanceMetrics.filter(
    (m) => m.name.includes(name) && m.duration !== undefined
  );

  if (metrics.length === 0) return null;

  const total = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
  return total / metrics.length;
}

// ===== 로그 및 메트릭 초기화 =====
export function clearLogs(): void {
  globalForLogs._logHistory = [];
}

export function clearMetrics(): void {
  globalForLogs._performanceMetrics = [];
}
