// ProductionMEVBot.ts (Ethers v5 Syntax - FINAL FIXED VERSION)

import { 
    ethers, // Rely on global import for v5 syntax (ethers.providers, ethers.utils)
    Wallet
} from 'ethers';

import * as dotenv from 'dotenv';
import { logger } from './logger';
import { BotConfig } from './types'; 
import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor'; // Assuming this is imported

export class ProductionMEVBot { 
    private signer: Wallet; 
    private authSigner: Wallet; 
    private httpProvider: ethers.providers.JsonRpcProvider; // Ethers v5 type
    private wsProvider: ethers.providers.WebSocketProvider | undefined; // Ethers v5 type
    private executor: FlashbotsMEVExecutor | undefined; // Added executor instance
    private config: BotConfig;

    constructor() {
        // Load config logic
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
        if (!privateKey) throw new Error("PRIVATE_KEY not set in environment.");
        if (!fbReputationKey) throw new Error("FB_REPUTATION_KEY (Flashbots Auth Signer) not set.");
        
        const httpRpcUrl = process.env.ETH_HTTP_RPC_URL;
        if (!httpRpcUrl) throw new Error("ETH_HTTP_RPC_URL not set.");
        
        // Ethers v5 syntax
        this.httpProvider = new ethers.providers.JsonRpcProvider(httpRpcUrl); 
        
        this.signer = new Wallet(privateKey, this.httpProvider);
        this.authSigner = new Wallet(fbReputationKey); 
        this.config.walletAddress = this.signer.address;
        
        const wssRpcUrl = process.env.ETH_WSS_URL;
        if (wssRpcUrl) {
            logger.debug(`Attempting WSS connection with URL: ${wssRpcUrl}`); 
            try {
                // Ethers v5 syntax
                this.wsProvider = new ethers.providers.WebSocketProvider(wssRpcUrl); 
                this.setupWsConnectionListeners();
            } catch (error) {
                logger.error("WebSocket Provider failed to initialize.", error);
                this.wsProvider = undefined; 
            }
        } else {
            logger.warn("ETH_WSS_URL not set. Running in limited mode.");
        }

        logger.info("Bot configuration loaded.");
    }

    // FIX: Use an asynchronous method to initialize the Flashbots Executor
    private async initializeExecutor(): Promise<void> {
        const privateKey = process.env.PRIVATE_KEY;
        const fbReputationKey = process.env.FB_REPUTATION_KEY;
        const httpRpcUrl = process.env.ETH_HTTP_RPC_URL;
        const flashbotsUrl = this.config.flashbotsUrl;

        if (!privateKey || !fbReputationKey || !httpRpcUrl) {
            logger.fatal("Missing required environment variables for Executor initialization.");
            return;
        }

        try {
            // Must use the async static factory method we created in the executor class
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

        this.wsProvider.on('open', () => {
            logger.info("WSS Connection established successfully! Monitoring mempool...");
            this.wsProvider!.on('pending', this.handlePendingTransaction.bind(this));
        });

        this.wsProvider.on('error', (error: Error) => {
            logger.error(`[WSS] Provider Event Error: ${error.message}`);
        });
    }

    private handlePendingTransaction(txHash: string): void {
        // Core MEV logic
        // This is where you would call the executor: 
        // if (this.executor) {
        //    this.executor.sendBundle(...)
        // }
    }

    public async startMonitoring(): Promise<void> {
        logger.info("[STATUS] Starting bot services...");

        // 1. Initialize the Asynchronous services (like Flashbots)
        await this.initializeExecutor(); 
        if (!this.executor) {
            logger.fatal("Cannot start monitoring without a valid Flashbots Executor.");
            return;
        }

        // 2. Check Wallet Balance
        try {
            const balance = await this.httpProvider.getBalance(this.config.walletAddress);
            // Ethers v5 syntax
            const formattedBalance = ethers.utils.formatEther(balance); 
            logger.info(`[BALANCE] Current ETH Balance: ${formattedBalance} ETH`);

            // Ethers v5 syntax
            if (balance.lt(ethers.utils.parseEther(this.config.minEthBalance.toString()))) { 
                logger.fatal(`Balance (${formattedBalance}) is below MIN_ETH_BALANCE (${this.config.minEthBalance}). Shutting down.`);
                return;
            }
        } catch (error) {
            logger.fatal("Could not check balance. Check HTTP_RPC_URL or wallet balance.", error);
            return;
        }

        // 3. Start Mempool Monitoring
        if (!this.wsProvider) {
            logger.warn("WSS Provider is not active. Cannot monitor mempool in real-time. Execution is limited.");
            return;
        }

        logger.info("[STATUS] Monitoring fully active.");
    }
}
