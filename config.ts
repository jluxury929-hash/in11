// src/config.ts

import * as dotenv from 'dotenv';
dotenv.config();

function getRequiredEnv(key: string, optional: boolean = false): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        if (!optional) {
            console.error(`\n\n======================================================`);
            console.error(`🚨 FATAL CONFIG ERROR: Missing required environment variable: ${key}`);
            console.error(`======================================================\n`);
            throw new Error(`Missing required environment variable: ${key}`);
        }
        return '';
    }
    return value;
}

export const config = {
    server: {
        port: parseInt(process.env.PORT || '8080', 10),
        environment: process.env.NODE_ENV || 'development'
    },
    ethereum: {
        rpcHttp: getRequiredEnv('ETHEREUM_RPC_1'),
        rpcWss: getRequiredEnv('ETHEREUM_WSS'),
    },
    wallet: {
        privateKey: getRequiredEnv('WALLET_PRIVATE_KEY'),
        profitAddress: getRequiredEnv('PROFIT_WALLET_ADDRESS', true),
        minEthBalance: parseFloat(process.env.MIN_ETH_BALANCE || '0.008'),
        gasReserveEth: parseFloat(process.env.GAS_RESERVE_ETH || '0.0002')
    },
    mev: {
        helperContract: getRequiredEnv('MEV_HELPER_CONTRACT_ADDRESS', true),
        uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    },
    flashbots: {
        relayUrl: getRequiredEnv('FLASHBOTS_RELAY', true),
        relaySignerKey: getRequiredEnv('FLASHBOTS_RELAY_SIGNER_KEY', true),
        minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.001')
    },
    trading: {
        minTradeValueEth: parseFloat(process.env.MIN_TRADE_VALUE_ETH || '0.0008'),
        checkBalanceInterval: parseInt(process.env.CHECK_BALANCE_INTERVAL || '30000', 10)
    }
};
