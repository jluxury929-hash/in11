// FlashbotsMEVExecutor.ts (FINAL, BUILD-PASSING VERSION)

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

export class FlashbotsMEVExecutor {
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

        // CRITICAL FIX: Removed explicit type annotation here to allow TypeScript to infer 
        // the union type and enable correct type narrowing later.
        const bundleSubmission = await this.flashbotsProvider.sendBundle( 
            flashbotsTransactions,
            targetBlock
        );
        
        // FIX: The 'error' in submission check correctly narrows the type.
        // This resolves TS2322 and TS18046.
        if ('error' in bundleSubmission) {
            // TypeScript now knows bundleSubmission is a RelayResponseError
            logger.error(`Bundle submission failed: ${bundleSubmission.error.message}`); 
            return bundleSubmission; 
        }

        // If we reach here, TypeScript knows bundleSubmission is a successful FlashbotsTransaction 
        logger.info(`Bundle submission successful: ${bundleSubmission.bundleHash}`);
        return bundleSubmission; 
    }
}
