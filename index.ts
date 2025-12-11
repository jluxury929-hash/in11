import { ethers } from 'ethers';

export interface RawMEVOpportunity {
    type: 'sandwich' | 'arbitrage' | 'liquidation';
    targetTxHash: string;
    targetTxRaw: string;
    targetTxParsed: ethers.TransactionResponse;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    estimatedProfitEth: string;
}

export interface BundleResult {
    success: boolean;
    bundleHash?: string;
    profit?: string;
    error?: string;
}

export interface WalletBalance {
    address: string;
    eth: string;
    tokens: Record<string, string>;
}

