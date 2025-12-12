// src/NonceManager.ts
import { ethers, providers } from 'ethers';
import { logger } from './logger.js'; // FIX: .js extension

export class NonceManager {
    private address: string;
    private provider: providers.JsonRpcProvider;
    private currentNonce: number;

    constructor(address: string, provider: providers.JsonRpcProvider) {
        this.address = address;
        this.provider = provider;
        this.currentNonce = -1; // -1 indicates uninitialized
    }

    public async initialize(): Promise<void> {
        try {
            this.currentNonce = await this.provider.getTransactionCount(this.address, 'pending');
            logger.info(`[NONCE] Initialized nonce for ${this.address.substring(0, 10)}... to ${this.currentNonce}`);
        } catch (error) {
            logger.error(`[NONCE] Failed to initialize nonce for ${this.address}`, error);
        }
    }

    public getNonce(): number {
        if (this.currentNonce === -1) {
            logger.warn("[NONCE] Nonce accessed before initialization. This may lead to failed transactions.");
        }
        return this.currentNonce;
    }

    public incrementNonce(): void {
        this.currentNonce++;
        logger.debug(`[NONCE] Incremented to ${this.currentNonce}`);
    }

    // Optional: Reset nonce if a transaction fails dramatically
    public async resetNonce(): Promise<void> {
        await this.initialize();
    }
}
