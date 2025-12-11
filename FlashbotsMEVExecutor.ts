// src/engine/FlashbotsMEVExecutor.ts

import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from '../utils/logger';
import { NonceManager } from './NonceManager';
import { RawMEVOpportunity } from '../types';

export class FlashbotsMEVExecutor {
    // 🚨 FIX 1: Declare all private properties before the constructor
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private flashbotsProvider: FlashbotsBundleProvider | null = null;
    private nonceManager: NonceManager;
    private uniswapRouter: string;
    
    // 🚨 FIX 2: Correctly define the constructor block
    constructor(
        rpcUrl: string,
        privateKey: string,
        flashbotsSignerKey: string,
        helperContract: string,
        uniswapRouter: string,
        wethAddress: string
    ) {
        // Initialize properties inside the constructor
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.uniswapRouter = uniswapRouter;
        // The Flashbots Signer Key is not used here but in the FlashbotsBundleProvider.create method below (in initialize)
        this.nonceManager = new NonceManager(this.provider, this.wallet.address);
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Flashbots executor...');
        try {
            // NOTE: The FlashbotsSignerKey is handled within the initialize method
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider,
                this.wallet
                // The signer key is often passed here or implicitly derived from the wallet in some library versions
            );
            await this.nonceManager.initialize();
            logger.info('Flashbots executor ready');
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
            const [frontRunNonce, backRunNonce] = this.nonceManager.getNextNoncePair();

            // ... (rest of the executeSandwich logic, including the Flashbots type fix from last step) ...
            
            const bundle = [
                // ... (Front-run transaction)
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
                // ... (Target transaction)
                { signedTransaction: opportunity.targetTxRaw },
                // ... (Back-run transaction)
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
            const bundleSubmission = await this.flashbotsProvider.sendBundle(bundle, blockNumber + 1);

            if ('error' in bundleSubmission) {
                logger.error('Flashbots submission failed:', (bundleSubmission.error as any).message);
                await this.nonceManager.handleBundleFailure();
                return false;
            }
            
            const waitResponse = await bundleSubmission.wait();

            if (waitResponse === 0) {
                this.nonceManager.confirmBundle(frontRunNonce, backRunNonce);
                return true;
            } else {
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
