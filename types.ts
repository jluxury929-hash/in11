// types.ts

export interface BotConfig {
    walletAddress: string;
    authSignerKey: string; 
    minEthBalance: number;
    gasReserveEth: number;
    minProfitThreshold: number;
    mevHelperContractAddress: string;
    flashbotsUrl: string;
}

// Add other interfaces for transactions, bundles, etc., here.
