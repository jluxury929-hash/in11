import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor'; 
import logger from './logger'; 

// --- Environment Variables (Read from process.env) ---
const ETHEREUM_RPC_HTTP = process.env.ETHEREUM_RPC_HTTP as string;
const ETHEREUM_RPC_WSS = process.env.ETHEREUM_RPC_WSS as string; // <-- NEW WSS VARIABLE
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as string;
const FLASHBOTS_RELAY_URL = process.env.FLASHBOTS_RELAY_URL as string;
const FLASHBOTS_RELAY_SIGNER_KEY = process.env.FLASHBOTS_RELAY_SIGNER_KEY as string;

// Exported class structure to satisfy new ProductionMEVBot() call in index.ts
export class ProductionMEVBot {
    private executor: FlashbotsMEVExecutor;

    constructor() {
        // Constructor now receives all necessary config parameters
        this.executor = new FlashbotsMEVExecutor({
            rpcUrl: ETHEREUM_RPC_HTTP,
            rpcWssUrl: ETHEREUM_RPC_WSS, // <-- WSS passed here
            walletPrivateKey: WALLET_PRIVATE_KEY,
            flashbots: {
                relayUrl: FLASHBOTS_RELAY_URL,
                relaySignerKey: FLASHBOTS_RELAY_SIGNER_KEY,
            }
        });
        logger.info('Bot instance created and configured.');
    }

    public async initialize() {
        await this.executor.initialize();
        logger.info('Bot initialized successfully.');
    }

    public async startMempoolMonitoring() {
        await this.executor.startMonitoring();
    }
}
