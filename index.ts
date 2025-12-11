// index.ts (Final, Cleaned-Up Version)

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// --- TYPE DEFINITIONS (Simplified) ---
interface BotConfig {
    walletAddress: string;
    authSignerKey: string; 
    minEthBalance: number;
    gasReserveEth: number;
    minProfitThreshold: number;
    mevHelperContractAddress: string;
    flashbotsUrl: string;
}

class MEVBot {
    private signer: ethers.Wallet; 
    private authSigner: ethers.Wallet; 
    private httpProvider: ethers.providers.JsonRpcProvider;
    private wsProvider: ethers.providers.WebSocketProvider | undefined;
    private config: BotConfig;

    constructor() {
        this.config = this.loadConfig();

        // --- 1. Wallet Initialization ---
        const privateKey = process.env.PRIVATE_KEY;
        // CHANGE: Added FB_REPUTATION_KEY check
        const fbReputationKey = process.env.FB_REPUTATION_KEY;
        if (!privateKey) throw new Error("PRIVATE_KEY not set in environment.");
        if (!fbReputationKey) throw new Error("FB_REPUTATION_KEY (Flashbots Auth Signer) not set.");
        
        // --- 2. HTTP Provider Setup (for balances, nonce) ---
        const httpRpcUrl = process.env.ETH_HTTP_RPC_URL;
        if (!httpRpcUrl) throw new Error("ETH_HTTP_RPC_URL not set.");
        this.httpProvider = new ethers.providers.JsonRpcProvider(httpRpcUrl);
        
        this.signer = new ethers.Wallet(privateKey, this.httpProvider);
        this.authSigner = new ethers.Wallet(fbReputationKey); 
        this.config.walletAddress = this.signer.address;
        
        // --- 3. WSS Provider Setup (FIX for 'onopen' crash & network errors) ---
        const wssRpcUrl = process.env.ETH_WSS_URL;
        if (wssRpcUrl) {
            // CHANGE: Added DEBUG log to confirm URL is read
            console.log(`[DEBUG] Attempting WSS connection with URL: ${wssRpcUrl}`); 
            try {
                this.wsProvider = new ethers.providers.WebSocketProvider(wssRpcUrl);
                this.setupWsConnectionListeners();
            } catch (error) {
                // CHANGE: Robust error handling for WSS initialization failure
                console.error("[FATAL] WebSocket Provider failed to initialize. Check WSS_URL or Firewall.", error);
                this.wsProvider = undefined; 
            }
        } else {
            console.warn("ETH_WSS_URL not set. Running in limited mode.");
        }

        console.log("=================================================");
        console.log(`[INIT] Wallet Address: ${this.config.walletAddress}`);
        console.log(`[INIT] Auth Signer: ${this.authSigner.address}`);
        console.log(`[INIT] Min Profit: ${this.config.minProfitThreshold} ETH`);
        console.log("=================================================");
    }

    private loadConfig(): BotConfig {
        // Reads from .env file or uses recommended defaults
        return {
            walletAddress: '', 
            authSignerKey: '', 
            // CHANGE: Added critical safety/economic parameters
            minEthBalance: parseFloat(process.env.MIN_ETH_BALANCE || '0.02'), 
            gasReserveEth: parseFloat(process.env.GAS_RESERVE_ETH || '0.01'),
            minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.05'),
            mevHelperContractAddress: process.env.MEV_HELPER_CONTRACT_ADDRESS || '',
            flashbotsUrl: process.env.FLASHBOTS_URL || 'https://relay.flashbots.net',
        };
    }

    /**
     * FIX: Uses safe provider event handlers and eliminates conflicting logic 
     * that caused the "unhandled: Event { tag: 'open', ... }" error.
     */
    private setupWsConnectionListeners(): void {
        if (!this.wsProvider) return;

        // FIX: The clean, non-conflicting way to detect connection open.
        this.wsProvider.on('open', () => {
            console.log("[WSS] Connection established successfully! Monitoring mempool...");
            
            this.wsProvider!.on('pending', this.handlePendingTransaction.bind(this));
        });

        this.wsProvider.on('error', (error: Error) => {
            console.error("[WSS] Provider Event Error:", error.message);
        });
        
        // The old, conflicting code is GONE.
    }

    private handlePendingTransaction(txHash: string): void {
        // Logic for fetching, simulating, and bundling transactions goes here.
    }

    public async startMonitoring(): Promise<void> {
        console.log("[STATUS] Monitoring started...");
        try {
            const balance = await this.httpProvider.getBalance(this.config.walletAddress);
            const formattedBalance = ethers.utils.formatEther(balance);
            console.log(`[BALANCE] Current ETH Balance: ${formattedBalance} ETH`);

            if (balance.lt(ethers.utils.parseEther(this.config.minEthBalance.toString()))) {
                console.error(`[FATAL] Balance (${formattedBalance}) is below MIN_ETH_BALANCE (${this.config.minEthBalance}). Shutting down.`);
                return;
            }
        } catch (error) {
            console.error("[FATAL] Could not check balance. Check HTTP_RPC_URL.");
            return;
        }

        if (!this.wsProvider) {
            console.warn("WSS Provider is not active. Cannot monitor mempool in real-time. Execution is halted.");
            return;
        }
    }
}

// --- Bot Startup ---
async function main() {
    try {
        console.log("[STEP 2] Initializing and Starting MEV Bot...");
        const bot = new MEVBot();
        await bot.startMonitoring();
    } catch (error: any) {
        // Catches the Fatal startup error if config is missing 
        console.error(`[ERROR] Fatal startup failure:`);
        console.error(`[ERROR] Details: ${error.message}`);
        process.exit(1);
    }
}

main();
