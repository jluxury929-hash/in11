// src/engine/FlashbotsMEVExecutor.ts

import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from '../utils/logger'; // Corrected path
import { NonceManager } from './NonceManager'; // Corrected path (sibling file)
import { RawMEVOpportunity } from '../types'; // Corrected path

export class FlashbotsMEVExecutor {
    // Declared properties
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private flashbotsProvider: FlashbotsBundleProvider | null = null;
    private nonceManager: NonceManager;
    private uniswapRouter: string;

    // Corrected constructor syntax
    constructor(
        rpcUrl: string,
        privateKey: string,
        flashbotsSignerKey: string, // Not used directly here, but necessary for constructor
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

            const bundle = [
                // Transactions defined here
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
                { signedTransaction: opportunity.targetTxRaw },
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

            // FIX for TS2339: Check for error before calling .wait()
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
