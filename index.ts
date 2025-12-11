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
                logger.info(`Wallet: ${this.wallet.address}`);

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
                logger.warn('No wallet - trading disabled');
            }
        } catch (error: any) {
            logger.error('Initialization error:', error);
            throw error;
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) return;

        logger.info('='.repeat(70));
        logger.info('  MASSIVE TRADING ENGINE');
        logger.info('='.repeat(70));

        try {
            await this.initialize();
            await apiServer.start();

            if (this.wallet && this.httpProvider) {
                await this.checkBalance();
                setInterval(() => this.checkBalance(), config.trading.checkBalanceInterval);
            }

            if (this.mempool && this.executor) {
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

            this.isRunning = true;
            logger.info('Bot operational');
        } catch (error: any) {
            logger.error('Startup failed:', error);
            throw error;
        }
    }

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
        apiServer.stop();
        if (this.httpProvider) this.httpProvider.destroy();
        this.isRunning = false;
        logger.info('Stopped');
    }
}

async function main() {
    const bot = new ProductionMEVBot();
    try {
        await bot.start();
        process.on('SIGINT', async () => {
            await bot.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await bot.stop();
            process.exit(0);
        });
    } catch (error: any) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
});

main();

