// logger.ts (IN ROOT DIRECTORY)

import * as winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

// 1. Define the custom format for the log messages
const logFormat = printf(({ level, message, timestamp }) => {
    // Format the timestamp for cleaner output
    const time = new Date(timestamp as string).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    });
    
    // Output format: [HH:MM:SS.ms] [LEVEL] MESSAGE
    return `[${time}] [${level.toUpperCase()}] ${message}`;
});

// 2. Create the logger instance
const logger = winston.createLogger({
    // Set the default minimum log level (info, warn, error, debug)
    level: 'info', 
    
    // 🚨 FIX: Add the Console transport
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(), // Add colors for better readability in the terminal
                timestamp(),
                logFormat
            ),
        }),
        // You could add a File transport here for persistent logs, but Console is best for Railway
    ],
    // Set exitOnError to false to prevent process exit on logging errors
    exitOnError: false, 
});

// If not in production, log all messages, including debug
if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug';
}

export default logger;
