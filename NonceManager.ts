// NonceManager.ts (IN ROOT DIRECTORY)

import { Wallet, JsonRpcProvider } from 'ethers';
import logger from './logger';
// ... other imports

export class NonceManager {
    private provider: JsonRpcProvider; // Use imported class
    private walletAddress: string;
    private currentNonce: number = 0;
    
    constructor(provider: JsonRpcProvider, walletAddress: string) { // Use imported class
        this.provider = provider;
        this.walletAddress = walletAddress;
    }

    async initialize(): Promise<void> {
        this.currentNonce = await this.provider.getTransactionCount(this.walletAddress, 'latest');
        logger.info(`Initialized nonce to ${this.currentNonce}`);
    }
    
    // ... rest of the class
    getNextNoncePair(): [number, number] {
        const pair: [number, number] = [this.currentNonce, this.currentNonce + 1];
        return pair;
    }

    confirmBundle(frontRunNonce: number, backRunNonce: number) {
        // Confirm successful execution moves the nonce forward by 2
        this.currentNonce = backRunNonce + 1; 
        logger.info(`Nonce confirmed, next nonce is ${this.currentNonce}`);
    }

    async handleBundleFailure() {
        // On failure, resync immediately to ensure nonce is correct
        await this.resyncIfNeeded();
    }

    async resyncIfNeeded(): Promise<void> {
        const latestNonce = await this.provider.getTransactionCount(this.walletAddress, 'latest');
        if (latestNonce > this.currentNonce) {
            logger.warn(`Nonce mismatch detected. Resyncing from ${this.currentNonce} to ${latestNonce}`);
            this.currentNonce = latestNonce;
        }
    }
}
