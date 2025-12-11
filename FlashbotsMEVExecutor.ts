// src/engine/FlashbotsMEVExecutor.ts (Assuming this file is now under src/engine/)

import { ethers } from 'ethers'; // 🚨 FIX: Missing import
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import logger from '../utils/logger'; // Corrected path
import { NonceManager } from './NonceManager'; // Corrected path
import { RawMEVOpportunity } from '../types'; // Corrected path

// ... (constructor, initialize methods remain the same) ...

    async executeSandwich(opportunity: RawMEVOpportunity): Promise<boolean> {
        if (!this.flashbotsProvider) {
            logger.error('Flashbots provider not initialized');
            return false;
        }

        try {
            const [frontRunNonce, backRunNonce] = this.nonceManager.getNextNoncePair();

            // ... (bundle creation remains the same) ...

            const blockNumber = await this.provider.getBlockNumber();
            const bundleSubmission = await this.flashbotsProvider.sendBundle(bundle, blockNumber + 1);

            // 🚨 CRITICAL FIX: Check for error before calling .wait()
            if ('error' in bundleSubmission) {
                logger.error('Flashbots submission failed:', (bundleSubmission.error as any).message);
                await this.nonceManager.handleBundleFailure();
                return false;
            }

            const waitResponse = await bundleSubmission.wait();

            if (waitResponse === 0) { // Assuming 0 means inclusion
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

// ... (periodicResync remains the same) ...
