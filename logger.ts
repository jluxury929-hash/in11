import winston from 'winston';
import chalk from 'chalk';

const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
    const ts = new Date(timestamp as string).toLocaleTimeString();
    let coloredLevel = level.toUpperCase();
    
    switch (level) {
        case 'error':
            coloredLevel = chalk.red.bold(level.toUpperCase());
            break;
        case 'warn':
            coloredLevel = chalk.yellow.bold(level.toUpperCase());
            break;
        case 'info':
            coloredLevel = chalk.blue.bold(level.toUpperCase());
            break;
        default:
            coloredLevel = chalk.gray(level.toUpperCase());
    }
    
    return `${chalk.gray(ts)} [${coloredLevel}] ${message}`;
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                consoleFormat
            )
        })
    ]
});

export default logger;


