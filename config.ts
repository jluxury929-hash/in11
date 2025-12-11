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
    mev: {
        helperContract: process.env.MEV_HELPER_CONTRACT_ADDRESS || '',
        uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    },
    flashbots: {
        relayUrl: process.env.FLASHBOTS_RELAY || 'https://relay.flashbots.net',
        relaySignerKey: process.env.FLASHBOTS_RELAY_SIGNER_KEY || '',
        minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.001'),
        minProfitEth: parseFloat(process.env.MIN_PROFIT_ETH || '0.001')
    },
    trading: {
        minTradeValueEth: parseFloat(process.env.MIN_TRADE_VALUE_ETH || '0.0008'),
        checkBalanceInterval: parseInt(process.env.CHECK_BALANCE_INTERVAL || '30000', 10)
    }
};
