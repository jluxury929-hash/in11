// index.ts (IN ROOT DIRECTORY)

import * as dotenv from 'dotenv';
dotenv.config();

// FIX: Import files directly by name, as they are in the root
import { apiServer } from './APIServer'; // Changed from './src/api/APIServer'
import logger from './utils/logger'; // Assumes you have a file named utils/logger.ts or logger.ts in root
import { ProductionMEVBot } from './ProductionMEVBot'; // Changed from './src/engine/ProductionMEVBot'

//
async function main() {
    logger.info('='.repeat(70));
    logger.info('  MASSIVE TRADING ENGINE STARTUP SEQUENCE');
    logger.info('='.repeat(70));

    try {
        // 1. Start API Server INSTANTLY for quick health check response.
        logger.info('[STEP 1] Starting API Server...');
        await apiServer.start(); 
        
        // 2. Initialize and Start the Heavy Bot AFTER API is running.
        logger.info('[STEP 2] Initializing and Starting MEV Bot...');
        const bot = new ProductionMEVBot(); 
        await bot.initialize();
        await bot.startMempoolMonitoring();

        logger.info('[STEP 3] Full system operational.');

        // Setup graceful shutdown
        process.on('SIGINT', async () => {
            await bot.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await bot.stop();
            process.exit(0);
        });

    } catch (error: any) {
        logger.error('Fatal startup failure:', error.message);
        logger.error('Details:', error);
        // Crash on FATAL error so Railway restarts cleanly
        process.exit(1); 
    }
}

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception (FATAL):', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection (FATAL):', reason);
    process.exit(1);
});

main();
