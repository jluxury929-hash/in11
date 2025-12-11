// NonceManager.ts
import { ethers } from 'ethers'; 
import { logger } from './logger'; // FIX: TS2613 corrected to named import

export class NonceManager {
    private provider: ethers.providers.JsonRpcProvider;
    private walletAddress: string;
    private currentNonce: number = 0;

    constructor(provider: ethers.providers.JsonRpcProvider, walletAddress: string) {
        this.provider = provider;
        this.walletAddress = walletAddress;
        this.fetchNonce();
    }

    private async fetchNonce() {
        try {
            this.currentNonce = await this.provider.getTransactionCount(this.walletAddress, 'latest');
            logger.debug(`Initial Nonce set to: ${this.currentNonce}`);
        } catch (error) {
            logger.error("Failed to fetch initial nonce.", error);
        }
    }

    public getNonce(): number {
        return this.currentNonce;
    }

    public incrementNonce(): number {
        this.currentNonce += 1;
        logger.debug(`Nonce incremented to: ${this.currentNonce}`);
        return this.currentNonce;
    }
}
