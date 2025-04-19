/**
 * 链配置文件
 */
import { ChainConfig, PoolType } from './interfaces';

// 配置各链信息
export const CHAIN_CONFIGS: { [chainName: string]: ChainConfig } = {
  ethereum: {
    name: "Ethereum",
    rpcUrl: "https://ethereum.publicnode.com",
    backupRpcUrl: "https://eth.llamarpc.com",
    ethUsdtPool: {
      address: "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852", // Uniswap V2 ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 0, usdt: 1 },
      type: PoolType.UNISWAP_V2
    },
    chainlinkFeeds: {
      ethUsd: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" // ETH/USD 主网喂价合约
    },
    apiConfig: {
      moralis: {
        tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH地址
        chain: "eth"
      },
      sushiswap: {
        pairAddress: "0x06da0fd433c1a5d7a4faa01111c044910a184553" // SushiSwap ETH/USDT
      }
    }
  },
  arbitrum: {
    name: "Arbitrum",
    rpcUrl: "https://arbitrum-one.publicnode.com",
    backupRpcUrl: "https://arb1.arbitrum.io/rpc",
    ethUsdtPool: {
      address: "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443", // SushiSwap ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 0, usdt: 1 },
      type: PoolType.SUSHISWAP 
    },
    chainlinkFeeds: {
      ethUsd: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" // ETH/USD Arbitrum喂价合约
    },
    apiConfig: {
      moralis: {
        tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
        chain: "arbitrum"
      },
      sushiswap: {
        pairAddress: "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443" // SushiSwap ETH/USDT on Arbitrum
      }
    }
  },
  optimism: {
    name: "Optimism",
    rpcUrl: "https://optimism.publicnode.com",
    backupRpcUrl: "https://mainnet.optimism.io",
    ethUsdtPool: {
      address: "0x7B28472c1427C84435e112EE0AD1666bCD17f95E", // UniswapV3 ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 1, usdt: 0 }, // 注意这里的顺序，token0是USDT，token1是ETH
      type: PoolType.UNISWAP_V3
    },
    chainlinkFeeds: {
      ethUsd: "0x13e3Ee699D1909E989722E753853AE30b17e08c5" // ETH/USD Optimism喂价合约
    },
    apiConfig: {
      moralis: {
        tokenAddress: "0x4200000000000000000000000000000000000006", // WETH on Optimism
        chain: "optimism"
      },
      uniswapGraph: {
        poolId: "0x7b28472c1427c84435e112ee0ad1666bcd17f95e" // UniswapV3 ETH/USDT on Optimism
      }
    }
  },
  base: {
    name: "Base",
    rpcUrl: "https://base.publicnode.com",
    backupRpcUrl: "https://mainnet.base.org",
    ethUsdtPool: {
      address: "0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18", // BaseSwap ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 0, usdt: 1 },
      type: PoolType.UNISWAP_V2 // BaseSwap使用UniswapV2风格接口
    },
    chainlinkFeeds: {
      ethUsd: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" // ETH/USD Base喂价合约
    },
    apiConfig: {
      moralis: {
        tokenAddress: "0x4200000000000000000000000000000000000006", // WETH on Base
        chain: "base"
      }
    }
  },
  // 添加BSC链配置
  bsc: {
    name: "BSC",
    rpcUrl: "https://bsc-dataseed.binance.org",
    backupRpcUrl: "https://bsc-dataseed1.defibit.io",
    ethUsdtPool: {
      address: "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE", // PancakeSwap BNB/USDT
      decimals: { eth: 18, usdt: 18 },
      order: { eth: 0, usdt: 1 },
      type: PoolType.UNISWAP_V2
    },
    chainlinkFeeds: {
      ethUsd: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" // BNB/USD BSC喂价合约
    },
    apiConfig: {
      moralis: {
        tokenAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB地址
        chain: "bsc"
      }
    }
  },
  // 添加Solana链配置
  solana: {
    name: "Solana",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    backupRpcUrl: "https://solana-api.projectserum.com",
    ethUsdtPool: {
      address: "8JPJJkmDScpcNmBRKGZuPuG2GYAveQgP3t5gFuMymwvF", // Raydium SOL/USDT
      decimals: { eth: 9, usdt: 6 },
      order: { eth: 0, usdt: 1 },
      type: PoolType.RAYDIUM
    },
    chainlinkFeeds: {
      ethUsd: "GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU" // SOL/USD Solana喂价账户
    },
    apiConfig: {
      moralis: {
        tokenAddress: "So11111111111111111111111111111111111111112", // Wrapped SOL
        chain: "solana"
      }
    }
  },
  // 添加SUI链配置
  sui: {
    name: "SUI",
    rpcUrl: "https://fullnode.mainnet.sui.io",
    backupRpcUrl: "https://sui-mainnet-rpc.nodereal.io",
    ethUsdtPool: {
      address: "0x5eb232c309d38d73dc095aea0376daf260588689c0ee24e7sd69b6c3a67556bf4", // Cetus SUI/USDT
      decimals: { eth: 9, usdt: 6 },
      order: { eth: 0, usdt: 1 },
      type: PoolType.CETUS
    },
    chainlinkFeeds: {
      ethUsd: "0x8dae7a1675b19d2edee169bd5d674553ed5427ab"
    },
    apiConfig: {
      moralis: {
        tokenAddress: "0x2::sui::SUI",
        chain: "sui"
      }
    }
  }
};

// 导出所有支持的链名称
export const SUPPORTED_CHAINS = Object.keys(CHAIN_CONFIGS);

// 导出默认配置
export const DEFAULT_CONFIG = {
  cacheTTL: 30000, // 30秒缓存
  retryLimit: 3,   // 最多重试3次
  timeout: 10000,  // 10秒超时
  parallelRequests: 4 // 最多4个并行请求
}; 