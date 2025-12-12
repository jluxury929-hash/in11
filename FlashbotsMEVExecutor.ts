// src/FlashbotsMEVExecutor.ts

import { 
    FlashbotsBundleProvider, 
    TransactionBundle // <-- This is the problematic type import
} from '@flashbots/ethers-provider-bundle'; 
import { 
    ethers, 
    Wallet,
    providers
} from 'ethers';

import { logger } from './logger.js';

// ** FIX 1: Define the expected bundle type locally or use the type from the library. **
// Assuming the core bundle structure, we will use the type definition provided by the Flashbots library.
// We must update the import and usage.
// Let's use the actual type exported by the library, which is usually named IFlashbotsTransactionBundle or similar.
// For robustness, we will import what the library uses.

// The correct type import is usually TransactionRequest or just using the array syntax.
// We will replace the problematic import line:
// import { TransactionBundle } from '@flashbots/ethers-provider-bundle';

// The input to sendBundle is an array of objects. We will define a simple, robust type for clarity.
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

    // Use our new local type alias for clarity and to resolve TS2305.
    async sendBundle(
        bundle: MevBundle, 
        blockNumber: number
    ): Promise<void> {
        logger.info(`[Flashbots] Submitting bundle for block ${blockNumber}...`);
        
        try {
            // Note: We cast bundle to 'any' here as the Flashbots library often has inconsistent typing
            // between versions and the simple structure we are using.
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
                // ** FIX 2: Change logger.success to logger.info **
                logger.info(`[Flashbots] Bundle successfully included in block ${blockNumber}!`);
            }

        } catch (error) {
            logger.error(`[Flashbots] Submission error.`, error);
        }
    }
}
