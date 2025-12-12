// index.ts (Application Entry Point)

import * as dotenv from 'dotenv';
// Load environment variables from .env file immediately
dotenv.config();

import { logger } from './logger';
import { ProductionMEVBot } from './ProductionMEVBot';

/**
 * Main function to initialize and start the MEV bot.
 */
async function main() {
    logger.info("[STEP 1] Starting Container");
    logger.info("[STEP 2] Initializing and Starting MEV Bot...");

    try {
        const bot = new ProductionMEVBot();
        
        // This initiates the entire lifecycle: connection, balance check, and monitoring start
        await bot.startMonitoring();

    } catch (error) {
        logger.fatal("An unrecoverable error occurred during bot execution.", error);
        process.exit(1);
    }
}

// Start the application
main();
