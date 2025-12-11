import { ethers } from 'ethers';
import logger from '../utils/logger';
import { RawMEVOpportunity } from '../types';

export class MempoolMonitor {
    private provider: ethers.WebSocketProvider;
    private uniswapV2Router: string;
    private minTradeValueEth: number;
    private isMonitoring: boolean = false;

    constructor(
        rpcWss: string,
        uniswapV2Router: string,
        minTradeValueEth: number = 0.1
    ) {
        this.provider = new ethers.WebSocketProvider(rpcWss);
        this.uniswapV2Router = uniswapV2Router.toLowerCase();
        this.minTradeValueEth = minTradeValueEth;
    }

    async start(callback: (opportunity: RawMEVOpportunity) => void): Promise<void> {
        logger.info('Starting mempool monitoring...');
        this.isMonitoring = true;

        this.provider.on('pending', async (txHash: string) => {
            if (!this.isMonitoring) return;

            try {
                const tx = await this.provider.getTransaction(txHash);
                if (!tx) return;

                const opportunity = await this.analyzeTransaction(tx);
                if (opportunity) {
                    callback(opportunity);
                }
            } catch (error) {
                // Silently ignore
            }
        });

        logger.info('✓ Mempool monitoring active');
    }

    private async analyzeTransaction(tx: ethers.TransactionResponse): Promise<RawMEVOpportunity | null> {
        try {
            if (!tx.to || tx.to.toLowerCase() !== this.uniswapV2Router) {
                return null;
            }

            const iface = new ethers.Interface([
                'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)',
                'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)'
            ]);

            let decoded;
            try {
                decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
            } catch {
                return null;
            }

            if (!decoded) return null;

            const path = decoded.args.path as string[];
            if (path.length < 2) return null;

            const amountIn = tx.value || decoded.args.amountIn as bigint;
            const amountInEth = parseFloat(ethers.formatEther(amountIn));
            
            if (amountInEth < this.minTradeValueEth) return null;

            const estimatedProfitEth = (amountInEth * 0.003).toFixed(6);

            const rawTx = ethers.Transaction.from(tx).serialized;

            return {
                type: 'sandwich',
                targetTxHash: tx.hash,
                targetTxRaw: rawTx,
                targetTxParsed: tx,
                tokenIn: path[0],
                tokenOut: path[path.length - 1],
                amountIn: amountIn,
                estimatedProfitEth
            };

        } catch (error) {
            return null;
        }
    }

    async stop(): Promise<void> {
        this.isMonitoring = false;
        await this.provider.destroy();
        logger.info('Mempool monitor stopped');
    }
}
