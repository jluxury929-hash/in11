// FlashbotsMEVExecutor.ts (IN ROOT DIRECTORY)

import { Wallet } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers'; // FIX: Ethers v5 provider import
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from './logger';
import { NonceManager } from './NonceManager';
import { RawMEVOpportunity } from './types';
import { config } from './config'; 

export class FlashbotsMEVExecutor {
    private provider: JsonRpcProvider;
    private wallet: Wallet;
    private flashbotsProvider: FlashbotsBundleProvider | null = null;
    private nonceManager: NonceManager;
    private uniswapRouter: string;

    constructor(
        rpcUrl: string,
        privateKey: string,
        helperContract: string,
        uniswapRouter: string,
        wethAddress: string
    ) {
        this.provider = new JsonRpcProvider(rpcUrl); 
        this.wallet = new Wallet(privateKey, this.provider);
        this.uniswapRouter = uniswapRouter;
        this.nonceManager = new NonceManager(this.provider, this.wallet.address);
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Flashbots executor...');
        try {
            const authSigner = new Wallet(
                config.flashbots.relaySignerKey,
                this.provider 
            );

            // FIX: Correct parameter sequence for Flashbots initialization
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider,                 // 1. Standard Ethers Provider
                authSigner,                    // 2. Flashbots Auth Signer
                config.flashbots.relayUrl      // 3. Flashbots Relay URL
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
            // Placeholder for bundle creation
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
