// FlashbotsMEVExecutor.ts (BUILD-PASSING, FINAL VERSION)

import { 
    ethers, 
    Wallet
} from 'ethers'; 

import { 
    FlashbotsBundleProvider, 
    FlashbotsBundleRawTransaction, 
    FlashbotsTransactionResponse
} from '@flashbots/ethers-provider-bundle';

import * as dotenv from 'dotenv';
import { logger } from './logger';

export class FlashbotsMEVExecutor { // <-- Class opening brace
    private wallet: Wallet;
    private authSigner: Wallet;
    private provider: ethers.providers.JsonRpcProvider; 
    private flashbotsProvider: FlashbotsBundleProvider;

    // Private constructor enforces async instantiation via create()
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

    // Static async factory method to handle asynchronous FlashbotsProvider.create()
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
    
    // The method signature returns Promise<FlashbotsTransactionResponse>, which is a union type.
    public async sendBundle(signedTxs: string[], targetBlock: number): Promise<FlashbotsTransactionResponse> {
        logger.debug(`Attempting to send bundle targeting block ${targetBlock}`);
        
        // Correctly format raw strings into the required Flashbots object structure
        const flashbotsTransactions: FlashbotsBundleRawTransaction[] = signedTxs.map(signedTransaction => ({
            signedTransaction
        }));

        // Removed explicit type annotation here to allow TypeScript to infer the union type
        const bundleSubmission = await this.flashbotsProvider.sendBundle( 
            flashbotsTransactions,
            targetBlock
        );
        
        // Final Fix: Use double-cast to resolve TS2352
        if ('error' in bundleSubmission) {
            logger.error(`Bundle submission failed: ${bundleSubmission.error.message}`); 
            // TS2352 Fix: Cast through 'unknown' first.
            return bundleSubmission as unknown as FlashbotsTransactionResponse; 
        }

        // TypeScript correctly knows this is a successful FlashbotsTransaction
        logger.info(`Bundle submission successful: ${bundleSubmission.bundleHash}`);
        return bundleSubmission; 
    } // <-- Missing closing brace for sendBundle method (Fix for TS1005)
} // <-- Missing closing brace for FlashbotsMEVExecutor class (Fix for TS1005)
