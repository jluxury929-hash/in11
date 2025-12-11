import { ethers } from 'ethers';
import logger from '../utils/logger';

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

        logger.info(`Allocated nonce pair: [${frontRunNonce}, ${backRunNonce}]`);
        return [frontRunNonce, backRunNonce];
    }

    confirmBundle(frontRunNonce: number, backRunNonce: number): void {
        this.pendingNonces.delete(frontRunNonce);
        this.pendingNonces.delete(backRunNonce);
        logger.info(`Confirmed nonces: [${frontRunNonce}, ${backRunNonce}]`);
    }

    async handleBundleFailure(): Promise<void> {
        logger.warn('Bundle failed - resyncing nonces');
        this.currentNonce = await this.provider.getTransactionCount(this.address, 'latest');
        this.pendingNonces.clear();
        logger.info(`Nonce resynced to: ${this.currentNonce}`);
    }

    async resyncIfNeeded(): Promise<void> {
        if (this.pendingNonces.size > 10) {
            logger.info('Periodic nonce resync triggered');
            const blockchainNonce = await this.provider.getTransactionCount(this.address, 'pending');
            this.currentNonce = blockchainNonce;
            this.pendingNonces.clear();
        }
    }

    getCurrentNonce(): number {
        return this.currentNonce;
    }

    getPendingCount(): number {
        return this.pendingNonces.size;
    }
}
