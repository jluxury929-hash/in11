// ProductionMEVBot.ts (FINAL, RUNTIME-SAFE VERSION)

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

    // FIX: Simplified and robust listener attachment
    private setupWsConnectionListeners(): void {
        if (!this.wsProvider) return;

        this.wsProvider.on('error', (error: Error) => {
            logger.error(`[WSS] Provider Event Error: ${error.message}`);
        });

        this.wsProvider.on('open', () => {
            logger.info("WSS Connection established successfully! Monitoring mempool...");
        });
        
        // Attach the pending listener directly
        this.wsProvider.on('pending', this.handlePendingTransaction.bind(this));
    }

    // FIX: Added try...catch block to prevent runtime crashes
    private handlePendingTransaction(txHash: string): void {
        try {
            // --- YOUR CORE MEV LOGIC GOES HERE ---
            // If this section is empty, this error might indicate an invalid WSS URL 
            // is still crashing the provider externally.
            logger.debug(`[Pending TX] Received hash: ${txHash}. Processing...`);

            // Example of what should be here (but requires implementation):
            // const tx = this.httpProvider.getTransaction(txHash);
            // if (!tx) return;
            // this.executor.attemptArbitrage(tx);
            
        } catch (error) {
            // CRITICAL: Catches any synchronous error from your processing logic.
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

            if (balance.lt(ethers.utils.parseEther(this.config.minEthBalance.toString()))) { 
                logger.fatal(`Balance (${formattedBalance}) is below MIN_ETH_BALANCE (${this.config.minEthBalance}). Shutting down.`);
                return;
            }
        } catch (error) {
            logger.fatal("Could not check balance. Check HTTP_RPC_URL.", error);
            return;
        }

        // 3. Start Mempool Monitoring
        if (!this.wsProvider) {
            logger.warn("WSS Provider is not active. Cannot monitor mempool in real-time.");
        } else {
            logger.info("[STATUS] Monitoring fully active.");
        }
    }
}
