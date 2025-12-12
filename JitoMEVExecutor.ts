// src/JitoMEVExecutor.ts

import { BlockEngineService } from '@jito-labs/jito-ts';
import { Connection, Keypair, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { logger } from './logger.js';

export class JitoMEVExecutor {
    private blockEngine: BlockEngineService;
    private searcherKeypair: Keypair;
    
    constructor(jitoUrl: string, keypair: Keypair) {
        this.searcherKeypair = keypair;
        this.blockEngine = BlockEngineService.client(jitoUrl, keypair);
        logger.info(`[JITO] Executor initialized for ${jitoUrl}.`);
    }

    /**
     * Sends a transaction bundle to the Jito Block Engine.
     * @param signedBundle Array of raw signed transaction buffers.
     */
    async sendBundle(signedBundle: Buffer[]): Promise<void> {
        logger.info(`[JITO] Submitting bundle of ${signedBundle.length} transactions...`);

        try {
            // 1. Convert Buffers to VersionedTransaction objects
            const transactions = signedBundle.map(buffer => 
                VersionedTransaction.deserialize(buffer)
            );

            // 2. Simulate the bundle before submission (Jito feature)
            const simulationResult = await this.blockEngine.simulateBundle(transactions, 1000);
            
            if (simulationResult.simulation_succeeded) {
                logger.debug(`[JITO] Bundle simulation succeeded. Sending...`);
                
                // 3. Send the bundle
                const confirmation = await this.blockEngine.sendBundle(transactions);
                
                logger.info(`[JITO] Bundle submitted. Status: ${confirmation.uuid}`);

            } else {
                logger.warn(`[JITO] Bundle simulation failed. Reason: ${simulationResult.error}`);
            }

        } catch (error) {
            logger.error("[JITO] Error during bundle submission.", error);
        }
    }

    // Utility function to get the base address of the searcher
    getSearcherAddress() {
        return this.searcherKeypair.publicKey;
    }
}
