// src/index.ts

import * as dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import { logger } from './logger.js'; // FIX: .js extension for ES Module compliance
import { ProductionMEVBot } from './ProductionMEVBot.js'; // FIX: .js extension for ES Module compliance

// --- Main Application Entry Point ---
async function main() {
    logger.info(`[STEP 1] Initializing Node.js MEV Trading Engine...`);
    logger.info(`Node.js Version: ${process.version}`);

    // Optional: Start a simple API server for health checks or monitoring, 
    // assuming APIServer.ts exists and uses the required .js import
    // startAPIServer(); 

    logger.info(`[STEP 2] Initializing and Starting MEV Bot...`);
    
    try {
        const bot = new ProductionMEVBot();
        await bot.startMonitoring();
    } catch (error) {
        logger.fatal("FATAL: Unhandled exception during bot startup.", error);
        // Exit the process if the bot fails to start
        process.exit(1);
    }
}

// Start the application and handle uncaught exceptions gracefully
main().catch((error) => {
    logger.fatal("FATAL: Main application crash.", error);
    process.exit(1);
});

// Graceful shutdown handling for Ctrl+C or Docker stop
process.on('SIGINT', () => {
    logger.warn("SIGINT received. Initiating graceful shutdown...");
    // Perform any necessary cleanup (e.g., closing open connections) here
    process.exit(0);
});
