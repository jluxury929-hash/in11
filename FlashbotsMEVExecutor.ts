// FlashbotsMEVExecutor.ts (IN ROOT DIRECTORY)

import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from './logger';
import { NonceManager } from './NonceManager';
import { RawMEVOpportunity } from './types';
import { config } from './config'; // Make sure config is imported

export class FlashbotsMEVExecutor {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private flashbotsProvider: FlashbotsBundleProvider | null = null;
    private nonceManager: NonceManager;
    private uniswapRouter: string;

    constructor(
        rpcUrl: string,
        privateKey: string,
        flashbotsSignerKey: string,
        helperContract: string,
        uniswapRouter: string,
        wethAddress: string
    ) {
        // Initializes the standard Ethers Provider
        this.provider = new ethers.JsonRpcProvider(rpcUrl); 
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.uniswapRouter = uniswapRouter;
        this.nonceManager = new NonceManager(this.provider, this.wallet.address);
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Flashbots executor...');
        try {
            // 1. Create the dedicated signer for Flashbots (using the main provider for context)
            const authSigner = new ethers.Wallet(
                config.flashbots.relaySignerKey,
                this.provider
            );

            // 2. CRITICAL FIX: The first argument MUST be the standard Ethers Provider (this.provider).
            // The third argument is the Flashbots URL (config.flashbots.relayUrl).
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider, // <-- Standard Ethers Provider (e.g., Infura/Alchemy)
                authSigner,   // <-- Flashbots Auth Signer
                config.flashbots.relayUrl // <-- Flashbots Relay URL (https://relay.flashbots.net)
            );
            
            await this.nonceManager.initialize();
            logger.info('Flashbots executor ready'); // <-- SUCCESS LOG GOES HERE

        } catch (error: any) {
            logger.error('Flashbots initialization failed:', error);
            throw error;
        }
    }

    // ... (rest of the class methods remain unchanged)

    async executeSandwich(opportunity: RawMEVOpportunity): Promise<boolean> {
        if (!this.flashbotsProvider) {
            logger.error('Flashbots provider not initialized');
            return false;
        }

        try {
            const [frontRunNonce, backRunNonce] = this.nonceManager.getNextNoncePair();

            // NOTE: Full bundle definition omitted for brevity, assuming existing logic here
            const bundle = []; 

            const blockNumber = await this.provider.getBlockNumber();
            const bundleSubmission = await this.flashbotsProvider.sendBundle(bundle, blockNumber + 1);

            // CRITICAL FIX: Ensures the TS2339 'wait' error is resolved
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
