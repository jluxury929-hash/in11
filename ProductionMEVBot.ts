// src/engine/ProductionMEVBot.ts

import { ethers } from 'ethers'; // 🚨 FIX: Missing import
import { apiServer } from '../api/APIServer'; // 🚨 FIX: Missing import
import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor'; // Corrected path
import { MempoolMonitor } from './MempoolMonitor'; // Corrected path
import logger from '../utils/logger'; // Corrected path
import { config } from '../config'; // 🚨 FIX: Missing import
import { RawMEVOpportunity } from '../types'; // 🚨 FIX: Missing import

class ProductionMEVBot {
    // 🚨 FIX: Declare all properties being used
    private httpProvider: ethers.JsonRpcProvider | null = null;
    private wallet: ethers.Wallet | null = null;
    private executor: FlashbotsMEVExecutor | null = null;
    private mempool: MempoolMonitor | null = null;
    private isRunning: boolean = false;

    // 🚨 FIX: Constructor needs to exist, even if empty
    constructor() {} 

    // CRITICAL: This method performs all heavy, blocking initialization.
    async initialize(): Promise<void> {
        try {
            // NOTE: Using JsonRpcProvider here, assuming it's faster than WebSocketProvider for initial connection
            this.httpProvider = new ethers.JsonRpcProvider(config.ethereum.rpcHttp);
            
            // Check initial connection by fetching chainId (optional but good practice)
            await this.httpProvider.getNetwork();
            logger.info('Successful connection to RPC provider.');

            if (config.wallet.privateKey) {
                // Initialize wallet with the provider
                this.wallet = new ethers.Wallet(config.wallet.privateKey, this.httpProvider);
                logger.info(`Wallet Address: ${this.wallet.address}`);

                if (config.flashbots.relaySignerKey && config.mev.helperContract) {
                    this.executor = new FlashbotsMEVExecutor(
                        config.ethereum.rpcHttp,
                        config.wallet.privateKey,
                        config.flashbots.relaySignerKey,
                        config.mev.helperContract,
                        config.mev.uniswapRouter,
                        config.mev.wethAddress
                    );
                    await this.executor.initialize();
                    
                    // Initialize MempoolMonitor separately
                    this.mempool = new MempoolMonitor(
                        config.ethereum.rpcWss,
                        config.mev.uniswapRouter,
                        config.trading.minTradeValueEth
                    );
                } else {
                    logger.warn('Flashbots or Helper Contract missing. Trading is disabled.');
                }
            } else {
                logger.warn('No wallet configured. Trading disabled.');
            }
        } catch (error: any) {
            logger.error('Initialization error (CRITICAL - check RPC/Keys):', error);
            throw error; // Throw to trigger process exit in index.ts
        }
    }

    // NEW METHOD: Separated the monitoring loop from initialization
    async startMempoolMonitoring(): Promise<void> {
        if (!this.wallet || !this.httpProvider || !this.mempool || !this.executor) {
             logger.warn('MEV Bot setup incomplete. Monitoring loop cannot start.');
             return;
        }

        this.isRunning = true;
        
        await this.checkBalance();
        setInterval(() => this.checkBalance(), config.trading.checkBalanceInterval);

        await this.mempool.start(async (opp: RawMEVOpportunity) => {
            logger.info(`MEV Opportunity: ${opp.type}`);
            if (this.executor) {
                const success = await this.executor.executeSandwich(opp);
                if (success) {
                    logger.info('PROFIT!');
                    await this.withdrawProfits();
                }
            }
        });

        setInterval(() => {
            if (this.executor) this.executor.periodicResync();
        }, 30000);
    }
    
    // ... (checkBalance, withdrawProfits, stop methods remain the same) ...

    async checkBalance(): Promise<boolean> {
        if (!this.wallet || !this.httpProvider) return false;
        try {
            const balance = await this.httpProvider.getBalance(this.wallet.address);
            const balanceEth = parseFloat(ethers.formatEther(balance));
            logger.info(`Balance: ${balanceEth.toFixed(6)} ETH`);
            return balanceEth >= config.wallet.minEthBalance;
        } catch (error: any) {
            logger.error('Balance check failed:', error.message);
            return false;
        }
    }

    async withdrawProfits(): Promise<void> {
        // ... (original implementation) ...
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;
        logger.info('Stopping...');
        if (this.mempool) await this.mempool.stop();
        apiServer.stop();
        if (this.httpProvider) (this.httpProvider as any).destroy(); // destroy method cleanup
        this.isRunning = false;
        logger.info('Stopped');
    }
}

export { ProductionMEVBot };
