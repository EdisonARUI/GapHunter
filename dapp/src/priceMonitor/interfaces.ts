/**
 * 价格监控系统接口定义
 */

// 池类型定义
export const PoolType = {
  UNISWAP_V2: "uniswap_v2",
  UNISWAP_V3: "uniswap_v3",
  SUSHISWAP: "sushiswap", 
  RAYDIUM: "raydium",    // Solana上的Raydium
  CETUS: "cetus",        // SUI上的Cetus
  CUSTOM: "custom"
} as const;

export type PoolTypeValue = typeof PoolType[keyof typeof PoolType];

// EVM链配置接口
export interface ChainConfig {
  name: string;                // 链的显示名称
  rpcUrl: string;              // 主RPC节点URL
  backupRpcUrl: string;        // 备用RPC节点URL
  ethUsdtPool: {
    address: string;           // DEX池合约地址
    decimals: { eth: number; usdt: number }; // 代币精度
    order: { eth: number; usdt: number };    // 0表示token0, 1表示token1
    type: PoolTypeValue;       // 池的类型/接口
  };
  chainlinkFeeds?: {
    ethUsd?: string;           // Chainlink ETH/USD 喂价合约地址
  };
  apiConfig?: {
    moralis?: {
      tokenAddress?: string;   // 用于Moralis API的代币地址
      chain?: string;          // Moralis API使用的链标识
    },
    sushiswap?: {
      pairAddress?: string;    // SushiSwap交易对地址
    },
    uniswapGraph?: {
      poolId?: string;         // UniswapV3 Graph查询的池ID
    }
  };
}

// 价格数据源接口
export interface PriceDataSource {
  /**
   * 获取指定链上的ETH/USDT价格
   * @param chainName 链名称
   * @returns Promise<number> 价格
   */
  getPrice(chainName: string): Promise<number>;
  
  /**
   * 数据源名称
   */
  readonly name: string;
  
  /**
   * 数据源优先级 (数字越小优先级越高)
   */
  readonly priority: number;
}

// 监控任务配置
export interface TaskConfig {
  id: string;            // 任务ID
  name?: string;         // 任务名称
  chain_pairs: string[]; // 要监控的链对
  token_pairs: string[]; // 要监控的代币对
  threshold: number;     // 价格差异阈值（百分比）
  cooldown: number;      // 告警冷却时间（秒）
  last_alert?: number;   // 上次告警时间（毫秒时间戳）
  active: boolean;       // 是否激活
}

// 价格结果
export interface PriceResult {
  chainName: string;     // 链名称
  price: number;         // 价格
  timestamp: number;     // 时间戳
  source: string;        // 数据源
  success: boolean;      // 是否成功
}

// 价格监控配置
export interface PriceMonitorConfig {
  cacheTTL: number;      // 缓存有效期（毫秒）
  retryLimit: number;    // 重试次数限制
  timeout: number;       // 请求超时（毫秒）
  parallelRequests: number; // 并行请求数量
  apiKeys?: {            // API密钥
    moralis?: string;
    coinGecko?: string;
  };
} 