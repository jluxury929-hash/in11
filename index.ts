// index.ts

import * as dotenv from 'dotenv';
dotenv.config();

// Imports the main bot class, which is likely ProductionMEVBot
import { ProductionMEVBot } from './ProductionMEVBot'; 

// --- Bot Startup ---
async function main() {
    try {
        console.log("[STEP 2] Initializing and Starting MEV Bot...");
        const bot = new ProductionMEVBot();
        await bot.startMonitoring();
    } catch (error: any) {
        console.error(`[ERROR] Fatal startup failure:`);
        console.error(`[ERROR] Details: ${error.message}`);
        process.exit(1);
    }
}

main();
