// FlashbotsMEVExecutor.ts (Ethers v5 Syntax)

import { 
    ethers, // Rely on global import for v5 syntax
    Wallet,
    // FIX: Remove explicit Ethers v6 imports (TransactionRequest/Response)
} from 'ethers'; 

import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';

import * as dotenv from 'dotenv';
import { logger } from './logger';

export class FlashbotsMEVExecutor {
    private wallet: Wallet;
    private authSigner: Wallet;
    private provider: ethers.providers.JsonRpcProvider; // Ethers v5 type
    private flashbotsProvider: FlashbotsBundleProvider;

    constructor(
        privateKey: string, 
        authSignerKey: string, 
        rpcUrl: string, 
        flashbotsUrl: string
    ) {
        // FIX: Ethers v5 syntax
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl); 
        
        this.wallet = new Wallet(privateKey, this.provider);
        this.authSigner = new Wallet(authSignerKey);

        // Initialize Flashbots Provider
        this.flashbotsProvider = FlashbotsBundleProvider.create(
            this.provider,
            this.authSigner,
            flashbotsUrl 
        );

        logger.info(`[Executor] Initialized Wallet: ${this.wallet.address}`);
    }

    public async checkBalance() {
        try {
            const balance = await this.provider.getBalance(this.wallet.address);
            // FIX: Ethers v5 utility syntax
            logger.info(`[Executor] Current ETH Balance: ${ethers.utils.formatEther(balance)} ETH`); 
            return balance;
        } catch (error) {
            logger.error("[Executor] Error fetching balance:", error);
            return ethers.constants.Zero;
        }
    }
    
    public async sendBundle(signedTxs: string[], targetBlock: number) {
        logger.debug(`Attempting to send bundle targeting block ${targetBlock}`);
        
        const bundleSubmission = await this.flashbotsProvider.sendBundle(
            signedTxs,
            targetBlock
        );

        logger.info(`Bundle submission successful: ${bundleSubmission.bundleHash}`);
        return bundleSubmission;
    }
}
