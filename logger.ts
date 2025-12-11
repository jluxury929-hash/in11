// logger.ts (IN ROOT DIRECTORY)

import * as winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
    const time = new Date(timestamp as string).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    });
    
    return `[${time}] [${level.toUpperCase()}] ${message}`;
});

const logger = winston.createLogger({
    level: 'info', 
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp(),
                logFormat
            ),
        }),
    ],
    exitOnError: false, 
});

if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug';
}

export default logger;
