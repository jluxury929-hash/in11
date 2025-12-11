// index.ts (IN ROOT DIRECTORY)

import * as dotenv from 'dotenv';
dotenv.config();

// FIX: Import files directly by name, as they are in the root
import { apiServer } from './APIServer'; 
import logger from './logger'; // FIX: Removed './utils/'
import { ProductionMEVBot } from './ProductionMEVBot'; 

async function main() {
    logger.info('='.repeat(70));
    logger.info('  MASSIVE TRADING ENGINE STARTUP SEQUENCE');
    logger.info('='.repeat(70));

    try {
        logger.info('[STEP 1] Starting API Server...');
        // Note: Assuming apiServer is initialized elsewhere (e.g., APIServer.ts exports the instance)
        await apiServer.start(); 
        
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
