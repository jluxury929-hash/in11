// ProductionMEVBot.ts (COMPLETE)

import { 
    ethers, 
    Wallet,
    BigNumber
} from 'ethers';

import axios from 'axios'; 
import * as dotenv from 'dotenv';
import { logger } from './logger';
import { BotConfig } from './types'; 
import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor'; 

import { executeStrategyTask } from './WorkerPool'; 

// Global constants
const RECONNECT_DELAY_MS = 5000; 
const CHAIN_ID = 1; // 1 for Ethereum Mainnet

export class ProductionMEVBot { 
    private signer: Wallet; 
    private authSigner: Wallet; 
    private httpProvider: ethers.providers.JsonRpcProvider;
    private wsProvider: ethers.providers.WebSocketProvider | undefined;
    private executor: FlashbotsMEVExecutor | undefined;
    private config: BotConfig;
    private gasApiUrl: string;

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
             logger.warn("Missing critical RPC/Key environment variables.");
        }

        this.gasApiUrl = process.env.INFURA_GAS_API_URL || '';
        if (!this.gasApiUrl) {
            logger.error("INFURA_GAS_API_URL is missing. Cannot calculate competitive gas fees.");
        }
        
        this.httpProvider = new ethers.providers.JsonRpcProvider(httpRpcUrl || 'http://placeholder.local'); 
        this.signer = new Wallet(privateKey || ethers.constants.HashZero, this.httpProvider);
        this.authSigner = new Wallet(fbReputationKey || ethers.constants.HashZero); 
        this.config.walletAddress = this.signer.address;
        
        this.initializeWsProvider();
        logger.info("Bot configuration loaded.");
    }

    private initializeWsProvider(): void {
        const wssRpcUrl = process.env.ETH_WSS_URL;
        if (!wssRpcUrl) {
            this.wsProvider = undefined;
            return;
        }

        try {
            if (this.wsProvider) {
                this.wsProvider.removeAllListeners();
                // Check if destroy exists to safely close the socket
                if (typeof (this.wsProvider as any).destroy === 'function') {
                    (this.wsProvider as any).destroy(); 
                }
            }
            
            this.wsProvider = new ethers.providers.WebSocketProvider(wssRpcUrl); 
            this.setupWsConnectionListeners();
            
        } catch (error) {
            logger.error("WebSocket Provider failed to initialize.", error);
            this.wsProvider = undefined; 
        }
    }

    private reconnectWsProvider(): void {
        if (!process.env.ETH_WSS_URL) return;

        setTimeout(() => {
            logger.warn("[WSS] Retrying connection...");
            this.initializeWsProvider(); 
        }, RECONNECT_DELAY_MS);
    }

    private setupWsConnectionListeners(): void {
        if (!this.wsProvider) return;

        this.wsProvider.once('open', () => {
            logger.info("WSS Connection established successfully! Monitoring mempool...");
            this.wsProvider!.on('pending', this.handlePendingTransaction.bind(this));
        });

        this.wsProvider.on('error', (error: Error) => {
            logger.error(`[WSS] Provider Event Error: ${error.message}. Attempting reconnect...`);
            this.reconnectWsProvider();
        });

        this.wsProvider.on('close', (code: number, reason: string) => {
            this.wsProvider!.removeAllListeners('pending');
            logger.error(`[WSS] Connection Closed (Code: ${code}). Reason: ${reason}. Attempting reconnect...`);
            this.reconnectWsProvider();
        });
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

    private async getCompetitiveFees(): Promise<{ maxFeePerGas: BigNumber, maxPriorityFeePerGas: BigNumber } | null> {
        if (!this.gasApiUrl) return null;

        try {
            const url = `${this.gasApiUrl}/networks/${CHAIN_ID}/suggestedGasFees`;
            const response = await axios.get(url);
            
            const highPriority = response.data.high;

            const maxPriorityFeePerGas = ethers.utils.parseUnits(
                highPriority.suggestedMaxPriorityFeePerGas,
                'gwei'
            );

            const maxFeePerGas = ethers.utils.parseUnits(
                highPriority.suggestedMaxFeePerGas,
                'gwei'
            );
            
            return { maxFeePerGas, maxPriorityFeePerGas };

        } catch (error) {
            logger.error(`[GAS API CRASH] Failed to fetch gas fees from ${this.gasApiUrl}`, error);
            return null;
        }
    }


    private async handlePendingTransaction(txHash: string): Promise<void> {
        if (!this.executor) return; 

        try {
            logger.info(`[PENDING] Received hash: ${txHash.substring(0, 10)}... Submitting to worker pool...`);
            
            const pendingTx = await this.httpProvider.getTransaction(txHash);
            const fees = await this.getCompetitiveFees();
            
            if (!pendingTx || !pendingTx.to || !pendingTx.data || !fees) return;

            // Offload to worker pool
            const taskData = { 
                txHash, 
                pendingTx: { hash: pendingTx.hash, data: pendingTx.data, to: pendingTx.to, from: pendingTx.from }, 
                fees: { 
                    maxFeePerGas: fees.maxFeePerGas.toString(), 
                    maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString() 
                } 
            };
            
            const simulationResult = await executeStrategyTask(taskData);
            
            if (simulationResult && simulationResult.netProfit) {
                logger.info(`[PROFIT] Worker found profit! ${ethers.utils.formatEther(simulationResult.netProfit)} ETH via ${simulationResult.strategyId}`);

                const signedMevTx: string = simulationResult.signedTransaction as string; 

                const bundle = [ 
                    { signedTransaction: signedMevTx },
                    { hash: pendingTx.hash }
                ];

                await this.executor.sendBundle(bundle as any, await this.httpProvider.getBlockNumber() + 1);
                logger.info(`[SUBMITTED] Bundle for ${txHash.substring(0, 10)}...`);
            }
            
        } catch (error) {
            logger.error(`[RUNTIME CRASH] Failed to process transaction ${txHash}`, error);
        }
    }

    public async startMonitoring(): Promise<void> {
        logger.info("[STATUS] Starting bot services...");

        await this.initializeExecutor(); 
        if (!this.executor) {
            logger.fatal("Cannot start monitoring due to Executor failure. Check .env variables.");
            return;
        }

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

        if (!this.wsProvider) {
            logger.warn("WSS Provider is not active. Cannot monitor mempool in real-time.");
        } else {
            logger.info("[STATUS] Monitoring fully active.");
            
            setInterval(() => {
                logger.debug("[HEALTH CHECK] Bot process is alive.");
            }, 60000); 
        }
    }
}
