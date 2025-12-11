// logger.ts

enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
}

const LOG_LEVEL = LogLevel.INFO;

const log = (level: LogLevel, message: string, ...optionalParams: any[]) => {
    if (level >= LOG_LEVEL) {
        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        console.log(`[${timestamp}] [${levelName}] ${message}`, ...optionalParams);
    }
};

export const logger = {
    debug: (message: string, ...optionalParams: any[]) => log(LogLevel.DEBUG, message, ...optionalParams),
    info: (message: string, ...optionalParams: any[]) => log(LogLevel.INFO, message, ...optionalParams),
    warn: (message: string, ...optionalParams: any[]) => log(LogLevel.WARN, message, ...optionalParams),
    error: (message: string, ...optionalParams: any[]) => log(LogLevel.ERROR, message, ...optionalParams),
    fatal: (message: string, ...optionalParams: any[]) => log(LogLevel.FATAL, message, ...optionalParams),
};
