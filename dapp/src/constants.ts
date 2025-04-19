export const DEVNET_COUNTER_PACKAGE_ID = "0x9cb500ae7162ea6692f34e1f5db622f8df44e7efc3db51525406c904fd832c0b";
export const TESTNET_COUNTER_PACKAGE_ID = "0x9cb500ae7162ea6692f34e1f5db622f8df44e7efc3db51525406c904fd832c0b";
export const MAINNET_COUNTER_PACKAGE_ID = "0x9cb500ae7162ea6692f34e1f5db622f8df44e7efc3db51525406c904fd832c0b";

// 重要对象ID
export const TREASURY_CAP_ID = "0xeacd6288a0df9a933ce703702f43fb003fc202b73878ea0731ddcf96ca9e2d24";
export const LIQUIDITY_POOL_ID = "0x2df0c4f9bdf1e73c69e053cf3e9ad3c7a8391b58347b6112813049778acb0ad6";
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
