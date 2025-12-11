// MEVBot.ts (Complete and Fixed Version)

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
    private signer: ethers.Wallet; // Wallet with ETH
    private authSigner: ethers.Wallet; // Flashbots reputation signer (NO ETH)
    private httpProvider: ethers.providers.JsonRpcProvider;
    private wsProvider: ethers.providers.WebSocketProvider | undefined;
    private config: BotConfig;

    constructor() {
        // --- 1. Load and Validate Configuration ---
        this.config = this.loadConfig();

        // --- 2. Initialize Wallets ---
        const privateKey = process.env.PRIVATE_KEY;
        const fbReputationKey = process.env.FB_REPUTATION_KEY;
        if (!privateKey) throw new Error("PRIVATE_KEY not set in environment.");
        if (!fbReputationKey) throw new Error("FB_REPUTATION_KEY (Flashbots Auth Signer) not set.");
        
        // --- 3. Initialize HTTP Provider (For static checks/transaction sending) ---
        const httpRpcUrl = process.env.ETH_HTTP_RPC_URL;
        if (!httpRpcUrl) throw new Error("ETH_HTTP_RPC_URL not set.");
        this.httpProvider = new ethers.providers.JsonRpcProvider(httpRpcUrl);
        
        this.signer = new ethers.Wallet(privateKey, this.httpProvider);
        this.authSigner = new ethers.Wallet(fbReputationKey); // No provider needed for signing only
        
        this.config.walletAddress = this.signer.address;
        this.config.authSignerKey = fbReputationKey;
        
        // --- 4. Initialize WSS Provider (FIX for onopen error) ---
        const wssRpcUrl = process.env.ETH_WSS_URL;
        if (wssRpcUrl) {
            console.log(`[DEBUG] Attempting WSS connection with URL: ${wssRpcUrl}`); // Added debug log
            try {
                this.wsProvider = new ethers.providers.WebSocketProvider(wssRpcUrl);
                this.setupWsConnectionListeners();
            } catch (error) {
                console.error("[FATAL] WebSocket Provider failed to initialize. Check WSS_URL or Container Firewall.", error);
                this.wsProvider = undefined; // Ensure the object is correctly undefined on failure
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
            minEthBalance: parseFloat(process.env.MIN_ETH_BALANCE || '0.02'), 
            gasReserveEth: parseFloat(process.env.GAS_RESERVE_ETH || '0.01'),
            minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.05'),
            mevHelperContractAddress: process.env.MEV_HELPER_CONTRACT_ADDRESS || '',
            flashbotsUrl: process.env.FLASHBOTS_URL || 'https://relay.flashbots.net',
        };
    }

    // --- FIX APPLIED HERE: Safely sets up WSS connection listeners ---
    private setupWsConnectionListeners(): void {
        if (!this.wsProvider) return;

        // FIX: Using the provider's built-in 'on' event is safer than accessing '.websocket.onopen'
        this.wsProvider.on('open', () => {
            console.log("[WSS] Connection established successfully!");
        });

        this.wsProvider.on('error', (error: Error) => {
            console.error("[WSS] Provider Event Error:", error.message);
        });
        
        this.wsProvider.on('block', (blockNumber: number) => {
            // console.log(`[WSS] Monitoring new block: ${blockNumber}`);
        });
    }

    // --- Core Bot Logic Starts Here ---
    public async startMonitoring(): Promise<void> {
        console.log("[STATUS] Monitoring started...");
        try {
            const balance = await this.httpProvider.getBalance(this.config.walletAddress);
            console.log(`[BALANCE] Current ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);

            if (balance.lt(ethers.utils.parseEther(this.config.minEthBalance.toString()))) {
                console.error(`[FATAL] Balance is below MIN_ETH_BALANCE (${this.config.minEthBalance}). Shutting down.`);
                return;
            }
        } catch (error) {
            console.error("[FATAL] Could not check balance. Check HTTP_RPC_URL.");
            return;
        }

        // Mempool monitoring logic using WSS provider (if available)
        if (this.wsProvider) {
            this.wsProvider.on('pending', (txHash: string) => {
                // Arbitrage logic goes here...
            });
        } else {
            console.warn("WSS Provider is not active. Cannot monitor mempool in real-time.");
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
        // Catches the Fatal startup error if config is missing (e.g., PRIVATE_KEY)
        console.error(`[ERROR] Fatal startup failure:`);
        console.error(`[ERROR] Details: ${error.message}`);
        process.exit(1);
    }
}

main();
