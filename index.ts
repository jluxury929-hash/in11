// index.ts (Application Entry Point)

// 🚨 CRITICAL FIX 1: Ensure environment variables are loaded FIRST.
// This is redundant if imported by config.ts, but safe for index.
import * as dotenv from 'dotenv';
dotenv.config();

import { apiServer } from './src/api/APIServer';
import logger from './src/utils/logger'; // Assuming logger is inside src/utils
import { ProductionMEVBot } from './src/engine/ProductionMEVBot'; // Assuming the main bot is here

async function main() {
    logger.info('='.repeat(70));
    logger.info('  MASSIVE TRADING ENGINE STARTUP SEQUENCE');
    logger.info('='.repeat(70));

    try {
        // 1. Start API Server INSTANTLY for quick health check response.
        logger.info('[STEP 1] Starting API Server...');
        await apiServer.start(); 
        
        // 2. Initialize and Start the Heavy Bot AFTER API is running.
        // This ensures the Event Loop is free for /health checks.
        logger.info('[STEP 2] Initializing and Starting MEV Bot...');
        const bot = new ProductionMEVBot(); // Assuming your provided bot class is here
        await bot.initialize(); // Initialize connections, Flashbots, etc.
        await bot.startMempoolMonitoring(); // Start the actual monitoring/trading loop

        logger.info('[STEP 3] Full system operational.');

        // Setup graceful shutdown (SIGINT/SIGTERM)
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
        // CRASH on FATAL error so Railway restarts cleanly
        process.exit(1); 
    }
}

// CRITICAL CATCH-ALLS for stability
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception (FATAL):', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection (FATAL):', reason);
    process.exit(1);
});

main();

