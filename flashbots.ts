import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from '../utils/logger';
import { NonceManager } from './nonceManager';
import { RawMEVOpportunity, BundleResult } from '../types';

export class FlashbotsMEVExecutor {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private flashbotsProvider: FlashbotsBundleProvider | null = null;
    private nonceManager: NonceManager;
    private helperContract: string;
    private uniswapRouter: string;

    constructor(
        rpcUrl: string,
        privateKey: string,
        flashbotsSignerKey: string,
        helperContract: string,
        uniswapRouter: string,
        wethAddress: string
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.helperContract = helperContract;
        this.uniswapRouter = uniswapRouter;
        this.nonceManager = new NonceManager(this.provider, this.wallet.address);
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Flashbots MEV Executor...');
        
        try {
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider,
                this.wallet
            );
            
            await this.nonceManager.initialize();
            
            logger.info('✓ Flashbots executor ready');
        } catch (error: any) {
            logger.error('Flashbots initialization failed:', error);
            throw error;
        }
    }

    async executeSandwich(opportunity: RawMEVOpportunity): Promise<boolean> {
        if (!this.flashbotsProvider) {
            logger.error('Flashbots provider not initialized');
            return false;
        }

        try {
            logger.info('Executing sandwich attack...');
            
            const [frontRunNonce, backRunNonce] = this.nonceManager.getNextNoncePair();
            
            // Create bundle transactions
            const bundle = [
                {
                    transaction: {
                        to: this.uniswapRouter,
                        data: '0x',
                        value: 0n,
                        gasLimit: 200000,
                        nonce: frontRunNonce
                    },
                    signer: this.wallet
                },
                {
                    signedTransaction: opportunity.targetTxRaw
                },
                {
                    transaction: {
                        to: this.uniswapRouter,
                        data: '0x',
                        value: 0n,
                        gasLimit: 200000,
                        nonce: backRunNonce
                    },
                    signer: this.wallet
                }
            ];

            const blockNumber = await this.provider.getBlockNumber();
            const targetBlock = blockNumber + 1;

            const bundleSubmission = await this.flashbotsProvider.sendBundle(bundle, targetBlock);
            
            logger.info(`Bundle submitted for block ${targetBlock}`);
            
            const waitResponse = await bundleSubmission.wait();
            
            if (waitResponse === 0) {
                logger.info('✓ Bundle included in block!');
                this.nonceManager.confirmBundle(frontRunNonce, backRunNonce);
                return true;
            } else {
                logger.warn('Bundle not included');
                await this.nonceManager.handleBundleFailure();
                return false;
            }

        } catch (error: any) {
            logger.error('Sandwich execution failed:', error);
            await this.nonceManager.handleBundleFailure();
            return false;
        }
    }

    async periodicResync(): Promise<void> {
        await this.nonceManager.resyncIfNeeded();
    }
}
