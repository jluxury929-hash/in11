export const config = {
    server: {
        port: parseInt(process.env.PORT || '8080', 10),
        environment: process.env.NODE_ENV || 'development'
    },
    ethereum: {
        rpcHttp: process.env.ETHEREUM_RPC_1 || 'https://eth-mainnet.g.alchemy.com/v2/demo',
        rpcWss: process.env.ETHEREUM_WSS || 'wss://eth-mainnet.g.alchemy.com/v2/demo'
    },
    wallet: {
        privateKey: process.env.WALLET_PRIVATE_KEY || '',
        profitAddress: process.env.PROFIT_WALLET_ADDRESS || '',
        minEthBalance: parseFloat(process.env.MIN_ETH_BALANCE || '0.008'),
        gasReserveEth: parseFloat(process.env.GAS_RESERVE_ETH || '0.0002')
    },
    trading: {
        minTradeValueEth: parseFloat(process.env.MIN_TRADE_VALUE_ETH || '0.0008'),
        checkBalanceInterval: parseInt(process.env.CHECK_BALANCE_INTERVAL || '30000', 10)
    }
};
