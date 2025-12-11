// MempoolMonitor.ts
import { WebSocketProvider } from 'ethers';
import { logger } from './logger';

export class MempoolMonitor {
    private wsProvider: WebSocketProvider;
    private pendingTxHandler: (txHash: string) => void;

    constructor(wsProvider: WebSocketProvider, handler: (txHash: string) => void) {
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
