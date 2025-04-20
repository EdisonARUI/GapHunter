export const DEVNET_COUNTER_PACKAGE_ID = "0x28fba8eacff689870615901a5204b7758ffe71835808f8fbaac494f35d225e38";
export const TESTNET_COUNTER_PACKAGE_ID = "0x28fba8eacff689870615901a5204b7758ffe71835808f8fbaac494f35d225e38";
export const MAINNET_COUNTER_PACKAGE_ID = "0x28fba8eacff689870615901a5204b7758ffe71835808f8fbaac494f35d225e38";

// 重要对象ID
export const TREASURY_CAP_ID = "0x6e6bb178df0065b8de36f18430ece7de63b8e35d61a7495ff60dc3198d8fa68f";
export const LIQUIDITY_POOL_ID = "0x19f7371b42d58d2dac2aa1a25f6d6d2d25b359476b6f3fbdf625f27daeca8496";
export const CLOCK_ID = "0x6";

// 其他网络配置
export const NETWORK_RPC_URLS = {
  devnet: "https://fullnode.devnet.sui.io",
  testnet: "https://fullnode.testnet.sui.io",
  mainnet: "https://fullnode.mainnet.sui.io"
};

// 网络浏览器配置
export const NETWORK_EXPLORERS = {
  devnet: "https://suiexplorer.com/?network=devnet",
  testnet: "https://suiexplorer.com/?network=testnet",
  mainnet: "https://suiexplorer.com"
};

// 网络环境配置
export const NETWORK_ENV = {
  DEVNET: "devnet",
  TESTNET: "testnet", 
  MAINNET: "mainnet"
} as const;

// 默认网络
export const DEFAULT_NETWORK = NETWORK_ENV.TESTNET;
