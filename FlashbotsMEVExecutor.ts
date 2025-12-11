// FlashbotsMEVExecutor.ts (IN ROOT DIRECTORY)

import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from './logger';
import { NonceManager } from './NonceManager';
import { RawMEVOpportunity } from './types';
import { config } from './config'; 

export class FlashbotsMEVExecutor {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private flashbotsProvider: FlashbotsBundleProvider | null = null;
    private nonceManager: NonceManager;
    private uniswapRouter: string;

    constructor(
        rpcUrl: string,
        privateKey: string,
        helperContract: string, // Removed Flashbots Signer Key from constructor
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
            // 1. Create the dedicated signer for Flashbots using the key from config
            const authSigner = new ethers.Wallet(
                config.flashbots.relaySignerKey,
                this.provider // Use the standard RPC provider for context
            );

            // 2. CRITICAL FIX: Correct parameter sequence for Flashbots initialization
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider,                 // <-- 1. Standard Ethers Provider (for network detection)
                authSigner,                    // <-- 2. Flashbots Auth Signer
                config.flashbots.relayUrl      // <-- 3. Flashbots Relay URL (https://relay.flashbots.net)
            );
            
            await this.nonceManager.initialize();
            logger.info('Flashbots executor ready.'); 

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
            const bundle = []; 
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
