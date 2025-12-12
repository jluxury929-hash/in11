// src/MempoolMonitor.ts
import { ethers, providers } from 'ethers';
import { logger } from './logger.js'; // FIX: .js extension

// NOTE: This class is often integrated directly into ProductionMEVBot (as we did previously),
// but here is the corrected file if it is used separately.

export class MempoolMonitor {
    private provider: providers.WebSocketProvider;

    constructor(wssUrl: string) {
        this.provider = new providers.WebSocketProvider(wssUrl);
        this.setupListeners();
    }

    private setupListeners(): void {
        this.provider.on('pending', (txHash: string) => {
            // In a real application, this would pipe the hash to the worker pool manager
            logger.debug(`[MONITOR] Received pending transaction hash: ${txHash.substring(0, 10)}...`);
        });

        this.provider.on('error', (error) => {
            logger.error(`[MONITOR] Provider error: ${error.message}`);
        });

        this.provider.on('open', () => {
            logger.info("[MONITOR] WebSocket connection open and monitoring.");
        });
    }

    public stop(): void {
        this.provider.removeAllListeners();
        // Use destroy for clean socket termination
        if (typeof (this.provider as any).destroy === 'function') {
            (this.provider as any).destroy(); 
        }
        logger.info("[MONITOR] Monitoring stopped.");
    }
}
