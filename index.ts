// index.ts

import * as dotenv from 'dotenv';
dotenv.config();

import { ProductionMEVBot } from './ProductionMEVBot'; 

// --- Bot Startup ---
async function main() {
    try {
        console.log("[STEP 2] Initializing and Starting MEV Bot...");
        const bot = new ProductionMEVBot();
        // APIServer.start(); // You can uncomment this if you need the API server
        await bot.startMonitoring();
    } catch (error: any) {
        console.error(`[ERROR] Fatal startup failure:`);
        console.error(`[ERROR] Details: ${error.message}`);
        process.exit(1);
    }
}

main();
