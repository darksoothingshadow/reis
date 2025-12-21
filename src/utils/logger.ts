/**
 * Centralized Logger Utility
 * 
 * Provides consistent, structured logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Contextual prefixes
 * - Request/response logging for API calls
 * - Toggleable verbose mode
 */

export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

interface LoggerConfig {
    level: LogLevel;
    showTimestamp: boolean;
    enabledContexts: Set<string> | 'all';
}

const config: LoggerConfig = {
    // Default to WARN: show errors/warnings only, hide debug/info
    level: LogLevel.WARN,
    showTimestamp: true,
    enabledContexts: 'all', // or new Set(['API', 'Sync', 'Storage'])
};

const COLORS = {
    debug: 'color: gray',
    info: 'color: blue',
    warn: 'color: orange; font-weight: bold',
    error: 'color: red; font-weight: bold',
    context: 'color: purple; font-weight: bold',
    timestamp: 'color: gray; font-style: italic',
};

function formatTimestamp(): string {
    const now = new Date();
    return `${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

function shouldLog(level: LogLevel, context?: string): boolean {
    if (level < config.level) return false;
    if (config.enabledContexts === 'all') return true;
    return context ? config.enabledContexts.has(context) : true;
}

class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private log(level: LogLevel, levelName: string, color: string, message: string, ...args: any[]): void {
        if (!shouldLog(level, this.context)) return;

        const parts: string[] = [];
        const styles: string[] = [];

        if (config.showTimestamp) {
            parts.push(`%c${formatTimestamp()}`);
            styles.push(COLORS.timestamp);
        }

        parts.push(`%c[${this.context}]`);
        styles.push(COLORS.context);

        parts.push(`%c${levelName}:`);
        styles.push(color);

        parts.push(`%c${message}`);
        styles.push('color: inherit');

        console.log(parts.join(' '), ...styles, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, 'DEBUG', COLORS.debug, message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, 'INFO', COLORS.info, message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, 'WARN', COLORS.warn, message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, 'ERROR', COLORS.error, message, ...args);
    }

    /**
     * Log a fetch request with timing
     */
    async fetch<T>(
        url: string,
        options?: RequestInit,
        parser?: (response: Response) => Promise<T>
    ): Promise<{ data: T | null; response: Response | null; error: Error | null; durationMs: number }> {
        const start = performance.now();
        const method = options?.method || 'GET';

        this.debug(`→ ${method} ${url}`);

        try {
            const response = await fetch(url, options);
            const durationMs = Math.round(performance.now() - start);

            if (!response.ok) {
                this.warn(`← ${method} ${url} - ${response.status} ${response.statusText} (${durationMs}ms)`);
                return { data: null, response, error: null, durationMs };
            }

            const data = parser ? await parser(response) : (await response.text()) as unknown as T;
            this.info(`← ${method} ${url} - ${response.status} OK (${durationMs}ms)`);

            return { data, response, error: null, durationMs };
        } catch (error) {
            const durationMs = Math.round(performance.now() - start);
            this.error(`✗ ${method} ${url} - Failed (${durationMs}ms)`, error);
            return { data: null, response: null, error: error as Error, durationMs };
        }
    }

    /**
     * Log the start and end of an async operation
     */
    async operation<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const start = performance.now();
        this.debug(`⏳ ${name} started`);

        try {
            const result = await fn();
            const durationMs = Math.round(performance.now() - start);
            this.info(`✓ ${name} completed (${durationMs}ms)`);
            return result;
        } catch (error) {
            const durationMs = Math.round(performance.now() - start);
            this.error(`✗ ${name} failed (${durationMs}ms)`, error);
            throw error;
        }
    }

    /**
     * Create a child logger with a sub-context
     */
    child(subContext: string): Logger {
        return new Logger(`${this.context}:${subContext}`);
    }
}

/**
 * Create a logger for a specific context/module
 */
export function createLogger(context: string): Logger {
    return new Logger(context);
}

/**
 * Pre-configured loggers for common modules
 */
export const loggers = {
    api: createLogger('API'),
    sync: createLogger('Sync'),
    storage: createLogger('Storage'),
    files: createLogger('Files'),
    ui: createLogger('UI'),
    auth: createLogger('Auth'),
    system: createLogger('System'),
    parser: createLogger('Parser'),
};

/**
 * Configure logger settings at runtime
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
    Object.assign(config, options);
}

/**
 * Utility to disable all logging (e.g., in tests)
 */
export function disableLogging(): void {
    (config as any).level = LogLevel.ERROR + 1;
}

/**
 * Utility to enable verbose logging
 */
export function enableVerboseLogging(): void {
    config.level = LogLevel.DEBUG;
}
