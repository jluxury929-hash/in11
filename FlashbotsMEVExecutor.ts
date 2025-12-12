// src/FlashbotsMEVExecutor.ts

import { 
    FlashbotsBundleProvider
    // NOTE: TransactionBundle is NOT exported by the library; it must be removed.
} from '@flashbots/ethers-provider-bundle'; 
import { 
    ethers, 
    Wallet,
    providers
} from 'ethers';

import { logger } from './logger.js';

// Define the required type structure for the bundle contents, resolving the TS2305 error.
type MevBundle = Array<{ signedTransaction: string } | { hash: string }>;


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

    // Use the custom MevBundle type alias
    async sendBundle(
        bundle: MevBundle, 
        blockNumber: number
    ): Promise<void> {
        logger.info(`[Flashbots] Submitting bundle for block ${blockNumber}...`);
        
        try {
            // Cast to 'any' for robustness, as Flashbots library typing can be inconsistent.
            const result = await this.flashbotsProvider.sendBundle(bundle as any, blockNumber);

            if ('error' in result) {
                logger.error(`[Flashbots] Bundle submission failed: ${result.error.message}`);
                return;
            }

            logger.info(`[Flashbots] Bundle sent. Awaiting receipt...`);
            
            const waitResponse = await result.wait();
            
            if (waitResponse === 0) {
                logger.warn(`[Flashbots] Bundle was not included in block ${blockNumber}.`);
            } else {
                // Ensure only existing logger methods (like info) are used.
                logger.info(`[Flashbots] Bundle successfully included in block ${blockNumber}!`);
            }

        } catch (error) {
            logger.error(`[Flashbots] Submission error.`, error);
        }
    }
}
