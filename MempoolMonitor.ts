// MempoolMonitor.ts
import { ethers } from 'ethers'; // FIX: Import global ethers for v5 syntax
import { logger } from './logger';

export class MempoolMonitor {
    // FIX: Use Ethers v5 provider type
    private wsProvider: ethers.providers.WebSocketProvider; 
    private pendingTxHandler: (txHash: string) => void;

    // FIX: Constructor uses Ethers v5 provider type
    constructor(wsProvider: ethers.providers.WebSocketProvider, handler: (txHash: string) => void) {
        this.wsProvider = wsProvider;
        this.pendingTxHandler = handler;
        this.startMonitoring();
    }

    private startMonitoring() {
        this.wsProvider.on('pending', this.pendingTxHandler);
        logger.info("Mempool monitoring active.");
    }

    public stopMonitoring() {
        this.wsProvider.off('pending', this.pendingTxHandler);
        logger.warn("Mempool monitoring stopped.");
    }
}
