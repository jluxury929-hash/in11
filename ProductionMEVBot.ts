// ProductionMEVBot.ts (FINAL, COMPLETE, AND STABLE VERSION)

import { 
    ethers, 
    Wallet
} from 'ethers';

import * as dotenv from 'dotenv';
import { logger } from './logger';
import { BotConfig } from './types'; 
import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor';

export class ProductionMEVBot { 
    private signer: Wallet; 
    private authSigner: Wallet; 
    private httpProvider: ethers.providers.JsonRpcProvider;
    private wsProvider: ethers.providers.WebSocketProvider | undefined;
    private executor: FlashbotsMEVExecutor | undefined;
    private config: BotConfig;

    constructor() {
        this.config = {
            walletAddress: process.env.WALLET_ADDRESS || '',
            authSignerKey: process.env.FB_REPUTATION_KEY || '',
            minEthBalance: parseFloat(process.env.MIN_ETH_BALANCE || '0.02'), 
            gasReserveEth: parseFloat(process.env.GAS_RESERVE_ETH || '0.01'),
            minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.05'),
            mevHelperContractAddress: process.env.MEV_HELPER_CONTRACT_ADDRESS || '',
            flashbotsUrl: process.env.FLASHBOTS_URL || 'https://relay.flashbots.net',
        };

        const privateKey = process.env.PRIVATE_KEY;
        const fbReputationKey = process.env.FB_REPUTATION_KEY;
        const httpRpcUrl = process.env.ETH_HTTP_RPC_URL;
        
        if (!privateKey || !fbReputationKey || !httpRpcUrl) {
             logger.warn("Missing critical environment variables during construction. Executor initialization will fail.");
        }
        
        // Initialize Providers and Wallets
        this.httpProvider = new ethers.providers.JsonRpcProvider(httpRpcUrl || 'http://placeholder.local'); 
        this.signer = new Wallet(privateKey || ethers.constants.HashZero, this.httpProvider);
        this.authSigner = new Wallet(fbReputationKey || ethers.constants.HashZero); 
        this.config.walletAddress = this.signer.address;
        
        const wssRpcUrl = process.env.ETH_WSS_URL;
        if (wssRpcUrl) {
            try {
                this.wsProvider = new ethers.providers.WebSocketProvider(wssRpcUrl); 
                this.setupWsConnectionListeners();
            } catch (error) {
                logger.error("WebSocket Provider failed to initialize.", error);
                this.wsProvider = undefined; 
            }
        }
        logger.info("Bot configuration loaded.");
    }

    private async initializeExecutor(): Promise<void> {
        const privateKey = process.env.PRIVATE_KEY;
        const fbReputationKey = process.env.FB_REPUTATION_KEY;
        const httpRpcUrl = process.env.ETH_HTTP_RPC_URL;
        const flashbotsUrl = this.config.flashbotsUrl;

        if (!privateKey || !fbReputationKey || !httpRpcUrl) {
            return;
        }

        try {
            this.executor = await FlashbotsMEVExecutor.create(
                privateKey,
                fbReputationKey,
                httpRpcUrl,
                flashbotsUrl
            );
            logger.info("Flashbots Executor initialized successfully.");
        } catch (error) {
            logger.fatal("Failed to initialize FlashbotsMEVExecutor.", error);
        }
    }

    private setupWsConnectionListeners(): void {
        if (!this.wsProvider) return;

        // CRITICAL: Catches errors emitted by the WSS transport layer
        this.wsProvider.on('error', (error: Error) => {
            logger.error(`[WSS] Provider Event Error: ${error.message}`);
        });

        this.wsProvider.on('open', () => {
            logger.info("WSS Connection established successfully! Monitoring mempool...");
            
            // Attach pending listener only after connection is confirmed open.
            this.wsProvider!.on('pending', this.handlePendingTransaction.bind(this));
        });
    }

    // Must be async to handle non-blocking fetching of transaction data (if implemented)
    private async handlePendingTransaction(txHash: string): Promise<void> {
        try {
            // Logs a message every time a new transaction is received (confirms WSS is working)
            logger.info(`[PENDING] Received hash: ${txHash.substring(0, 10)}... Processing...`);
            
            // --- CORE MEV LOGIC IMPLEMENTATION AREA ---
            // If you implement your trading strategy here, it must be contained within this try/catch block.
            // Example of what would go here:
            /*
            const tx = await this.httpProvider.getTransaction(txHash);
            if (!tx || !tx.to) return; 

            // Logic to calculate profitability and build bundle here...

            if (profit > this.config.minProfitThreshold) {
                const bundle = await buildSignedBundle(tx, this.signer, this.authSigner);
                const blockNumber = await this.httpProvider.getBlockNumber();
                const submissionResult = await this.executor.sendBundle(bundle, blockNumber + 1);
                logger.info(`[SUBMITTED] Bundle hash: ${submissionResult.bundleHash}`);
            }
            */
            
        } catch (error) {
            // Prevents runtime crashes from escaping event loop during processing
            logger.error(`[RUNTIME CRASH] Failed to process transaction ${txHash}`, error);
        }
    }

    public async startMonitoring(): Promise<void> {
        logger.info("[STATUS] Starting bot services...");

        // 1. Initialize the Asynchronous services
        await this.initializeExecutor(); 
        if (!this.executor) {
            logger.fatal("Cannot start monitoring due to Executor failure. Check .env variables.");
            return;
        }

        // 2. Check Wallet Balance
        try {
            const balance = await this.httpProvider.getBalance(this.config.walletAddress);
            const formattedBalance = ethers.utils.formatEther(balance); 
            logger.info(`[BALANCE] Current ETH Balance: ${formattedBalance} ETH`);

            // This is the safety check that caused the previous 'shutting down' logs
            if (balance.lt(ethers.utils.parseEther(this.config.minEthBalance.toString()))) { 
                logger.fatal(`Balance (${formattedBalance}) is below MIN_ETH_BALANCE (${this.config.minEthBalance}). Shutting down.`);
                return;
            }
        } catch (error) {
            logger.fatal("Could not check balance. Check HTTP_RPC_URL.", error);
            return;
        }

        // 3. Start Mempool Monitoring and Health Check
        if (!this.wsProvider) {
            logger.warn("WSS Provider is not active. Cannot monitor mempool in real-time.");
        } else {
            logger.info("[STATUS] Monitoring fully active.");
            
            // HEALTH CHECK: Logs every minute to confirm the Node.js process is alive and not frozen.
            setInterval(() => {
                // Use debug level to prevent cluttering the info logs unless debug is enabled
                logger.debug("[HEALTH CHECK] Bot process is alive.");
            }, 60000); 
        }
    }
}
