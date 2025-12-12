// ProductionMEVBot.ts (COMPLETE, ROBUST, AND READY FOR MEV LOGIC)

import { 
    ethers, 
    Wallet
} from 'ethers';

import * as dotenv from 'dotenv';
import { logger } from './logger';
import { BotConfig } from './types'; 
// NOTE: FlashbotsMEVExecutor must be a separate file in your project
import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor'; 

// Global variable for a short delay on reconnection attempts
const RECONNECT_DELAY_MS = 5000; 

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
        
        // ** CRITICAL CHANGE 1: Use the new initializer for WSS connection **
        this.initializeWsProvider();
        
        logger.info("Bot configuration loaded.");
    }

    // ** CRITICAL ADDITION 1: Centralized WSS Provider Initialization (for reconnecting) **
    private initializeWsProvider(): void {
        const wssRpcUrl = process.env.ETH_WSS_URL;
        if (!wssRpcUrl) {
            this.wsProvider = undefined;
            return;
        }

        try {
            // Remove all listeners from the old provider before creating a new one
            if (this.wsProvider) {
                this.wsProvider.removeAllListeners();
            }
            
            this.wsProvider = new ethers.providers.WebSocketProvider(wssRpcUrl); 
            this.setupWsConnectionListeners();
        } catch (error) {
            logger.error("WebSocket Provider failed to initialize.", error);
            this.wsProvider = undefined; 
        }
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

    // ** CRITICAL CHANGE 2: Added 'close' listener for robust reconnection **
    private setupWsConnectionListeners(): void {
        if (!this.wsProvider) return;

        this.wsProvider.on('error', (error: Error) => {
            logger.error(`[WSS] Provider Event Error: ${error.message}. Attempting reconnect...`);
            this.reconnectWsProvider();
        });

        this.wsProvider.on('close', (code: number, reason: string) => {
            logger.error(`[WSS] Connection Closed (Code: ${code}). Reason: ${reason}. Attempting reconnect...`);
            this.reconnectWsProvider();
        });
        
        this.wsProvider.on('open', () => {
            logger.info("WSS Connection established successfully! Monitoring mempool...");
            this.wsProvider!.on('pending', this.handlePendingTransaction.bind(this));
        });
    }

    // ** CRITICAL ADDITION 2: Reconnection Logic (The Self-Healing Function) **
    private reconnectWsProvider(): void {
        if (!process.env.ETH_WSS_URL) return;

        // Use a timeout to avoid spamming the provider if the connection immediately fails
        setTimeout(() => {
            logger.warn("[WSS] Retrying connection...");
            this.initializeWsProvider(); 
        }, RECONNECT_DELAY_MS);
    }

    private async handlePendingTransaction(txHash: string): Promise<void> {
        // Prevent action if the executor is not ready
        if (!this.executor) return; 

        try {
            // Log for operational confirmation
            logger.info(`[PENDING] Received hash: ${txHash.substring(0, 10)}... Processing...`);
            
            // ----------------------------------------------------------------------
            // !!! CORE MEV TRADING LOGIC GOES HERE !!!
            // This is where you implement the strategy to:
            // 1. Fetch TX details: await this.httpProvider.getTransaction(txHash);
            // 2. Simulate the trade and calculate profit.
            // 3. Build a Flashbots bundle.
            // 4. Submit the bundle: await this.executor.sendBundle(...)
            // ----------------------------------------------------------------------
            
        } catch (error) {
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

        // 2. Check Wallet Balance (Safety Check)
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

        // 3. Start Mempool Monitoring and Health Check
        if (!this.wsProvider) {
            logger.warn("WSS Provider is not active. Cannot monitor mempool in real-time.");
        } else {
            logger.info("[STATUS] Monitoring fully active.");
            
            // ** CRITICAL ADDITION 3: Health Check **
            setInterval(() => {
                logger.debug("[HEALTH CHECK] Bot process is alive.");
            }, 60000); 
        }
    }
}
