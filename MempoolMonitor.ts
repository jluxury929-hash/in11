// MempoolMonitor.ts (IN ROOT DIRECTORY)

// CORRECT V5/V6 compatible imports
import { WebSocketProvider, JsonRpcProvider } from '@ethersproject/providers'; // Explicit provider import
import { Interface } from '@ethersproject/abi'; // Explicit Interface import
import { formatEther } from '@ethersproject/units'; // Explicit utility import
import logger from './logger';
// ... other imports
import { config } from './config';
import { RawMEVOpportunity } from './types';

export class MempoolMonitor {
    private wssProvider: WebSocketProvider;
    private uniswapRouterAddress: string;
    private minTradeValueEth: number;
    private uniswapInterface: Interface;

    // ... constructor and start methods ...

    async start(opportunityCallback: (opp: RawMEVOpportunity) => Promise<void>): Promise<void> {
        logger.info(`Starting mempool monitoring on ${this.uniswapRouterAddress}`);

        this.wssProvider.on('pending', async (txHash: string) => {
            const tx = await this.wssProvider.getTransaction(txHash);

            if (tx && tx.to && tx.to.toLowerCase() === this.uniswapRouterAddress.toLowerCase()) {
                
                const valueEth = parseFloat(formatEther(tx.value));
                
                if (valueEth >= this.minTradeValueEth) {
                    // FIX TS2820: Change "Sandwich" to the correct lowercase type 'sandwich'
                    const opportunity: RawMEVOpportunity = { type: 'sandwich', hash: tx.hash, valueEth }; 
                    await opportunityCallback(opportunity);
                }
            }
        });
    }

    // ... rest of the class
    async stop(): Promise<void> {
        this.wssProvider.removeAllListeners();
        logger.info('Mempool monitoring stopped.');
    }
}
