// ProductionMEVBot.ts (IN ROOT DIRECTORY)

import { ethers } from 'ethers'; 
import { apiServer } from './APIServer';
import { FlashbotsMEVExecutor } from './FlashbotsMEVExecutor';
import { MempoolMonitor } from './MempoolMonitor';
import logger from './logger';
import { config } from './config';
import { RawMEVOpportunity } from './types';

export class ProductionMEVBot {
    private httpProvider: ethers.JsonRpcProvider | null = null;
    private wallet: ethers.Wallet | null = null;
    private executor: FlashbotsMEVExecutor | null = null;
    private mempool: MempoolMonitor | null = null;
    private isRunning: boolean = false;

    constructor() {} 

    async initialize(): Promise<void> {
        try {
            this.httpProvider = new ethers.JsonRpcProvider(config.ethereum.rpcHttp);
            await this.httpProvider.getNetwork();
            logger.info('Successful connection to RPC provider.');

            if (config.wallet.privateKey) {
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
                    
                    // The fix is encapsulated within the executor's initialize method
                    await this.executor.initialize(); 
                    
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
            throw error; 
        }
    }

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
        
        logger.info('[STEP 3] Full system operational. Monitoring mempool...'); // Final Success Log
    }
    
    // ... (rest of checkBalance and withdrawProfits methods remain unchanged)

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
        if (!config.wallet.profitAddress || !this.wallet || !this.httpProvider) return;
        try {
            const balance = await this.httpProvider.getBalance(this.wallet.address);
            const balanceEth = parseFloat(ethers.formatEther(balance));
            const profitAmount = balanceEth - config.wallet.minEthBalance - config.wallet.gasReserveEth;

            if (profitAmount > 0.001) {
                logger.info(`Withdrawing ${profitAmount.toFixed(6)} ETH`);
                const tx = await this.wallet.sendTransaction({
                    to: config.wallet.profitAddress,
                    value: ethers.parseEther(profitAmount.toFixed(18))
                });
                await tx.wait();
                logger.info(`Withdrawal: ${tx.hash}`);
            }
        } catch (error: any) {
            logger.error('Withdrawal failed:', error);
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;
        logger.info('Stopping...');
        if (this.mempool) await this.mempool.stop();
        (apiServer as any).stop(); 
        if (this.httpProvider) (this.httpProvider as any).destroy();
        this.isRunning = false;
        logger.info('Stopped');
    }
}
