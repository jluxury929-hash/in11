// FlashbotsMEVExecutor.ts (FINAL FIXES)

import { 
    ethers, 
    Wallet
} from 'ethers'; 

import { 
    FlashbotsBundleProvider, 
    FlashbotsBundleRawTransaction, 
    FlashbotsBundleTransaction, 
    FlashbotsTransactionResponse
} from '@flashbots/ethers-provider-bundle';

import * as dotenv from 'dotenv';
import { logger } from './logger';

export class FlashbotsMEVExecutor {
    private wallet: Wallet;
    private authSigner: Wallet;
    private provider: ethers.providers.JsonRpcProvider; 
    private flashbotsProvider: FlashbotsBundleProvider;

    // FIX A: Private constructor to enforce use of the async factory method
    private constructor(
        provider: ethers.providers.JsonRpcProvider, 
        wallet: Wallet, 
        authSigner: Wallet, 
        flashbotsProvider: FlashbotsBundleProvider
    ) {
        this.provider = provider;
        this.wallet = wallet;
        this.authSigner = authSigner;
        this.flashbotsProvider = flashbotsProvider;

        logger.info(`[Executor] Initialized Wallet: ${this.wallet.address}`);
    }

    // FIX A: Static async factory method to handle FlashbotsProvider.create() await (TS2740)
    public static async create(
        privateKey: string, 
        authSignerKey: string, 
        rpcUrl: string, 
        flashbotsUrl: string
    ): Promise<FlashbotsMEVExecutor> {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const wallet = new Wallet(privateKey, provider);
        const authSigner = new Wallet(authSignerKey);

        const flashbotsProvider = await FlashbotsBundleProvider.create(
            provider,
            authSigner,
            flashbotsUrl 
        );

        return new FlashbotsMEVExecutor(provider, wallet, authSigner, flashbotsProvider);
    }

    public async checkBalance() {
        try {
            const balance = await this.provider.getBalance(this.wallet.address);
            logger.info(`[Executor] Current ETH Balance: ${ethers.utils.formatEther(balance)} ETH`); 
            return balance;
        } catch (error) {
            logger.error("[Executor] Error fetching balance:", error);
            return ethers.constants.Zero;
        }
    }
    
    public async sendBundle(signedTxs: string[], targetBlock: number) {
        logger.debug(`Attempting to send bundle targeting block ${targetBlock}`);
        
        // FIX B: Reformat raw strings into the required Flashbots object structure (TS2345)
        const flashbotsTransactions: FlashbotsBundleRawTransaction[] = signedTxs.map(signedTransaction => ({
            signedTransaction
        }));

        const bundleSubmission: FlashbotsTransactionResponse = await this.flashbotsProvider.sendBundle(
            flashbotsTransactions, // Use the corrected array format
            targetBlock
        );

        // FIX C: Check for submission failure before accessing bundleHash (TS2339)
        if ('error' in bundleSubmission) {
            logger.error(`Bundle submission failed: ${bundleSubmission.error.message}`);
            return bundleSubmission;
        }

        logger.info(`Bundle submission successful: ${bundleSubmission.bundleHash}`);
        return bundleSubmission;
    }
}
