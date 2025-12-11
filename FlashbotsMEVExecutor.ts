// FlashbotsMEVExecutor.ts (REVERTED/FAILING CODE - Ethers v5 Syntax)

import { 
    ethers, // Global Ethers import used for providers/utils in v5
    Wallet, 
    TransactionRequest, 
    TransactionResponse
} from 'ethers'; 

import * as dotenv from 'dotenv';
dotenv.config();

// Note: In Ethers v5, providers were generally accessed via the ethers.providers namespace.
// 

export class FlashbotsMEVExecutor {
    private wallet: Wallet;
    private authSigner: Wallet;
    // Type definition using v5 syntax
    private provider: ethers.providers.JsonRpcProvider; 

    constructor(
        privateKey: string, 
        authSignerKey: string, 
        rpcUrl: string, 
    ) {
        // --- FAILING CALL: Ethers v5 Providers syntax ---
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl); 
        
        this.wallet = new Wallet(privateKey, this.provider);
        this.authSigner = new Wallet(authSignerKey);

        console.log(`[Executor] Initialized Wallet: ${this.wallet.address}`);
    }

    public async checkBalance() {
        const balance = await this.provider.getBalance(this.wallet.address);
        
        // --- FAILING CALL: Ethers v5 Utils syntax ---
        console.log(`[Executor] Current ETH Balance: ${ethers.utils.formatEther(balance)} ETH`); 
        return balance;
    }
    
    // You would have other methods here, e.g., sendBundle
}
