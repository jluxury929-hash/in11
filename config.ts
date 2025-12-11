// src/config.ts

import * as dotenv from 'dotenv';
// Load environment variables for local testing (Railway ignores this for deployment)
dotenv.config();

// Utility to enforce required environment variables
function getRequiredEnv(key: string, optional: boolean = false): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        if (!optional) {
            console.error(`\n\n======================================================`);
            console.error(`🚨 FATAL CONFIG ERROR: Missing required environment variable: ${key}`);
            console.error(`Please set this in your Railway Variables.`);
            console.error(`======================================================\n`);
            // This crash guarantees visibility in the logs
            throw new Error(`Missing required environment variable: ${key}`);
        }
        return '';
    }
    return value;
}

export const config = {
    server: {
        // Use PORT from env, default to 8080. DO NOT set PORT in Railway.
        port: parseInt(process.env.PORT || '8080', 10),
        environment: process.env.NODE_ENV || 'development'
    },
    ethereum: {
        // MUST use getRequiredEnv() for critical connections
        rpcHttp: getRequiredEnv('ETHEREUM_RPC_1'),
        rpcWss: getRequiredEnv('ETHEREUM_WSS'),
    },
    wallet: {
        privateKey: getRequiredEnv('WALLET_PRIVATE_KEY'),
        profitAddress: getRequiredEnv('PROFIT_WALLET_ADDRESS', true), // Profit address can be optional
        minEthBalance: parseFloat(process.env.MIN_ETH_BALANCE || '0.008'),
        gasReserveEth: parseFloat(process.env.GAS_RESERVE_ETH || '0.0002')
    },
    mev: {
        // Must be checked if executor is enabled
        helperContract: getRequiredEnv('MEV_HELPER_CONTRACT_ADDRESS', true),
        uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    },
    flashbots: {
        relayUrl: getRequiredEnv('FLASHBOTS_RELAY', true), // Relay URL has a strong default
        relaySignerKey: getRequiredEnv('FLASHBOTS_RELAY_SIGNER_KEY', true), // Required if MEV is used
        minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.001')
    },
    trading: {
        minTradeValueEth: parseFloat(process.env.MIN_TRADE_VALUE_ETH || '0.0008'),
        checkBalanceInterval: parseInt(process.env.CHECK_BALANCE_INTERVAL || '30000', 10)
    }
};
