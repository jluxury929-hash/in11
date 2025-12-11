import * as dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { apiServer } from './server/apiServer';
import { FlashbotsMEVExecutor } from './mev/flashbots';
import { MempoolMonitor } from './mev/mempool';
import logger from './utils/logger';
import { config } from './config';
import { RawMEVOpportunity } from './types';

class ProductionMEVBot {
    private httpProvider: ethers.JsonRpcProvider | null = null;
    private wallet: ethers.Wallet | null = null;
    private executor: FlashbotsMEVExecutor | null = null;
    private mempool: MempoolMonitor | null = null;
    private isRunning: boolean = false;

    async initialize(): Promise<void> {
        try {
            this.httpProvider = new ethers.JsonRpcProvider(config.ethereum.rpcHttp);
            
            if (config.wallet.privateKey) {
                this.wallet = new ethers.Wallet(config.wallet.privateKey, this.httpProvider);
                logger.info(`Wallet initialized: ${this.wallet.address}`);

                // Initialize MEV components if configured
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

                    this.mempool = new MempoolMonitor(
                        config.ethereum.rpcWss,
                        config.mev.uniswapRouter,
                        config.trading.minTradeValueEth
                    );
                }
            } else {
                logger.warn('No wallet configured - trading features disabled');
            }

        } catch (error: any) {
            logger.error('Initialization error:', error);
            throw error;
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Bot is already running');
            return;
        }

        logger.info('='.repeat(70));
        logger.info('  MASSIVE TRADING ENGINE - STARTING');
        logger.info('='.repeat(70));
        logger.info(`Environment: ${config.server.environment}`);
        logger.info(`Port: ${config.server.port}`);

        try {
            await this.initialize();

            await apiServer.start();

            if (this.wallet && this.httpProvider) {
                await this.checkBalance();
                
                setInterval(async () => {
                    await this.checkBalance();
                }, config.trading.checkBalanceInterval);
            }

            // Start mempool monitoring if available
            if (this.mempool && this.executor) {
                await this.mempool.start(async (opportunity: RawMEVOpportunity) => {
                    logger.info('MEV OPPORTUNITY DETECTED');
                    logger.info(`Type: ${opportunity.type}`);
                    logger.info(`Target: ${opportunity.targetTxHash.slice(0, 10)}...`);
                    logger.info(`Amount: ${ethers.formatEther(opportunity.amountIn)} ETH`);
                    logger.info(`Est. Profit: ${opportunity.estimatedProfitEth} ETH`);

                    if (this.executor) {
                        const success = await this.executor.executeSandwich(opportunity);
                        if (success) {
                            logger.info('PROFIT CAPTURED!');
                            await this.withdrawProfits();
                        }
                    }
                });

                setInterval(async () => {
                    if (this.executor) {
                        await this.executor.periodicResync();
                    }
                }, 30000);
            }

            this.isRunning = true;
            logger.info('Bot fully operational');

        } catch (error: any) {
            logger.error('Failed to start bot:', error);
            throw error;
        }
    }

    async checkBalance(): Promise<boolean> {
        if (!this.wallet || !this.httpProvider) {
            return false;
        }

        try {
            const balance = await this.httpProvider.getBalance(this.wallet.address);
            const balanceEth = parseFloat(ethers.formatEther(balance));

            logger.info(`Wallet Balance: ${balanceEth.toFixed(6)} ETH`);

            if (balanceEth >= config.wallet.minEthBalance) {
                return true;
            }

            logger.warn(`Balance below minimum: ${config.wallet.minEthBalance} ETH required`);
            return false;

        } catch (error: any) {
            logger.error('Error checking balance:', error.message);
            return false;
        }
    }

    async withdrawProfits(): Promise<void> {
        if (!config.wallet.profitAddress || !this.wallet || !this.httpProvider) {
            return;
        }

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
                logger.info(`Withdrawal complete: ${tx.hash}`);
            }
        } catch (error: any) {
            logger.error('Withdrawal failed:', error);
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;

        logger.info('Stopping bot gracefully...');
        
        if (this.mempool) {
            await this.mempool.stop();
        }

        apiServer.stop();
        
        if (this.httpProvider) {
            this.httpProvider.destroy();
        }

        this.isRunning = false;
        logger.info('Bot stoppe
