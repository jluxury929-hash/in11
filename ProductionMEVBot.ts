// ProductionMEVBot.ts

import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor'; 
import logger from './logger'; // Assumed from index.ts structure
// Note: You must define or import the 'logger' module separately.

// --- Environment Variables (Read from process.env) ---
const ETHEREUM_RPC_HTTP = process.env.ETHEREUM_RPC_HTTP as string;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as string;
const FLASHBOTS_RELAY_URL = process.env.FLASHBOTS_RELAY_URL as string;
const FLASHBOTS_RELAY_SIGNER_KEY = process.env.FLASHBOTS_RELAY_SIGNER_KEY as string;

// **FIX for TS2305:** Exporting the class so index.ts can import it.
export class ProductionMEVBot {
    private executor: FlashbotsMEVExecutor;

    constructor() {
        // **FIX for TS2554:** Constructor now receives a single config object.
        this.executor = new FlashbotsMEVExecutor({
            rpcUrl: ETHEREUM_RPC_HTTP,
            walletPrivateKey: WALLET_PRIVATE_KEY,
            flashbots: {
                relayUrl: FLASHBOTS_RELAY_URL,
                relaySignerKey: FLASHBOTS_RELAY_SIGNER_KEY,
            }
        });
        logger.info('Bot instance created and configured.');
    }

    public async initialize() {
        // Initializes the connections (RPC, Flashbots Auth)
        await this.executor.initialize();
        logger.info('Bot initialized successfully.');
    }

    public async startMempoolMonitoring() {
        // Calls the method that starts the main MEV loop
        await this.executor.startMonitoring();

        // Example logic:
        // setInterval(() => this.executor.periodicResync(), 60000); 
    }
    
    // You can add other top-level bot methods here if needed, 
    // such as a graceful shutdown handler.
}
