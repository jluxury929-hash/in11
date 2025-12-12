// src/FlashbotsMEVExecutor.ts

import { 
    FlashbotsBundleProvider, 
    TransactionBundle
} from '@flashbots/ethers-provider-bundle';
import { 
    ethers, 
    Wallet,
    providers
} from 'ethers';

import { logger } from './logger.js'; // FIX: .js extension

// This is a minimal wrapper class for Flashbots integration
export class FlashbotsMEVExecutor {
    private constructor(
        private provider: providers.JsonRpcProvider,
        private flashbotsProvider: FlashbotsBundleProvider
    ) {}

    static async create(
        privateKey: string, 
        authSignerKey: string,
        rpcUrl: string,
        flashbotsUrl: string
    ): Promise<FlashbotsMEVExecutor> {
        const provider = new providers.JsonRpcProvider(rpcUrl);
        const authSigner = new Wallet(authSignerKey);

        const flashbotsProvider = await FlashbotsBundleProvider.create(
            provider,
            authSigner,
            flashbotsUrl
        );

        return new FlashbotsMEVExecutor(provider, flashbotsProvider);
    }

    // The 'any' assertion is often needed due to Flashbots library type conflicts
    async sendBundle(
        bundle: TransactionBundle, 
        blockNumber: number
    ): Promise<void> {
        logger.info(`[Flashbots] Submitting bundle for block ${blockNumber}...`);
        
        try {
            const result = await this.flashbotsProvider.sendBundle(bundle, blockNumber);

            if ('error' in result) {
                logger.error(`[Flashbots] Bundle submission failed: ${result.error.message}`);
                return;
            }

            logger.info(`[Flashbots] Bundle sent. Awaiting receipt...`);
            
            // Wait for the block to be included (or timed out)
            const waitResponse = await result.wait();
            
            if (waitResponse === 0) {
                logger.warn(`[Flashbots] Bundle was not included in block ${blockNumber}.`);
            } else {
                logger.success(`[Flashbots] Bundle successfully included in block ${blockNumber}!`);
            }

        } catch (error) {
            logger.error(`[Flashbots] Submission error.`, error);
        }
    }
}
