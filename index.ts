// CRITICAL: Load environment variables FIRST
import * as dotenv from 'dotenv';
dotenv.config();

import { apiServer } from './server/apiServer';
import logger from './utils/logger';
import { config } from './config';

async function main() {
    logger.info('Starting Massive Trading Engine...');
    logger.info(`Environment: ${config.server.environment}`);
    logger.info(`Port: ${config.server.port}`);

    try {
        // Start API server
        await apiServer.start();

        logger.info('Application started successfully');

        // Graceful shutdown
        process.on('SIGINT', () => {
            logger.info('Shutting down...');
            apiServer.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            logger.info('Shutting down...');
            apiServer.stop();
            process.exit(0);
        });

    } catch (error: any) {
        logger.error('Fatal startup error:', error);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
});

// Start application
main();
