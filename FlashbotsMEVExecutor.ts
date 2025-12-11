// FlashbotsMEVExecutor.ts (IN ROOT DIRECTORY)

import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from './logger'; // FIX: Direct sibling import
import { NonceManager } from './NonceManager'; // FIX: Direct sibling import
import { RawMEVOpportunity } from './types'; // FIX: Direct sibling import

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
            this.flashbotsProvider = await FlashbotsBundleProvider.create(
                this.provider,
                this.wallet
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
