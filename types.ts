// types.ts (IN ROOT DIRECTORY)

import { TransactionResponse } from '@ethersproject/providers'; // FIX: Ethers v5 type import

export type MEVOpportunityType = 'sandwich' | 'arbitrage' | 'liquidation';

export interface RawMEVOpportunity {
    type: MEVOpportunityType;
    hash: string; // FIX: Added missing 'hash' property
    valueEth: number;
    // ... other properties
}

export interface BundledTransaction {
    signedTransaction: string;
    // transaction: TransactionResponse; 
}
