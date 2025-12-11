// FlashbotsMEVExecutor.ts (IN ROOT DIRECTORY)

import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from './logger';
import { NonceManager } from './NonceManager';
import { RawMEVOpportunity } from './types';
import { config } from './config'; // Make sure config is imported to access relayUrl

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
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.uniswapRouter = uniswapRouter;
        this.nonceManager = new NonceManager(this.provider, this.wallet.address);
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Flashbots executor...');
        try {
            // 1. Create the dedicated signer for Flashbots (using the main provider)
            const authSigner = new ethers.Wallet(
                config.flashbots.relaySignerKey,
                this.provider // Use the standard RPC provider for this signer
            );

            // 2. CRITICAL FIX: Pass the standard provider, authSigner, and the specific Flashbots URL.
            // This ensures the library uses the standard provider for network info, but sends bundles to the relay.
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider, // <-- Standard Ethers Provider (Infura/Alchemy)
                authSigner,   // <-- Flashbots Auth Signer
                config.flashbots.relayUrl // <-- Flashbots Relay URL (https://relay.flashbots.net)
            );
            
            await this.nonceManager.initialize();
            logger.info('Flashbots executor ready');

        } catch (error: any) {
            logger.error('Flashbots initialization failed:', error);
            throw error;
        }
    }

    // ... (rest of executeSandwich and periodicResync methods remain unchanged)
    
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
