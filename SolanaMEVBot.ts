// src/SolanaMEVBot.ts

import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { logger } from './logger.js'; 
import { BotConfig } from './types.js'; 
import { JitoMEVExecutor } from './JitoMEVExecutor.js'; 
import { MempoolMonitor } from './MempoolMonitor.js';

export class SolanaMEVBot {	
	private connection: Connection;
	private keypair: Keypair;
	private executor: JitoMEVExecutor | undefined;
	private monitor: MempoolMonitor | undefined;
	private config: BotConfig;
	
	constructor() {
		dotenv.config();

		const privateKeyBase58 = process.env.WALLET_PRIVATE_KEY;
		const rpcUrl = process.env.SOLANA_RPC_URL;
		const jitoUrl = process.env.JITO_BLOCK_ENGINE_URL;
		const targetId = process.env.TARGET_SWAP_PROGRAM_ID;
		
		if (!privateKeyBase58 || !rpcUrl || !jitoUrl || !targetId) {
			logger.error("Missing critical environment variables. Exiting.");
             process.exit(1);
		}

        try {
            this.keypair = Keypair.fromSecretKey(new Uint8Array(Buffer.from(privateKeyBase58, 'base58')));
            this.config = {
                walletAddress: this.keypair.publicKey,
                minSolBalance: parseFloat(process.env.MIN_SOL_BALANCE || '0.05'),	
                minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '5.00'),
                targetSwapProgramId: new PublicKey(targetId),
                jitoBlockEngineUrl: jitoUrl,
            };
        } catch (error) {
            logger.error("Invalid WALLET_PRIVATE_KEY or TARGET_SWAP_PROGRAM_ID format.", error);
            process.exit(1);
        }
		
		this.connection = new Connection(rpcUrl, 'confirmed');	
		logger.info("Bot configuration loaded.");
	}

	private async checkBalance(): Promise<void> {
        try {
            const balanceLamports = await this.connection.getBalance(this.config.walletAddress);
            const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;	
            logger.info(`[BALANCE] Current SOL Balance: ${balanceSOL} SOL`);

            if (balanceSOL < this.config.minSolBalance) { 
                logger.error(`Balance (${balanceSOL.toFixed(2)} SOL) is below MIN_SOL_BALANCE (${this.config.minSolBalance}). Shutting down.`);
                process.exit(1);
            }

        } catch (error) {
            logger.error("Could not check balance. Check SOLANA_RPC_URL.", error);
            process.exit(1);
        }
    }


	public async startMonitoring(): Promise<void> {
		logger.info("[STATUS] Starting bot services...");

        await this.checkBalance();
        
        // Initialize Jito Executor
        this.executor = new JitoMEVExecutor(this.config.jitoBlockEngineUrl, this.keypair);

        // Initialize Mempool Monitor
        this.monitor = new MempoolMonitor(
            this.connection.rpcEndpoint,
            this.config.targetSwapProgramId,
            this.executor
        );
        
        logger.info("[STATUS] Monitoring fully active.");
	}
}
