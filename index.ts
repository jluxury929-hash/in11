// index.ts (Full, Corrected)
import * as dotenv from 'dotenv';
dotenv.config();

import { ProductionMEVBot } from './ProductionMEVBot'; 

async function main() {
    try {
        console.log("[STEP 2] Initializing and Starting MEV Bot...");
        // NOTE: The constructor runs first, then startMonitoring runs async.
        const bot = new ProductionMEVBot(); 
        await bot.startMonitoring(); // This is where async executor initialization happens.
    } catch (error: any) {
        console.error(`[ERROR] Fatal startup failure:`);
        console.error(`[ERROR] Details: ${error.message}`);
        process.exit(1);
    }
}

main();
