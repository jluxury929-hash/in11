// MempoolMonitor.ts (IN ROOT DIRECTORY - Logic assumed based on context)

import { WebSocketProvider } from '@ethersproject/providers'; // FIX: Ethers v5 provider import
import { Interface } from '@ethersproject/abi'; // FIX: Ethers v5 ABI import
import { formatEther } from '@ethersproject/units'; // FIX: Ethers v5 utility import
import logger from './logger';
import { RawMEVOpportunity } from './types';

// Assuming ABI is defined elsewhere
// const UNISWAP_ABI: any[] = [...];

export class MempoolMonitor {
    private wssProvider: WebSocketProvider;
    private uniswapRouterAddress: string;
    private minTradeValueEth: number;
    // private uniswapInterface: Interface; // If Interface isn't used, you can remove it.

    constructor(wssUrl: string, uniswapRouter: string, minTradeValueEth: number) {
        this.wssProvider = new WebSocketProvider(wssUrl);
        this.uniswapRouterAddress = uniswapRouter;
        this.minTradeValueEth = minTradeValueEth;
        // this.uniswapInterface = new Interface(UNISWAP_ABI); 
    }
    
    async start(opportunityCallback: (opp: RawMEVOpportunity) => Promise<void>): Promise<void> {
        logger.info(`Starting mempool monitoring on ${this.uniswapRouterAddress}`);

        this.wssProvider.on('pending', async (txHash: string) => {
            const tx = await this.wssProvider.getTransaction(txHash);

            if (tx && tx.to && tx.to.toLowerCase() === this.uniswapRouterAddress.toLowerCase()) {
                
                // Using imported utility
                const valueEth = parseFloat(formatEther(tx.value));
                
                if (valueEth >= this.minTradeValueEth) {
                    // FIX: Using correct lowercase type 'sandwich' and required 'hash'
                    const opportunity: RawMEVOpportunity = { type: 'sandwich', hash: tx.hash, valueEth }; 
                    await opportunityCallback(opportunity);
                }
            }
        });
    }

    async stop(): Promise<void> {
        this.wssProvider.removeAllListeners();
        logger.info('Mempool monitoring stopped.');
    }
}
