import { ethers } from 'ethers';
import logger from './logger';

export class NonceManager {
    private provider: ethers.JsonRpcProvider;
    private address: string;
    private currentNonce: number;
    private pendingNonces: Set<number>;

    constructor(provider: ethers.JsonRpcProvider, address: string) {
        this.provider = provider;
        this.address = address;
        this.currentNonce = 0;
        this.pendingNonces = new Set();
    }

    async initialize(): Promise<void> {
        const blockchainNonce = await this.provider.getTransactionCount(this.address, 'pending');
        this.currentNonce = blockchainNonce;
        this.pendingNonces.clear();
        logger.info(`NonceManager initialized - Starting nonce: ${this.currentNonce}`);
    }

    getNextNoncePair(): [number, number] {
        const frontRunNonce = this.currentNonce;
        const backRunNonce = this.currentNonce + 1;
        this.pendingNonces.add(frontRunNonce);
        this.pendingNonces.add(backRunNonce);
        this.currentNonce += 2;
        return [frontRunNonce, backRunNonce];
    }

    confirmBundle(frontRunNonce: number, backRunNonce: number): void {
        this.pendingNonces.delete(frontRunNonce);
        this.pendingNonces.delete(backRunNonce);
    }

    async handleBundleFailure(): Promise<void> {
        this.currentNonce = await this.provider.getTransactionCount(this.address, 'latest');
        this.pendingNonces.clear();
    }

    async resyncIfNeeded(): Promise<void> {
        if (this.pendingNonces.size > 10) {
            const blockchainNonce = await this.provider.getTransactionCount(this.address, 'pending');
            this.currentNonce = blockchainNonce;
            this.pendingNonces.clear();
        }
    }
}

