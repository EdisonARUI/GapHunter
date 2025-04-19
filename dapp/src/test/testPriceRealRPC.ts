/**
 * ETH/USDT价格查询测试脚本 - 连接真实RPC节点 (优化版v2)
 * 使用方法: npx ts-node src/test/testPriceRealRPC.ts
 */

import { ethers } from 'ethers';
import { SuiClient } from '@mysten/sui.js/client';
import axios from 'axios';

// 添加API密钥配置
const API_KEYS = {
  moralis: process.env.MORALIS_API_KEY || "替换为你的Moralis API密钥", // 从环境变量获取，或替换为实际密钥
  sushiswap: process.env.SUSHISWAP_API_KEY || "", // SushiSwap可能不需要API密钥
};

// API端点配置
const API_ENDPOINTS = {
  moralis: "https://deep-index.moralis.io/api/v2",
  sushiswap: "https://api.sushi.com",
  uniswapGraph: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
};

// UniswapV2式ERC20-Pair接口
const IUniswapV2PairABI = [
  // 常用的查询方法
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)"
];

// UniswapV3式Pool接口
const IUniswapV3PoolABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

// Chainlink预言机接口
const IChainlinkAggregatorABI = [
  "function latestAnswer() external view returns (int256)",
  "function latestRound() external view returns (uint256)",
  "function latestTimestamp() external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// 定义不同的接口类型
const PoolType = {
  UNISWAP_V2: "uniswap_v2",
  UNISWAP_V3: "uniswap_v3",
  SUSHISWAP: "sushiswap", 
  CUSTOM: "custom"
} as const;

type PoolTypeValue = typeof PoolType[keyof typeof PoolType];

// EVM链信息配置
interface ChainConfig {
  name: string;
  rpcUrl: string;
  backupRpcUrl: string;
  ethUsdtPool: {
    address: string;
    decimals: { eth: number; usdt: number };
    order: { eth: number; usdt: number }; // 0表示token0, 1表示token1
    type: PoolTypeValue; // 池的类型/接口
  };
  chainlinkFeeds?: {
    ethUsd?: string; // ETH/USD 喂价合约地址
  };
  apiConfig?: {
    moralis?: {
      tokenAddress?: string; // 用于Moralis API的代币地址
      chain?: string; // Moralis API使用的链标识
    },
    sushiswap?: {
      pairAddress?: string; // SushiSwap交易对地址
    },
    uniswapGraph?: {
      poolId?: string; // UniswapV3 Graph查询的池ID
    }
  };
}

// 配置各链信息 - 更新合约地址和接口类型
const CHAIN_CONFIGS: { [chainName: string]: ChainConfig } = {
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
      // 更新为最新的Optimism上的UniswapV3 ETH/USDT池
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
      // 更新为Base上的UniswapV3 ETH/USDT池
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
  }
};

// 备用价格源 - 使用CoinGecko API
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// 价格监控类
class RealPriceMonitor {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private backupProviders: Map<string, ethers.providers.JsonRpcProvider>;
  private pairContracts: Map<string, ethers.Contract>;
  private chainlinkContracts: Map<string, ethers.Contract>;
  private priceCache: Map<string, number>;
  private lastPriceUpdate: Map<string, number>;
  private verifiedContracts: Map<string, { verified: boolean, type: string | PoolTypeValue }>;
  private contractInterfaces: Map<string, any>;

  constructor() {
    this.providers = new Map();
    this.backupProviders = new Map();
    this.pairContracts = new Map();
    this.chainlinkContracts = new Map();
    this.priceCache = new Map();
    this.lastPriceUpdate = new Map();
    this.verifiedContracts = new Map();
    this.contractInterfaces = new Map();
    
    // 初始化所有提供者和合约
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    // 为每个链创建提供者和合约
    for (const [chainName, config] of Object.entries(CHAIN_CONFIGS)) {
      try {
        // 主RPC提供者
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        this.providers.set(chainName, provider);
        
        // 备用RPC提供者
        const backupProvider = new ethers.providers.JsonRpcProvider(config.backupRpcUrl);
        this.backupProviders.set(chainName, backupProvider);
        
        // 初始化合适的接口
        let pairABI;
        switch (config.ethUsdtPool.type) {
          case PoolType.UNISWAP_V2:
          case PoolType.SUSHISWAP:
            pairABI = IUniswapV2PairABI;
            break;
          case PoolType.UNISWAP_V3:
            pairABI = IUniswapV3PoolABI;
            break;
          default:
            // 自定义或未知类型，使用通用接口
            pairABI = [...IUniswapV2PairABI, ...IUniswapV3PoolABI]; 
            break;
        }
        
        // 保存接口供后续使用
        this.contractInterfaces.set(chainName, pairABI);
        
        // 创建代币对合约实例
        const pairContract = new ethers.Contract(
          config.ethUsdtPool.address,
          pairABI,
          provider
        );
        this.pairContracts.set(chainName, pairContract);
        
        // 如果有Chainlink喂价合约，也初始化它
        if (config.chainlinkFeeds?.ethUsd) {
          const chainlinkContract = new ethers.Contract(
            config.chainlinkFeeds.ethUsd,
            IChainlinkAggregatorABI,
            provider
          );
          this.chainlinkContracts.set(chainName, chainlinkContract);
        }
        
        // 验证合约是否存在
        await this.verifyContract(chainName, config.ethUsdtPool.address, provider, config.ethUsdtPool.type);
        
        console.log(`✓ 已初始化 ${chainName} 提供者和合约`);
      } catch (error: any) {
        console.error(`✗ 初始化 ${chainName} 失败:`, error.message || String(error));
      }
    }
  }

  // 验证合约是否存在并尝试确定其接口类型
  private async verifyContract(
    chainName: string, 
    address: string, 
    provider: ethers.providers.JsonRpcProvider,
    poolType: PoolTypeValue
  ): Promise<boolean> {
    try {
      // 检查地址是否为合约
      const code = await provider.getCode(address);
      if (code === '0x') {
        console.warn(`⚠️ ${chainName} 地址 ${address} 不是合约`);
        this.verifiedContracts.set(chainName, { verified: false, type: 'none' });
        return false;
      }
      
      // 根据池类型选择验证方法
      let detectedType = poolType;
      const pairABI = this.contractInterfaces.get(chainName);
      if (!pairABI) {
        throw new Error(`找不到${chainName}的合约接口`);
      }
      
      const contract = new ethers.Contract(address, pairABI, provider);
      
      // 尝试确定合约类型
      try {
        // 优先尝试获取代币地址，这在大多数DEX接口中都是可用的
        const token0 = await contract.token0();
        const token1 = await contract.token1();
        console.log(`🔄 ${chainName} 代币对: ${token0} / ${token1}`);
        
        // 尝试UniswapV2特有的方法
        try {
          const reserves = await contract.getReserves();
          if (reserves && reserves.length >= 2) {
            detectedType = PoolType.UNISWAP_V2;
            console.log(`📄 ${chainName} 合约已识别为UniswapV2类型`);
            
            try {
              // 尝试获取名称和符号（如果有）
              const name = await contract.name();
              const symbol = await contract.symbol();
              console.log(`📄 ${chainName} 合约信息: ${name} (${symbol})`);
            } catch (e) {
              // 某些V2池可能没有name/symbol方法
              console.log(`📄 ${chainName} 合约是UniswapV2类型，但无法读取名称/符号`);
            }
          }
        } catch (e) {
          // 不是UniswapV2接口
        }
        
        // 尝试UniswapV3特有的方法
        try {
          const slot0 = await contract.slot0();
          if (slot0 && slot0.sqrtPriceX96) {
            detectedType = PoolType.UNISWAP_V3;
            console.log(`📄 ${chainName} 合约已识别为UniswapV3类型`);
          }
        } catch (e) {
          // 不是UniswapV3接口
        }
        
        // 标记为已验证
        this.verifiedContracts.set(chainName, { verified: true, type: detectedType });
        return true;
      } catch (e) {
        console.warn(`⚠️ ${chainName} 合约虽然存在但无法读取基本信息，尝试使用其他方法`);
        // 尝试读取合约字节码判断类型
        if (code.includes('3850c7bd')) { // slot0函数签名
          console.log(`📄 ${chainName} 合约可能是UniswapV3类型 (基于字节码分析)`);
          this.verifiedContracts.set(chainName, { verified: true, type: PoolType.UNISWAP_V3 });
          return true;
        } else if (code.includes('0902f1ac')) { // getReserves函数签名
          console.log(`📄 ${chainName} 合约可能是UniswapV2类型 (基于字节码分析)`);
          this.verifiedContracts.set(chainName, { verified: true, type: PoolType.UNISWAP_V2 });
          return true;
        } else {
          this.verifiedContracts.set(chainName, { verified: false, type: 'unknown' });
          return false;
        }
      }
    } catch (error: any) {
      console.error(`✗ 验证${chainName}合约失败:`, error.message || String(error));
      this.verifiedContracts.set(chainName, { verified: false, type: 'error' });
      return false;
    }
  }

  // 获取单个链上的ETH/USDT价格
  public async getEthUsdtPrice(chainName: string): Promise<number> {
    // 检查链是否在支持的列表中
    if (!CHAIN_CONFIGS[chainName]) {
      throw new Error(`不支持的链: ${chainName}`);
    }
    
    const cacheKey = `${chainName}:ETH/USDT`;
    const now = Date.now();
    const lastUpdate = this.lastPriceUpdate.get(cacheKey) || 0;
    
    // 如果有缓存且在30秒内，直接返回缓存值
    if (now - lastUpdate < 30000) {
      const cachedPrice = this.priceCache.get(cacheKey);
      if (cachedPrice !== undefined) {
        console.log(`[缓存] ${chainName} ETH/USDT: $${cachedPrice.toFixed(2)}`);
        return cachedPrice;
      }
    }
    
    // 获取价格的策略顺序：
    // 1. 首先尝试DEX合约
    // 2. 如果失败，尝试Chainlink
    // 3. 如果失败，尝试API（Moralis、SushiSwap、UniswapGraph）
    // 4. 如果仍失败，尝试CoinGecko
    
    try {
      // 检查合约是否已验证
      const contractInfo = this.verifiedContracts.get(chainName);
      if (!contractInfo || !contractInfo.verified) {
        console.log(`${chainName} 合约未通过验证，尝试通过API获取价格`);
        return await this.getPriceFromAPI(chainName);
      }
      
      // 根据合约类型选择不同的价格获取方法
      switch (contractInfo.type) {
        case PoolType.UNISWAP_V2:
          return await this.getEthUsdtPriceFromV2Pool(chainName);
        case PoolType.SUSHISWAP:
          return await this.getEthUsdtPriceFromV2Pool(chainName); // SushiSwap使用与UniswapV2相同的接口
        case PoolType.UNISWAP_V3:
          return await this.getEthUsdtPriceFromV3Pool(chainName);
        default:
          throw new Error(`不支持的合约类型: ${contractInfo.type}`);
      }
    } catch (error: any) {
      console.error(`从DEX获取${chainName}价格失败:`, error.message || String(error));
      
      // 尝试从Chainlink获取
      try {
        if (CHAIN_CONFIGS[chainName].chainlinkFeeds?.ethUsd) {
          console.log(`尝试从Chainlink获取${chainName}的ETH价格...`);
          return await this.getEthUsdPriceFromChainlink(chainName);
        }
      } catch (chainlinkError: any) {
        console.error(`从Chainlink获取${chainName}价格失败:`, chainlinkError.message || String(chainlinkError));
      }
      
      // 尝试从API获取
      try {
        console.log(`尝试从API获取${chainName}的ETH价格...`);
        return await this.getPriceFromAPI(chainName);
      } catch (apiError: any) {
        console.error(`从API获取${chainName}价格失败:`, apiError.message || String(apiError));
      }
      
      // 最后尝试从CoinGecko获取
      try {
        console.log(`尝试从CoinGecko获取${chainName}的ETH价格...`);
        return await this.getBackupPrice(chainName);
      } catch (backupError: any) {
        // 返回缓存的价格作为最后的选择
        const cachedPrice = this.priceCache.get(cacheKey);
        if (cachedPrice !== undefined) {
          console.log(`[过期缓存] ${chainName} ETH/USDT: $${cachedPrice.toFixed(2)}`);
          return cachedPrice;
        }
        
        throw new Error(`无法获取${chainName}的ETH/USDT价格，所有方法均失败`);
      }
    }
  }

  // 新增：从不同API获取价格
  private async getPriceFromAPI(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName];
    const apiConfig = config.apiConfig;
    
    if (!apiConfig) {
      throw new Error(`${chainName} 未配置API信息`);
    }
    
    // 1. 尝试使用Moralis API
    if (apiConfig.moralis) {
      try {
        return await this.getPriceFromMoralis(chainName);
      } catch (error) {
        console.error(`Moralis API获取${chainName}价格失败:`, error);
      }
    }
    
    // 2. 尝试使用SushiSwap API
    if (apiConfig.sushiswap) {
      try {
        return await this.getPriceFromSushiSwap(chainName);
      } catch (error) {
        console.error(`SushiSwap API获取${chainName}价格失败:`, error);
      }
    }
    
    // 3. 尝试使用UniswapV3 Graph API
    if (apiConfig.uniswapGraph) {
      try {
        return await this.getPriceFromUniswapGraph(chainName);
      } catch (error) {
        console.error(`UniswapV3 Graph API获取${chainName}价格失败:`, error);
      }
    }
    
    // 如果所有API都失败，抛出错误
    throw new Error(`所有API尝试获取${chainName}价格均失败`);
  }
  
  // 从Moralis API获取价格
  private async getPriceFromMoralis(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName].apiConfig?.moralis;
    if (!config) {
      throw new Error(`${chainName} 未配置Moralis API信息`);
    }
    
    console.log(`使用Moralis API获取${chainName}上的ETH价格`);
    
    const url = `${API_ENDPOINTS.moralis}/erc20/${config.tokenAddress}/price`;
    const headers = {
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjRmODk0NWEzLTE2YTctNDE2YS04MDQ1LTdhZDEyMDUxM2E4OSIsIm9yZ0lkIjoiNDQyNjk4IiwidXNlcklkIjoiNDU1NDc1IiwidHlwZUlkIjoiMWQ2YTJjZmMtZjI4ZC00ZjU1LTliMWYtMWRlMGM4YTE5MWZlIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDUwMzI5OTIsImV4cCI6NDkwMDc5Mjk5Mn0.XfkOG0lsS-KOjbDUCFUu7Gy7hn6bGC8kDIrRX6AOX1s": API_KEYS.moralis,
      "Accept": "application/json"
    };
    
    const response = await axios.get(url, { 
      headers,
      params: { chain: config.chain }
    });
    
    if (!response.data || !response.data.usdPrice) {
      throw new Error(`Moralis API返回无效数据`);
    }
    
    const price = response.data.usdPrice;
    console.log(`📈 Moralis API ${chainName} ETH/USD价格: $${price}`);
    
    // 保存到缓存
    const cacheKey = `${chainName}:ETH/USDT`;
    this.priceCache.set(cacheKey, price);
    this.lastPriceUpdate.set(cacheKey, Date.now());
    
    return price;
  }
  
  // 从SushiSwap API获取价格
  private async getPriceFromSushiSwap(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName].apiConfig?.sushiswap;
    if (!config) {
      throw new Error(`${chainName} 未配置SushiSwap API信息`);
    }
    
    console.log(`使用SushiSwap API获取${chainName}上的ETH/USDT价格`);
    
    // SushiSwap API请求
    const url = `${API_ENDPOINTS.sushiswap}/api/v1/pairs/${config.pairAddress}`;
    const response = await axios.get(url);
    
    if (!response.data || !response.data.token0Price || !response.data.token1Price) {
      throw new Error(`SushiSwap API返回无效数据`);
    }
    
    // 获取ETH价格 (取决于ETH是token0还是token1)
    const poolConfig = CHAIN_CONFIGS[chainName].ethUsdtPool;
    const price = poolConfig.order.eth === 0 ? 
      1 / Number(response.data.token0Price) : 
      1 / Number(response.data.token1Price);
    
    console.log(`📈 SushiSwap API ${chainName} ETH/USDT价格: $${price}`);
    
    // 保存到缓存
    const cacheKey = `${chainName}:ETH/USDT`;
    this.priceCache.set(cacheKey, price);
    this.lastPriceUpdate.set(cacheKey, Date.now());
    
    return price;
  }
  
  // 从UniswapV3 Graph API获取价格
  private async getPriceFromUniswapGraph(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName].apiConfig?.uniswapGraph;
    if (!config) {
      throw new Error(`${chainName} 未配置UniswapV3 Graph API信息`);
    }
    
    if (!config.poolId) {
      throw new Error(`${chainName} 未配置UniswapV3 Graph API的poolId`);
    }
    
    console.log(`使用UniswapV3 Graph API获取${chainName}上的ETH/USDT价格`);
    
    // GraphQL查询
    const query = `{
      pool(id: "${config.poolId.toLowerCase()}") {
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
        token0Price
        token1Price
      }
    }`;
    
    const response = await axios.post(
      API_ENDPOINTS.uniswapGraph,
      { query }
    );
    
    if (!response.data || !response.data.data || !response.data.data.pool) {
      throw new Error(`UniswapV3 Graph API返回无效数据`);
    }
    
    const pool = response.data.data.pool;
    const poolConfig = CHAIN_CONFIGS[chainName].ethUsdtPool;
    
    // 根据ETH在池中的位置计算价格
    const price = poolConfig.order.eth === 0 ? 
      Number(pool.token1Price) : 
      Number(pool.token0Price);
    
    console.log(`📈 UniswapV3 Graph API ${chainName} ETH/USDT价格: $${price}`);
    
    // 保存到缓存
    const cacheKey = `${chainName}:ETH/USDT`;
    this.priceCache.set(cacheKey, price);
    this.lastPriceUpdate.set(cacheKey, Date.now());
    
    return price;
  }

  // 从UniswapV2类型池获取价格
  private async getEthUsdtPriceFromV2Pool(chainName: string): Promise<number> {
    const contract = this.pairContracts.get(chainName);
    if (!contract) {
      throw new Error(`${chainName} 合约未初始化`);
    }
    
    const provider = this.providers.get(chainName);
    if (!provider) {
      throw new Error(`${chainName} 提供者未初始化`);
    }
    
    // 获取当前区块号，使用具体区块号而非latest
    const blockNumber = await provider.getBlockNumber();
    console.log(`🔍 ${chainName} 当前区块号: ${blockNumber}`);
    
    // 获取储备量
    console.log(`📊 获取 ${chainName} 上合约 ${contract.address} 的储备量 (区块 ${blockNumber - 5})`);
    const reserves = await contract.getReserves({ blockTag: blockNumber - 5 });
    
    // 获取链配置
    const config = CHAIN_CONFIGS[chainName];
    
    // 确定ETH和USDT的储备量
    const ethReserve = BigInt(
      config.ethUsdtPool.order.eth === 0 ? 
      reserves[0].toString() : reserves[1].toString()
    );
    
    const usdtReserve = BigInt(
      config.ethUsdtPool.order.usdt === 0 ? 
      reserves[0].toString() : reserves[1].toString()
    );
    
    if (ethReserve === 0n) {
      throw new Error(`${chainName} ETH储备量为零`);
    }
    
    // 显示原始储备量数据用于调试
    console.log(`${chainName} 原始数据 - reserve0: ${reserves[0]}, reserve1: ${reserves[1]}`);
    console.log(`${chainName} 解析后 - ETH储备: ${ethReserve}, USDT储备: ${usdtReserve}`);
    
    // 计算价格，考虑不同代币的小数位数
    const ethDecimals = config.ethUsdtPool.decimals.eth;
    const usdtDecimals = config.ethUsdtPool.decimals.usdt;
    const decimalAdjustment = 10n ** BigInt(ethDecimals - usdtDecimals);
    
    // ETH/USDT价格 = USDT储备 / (ETH储备 * 10^(ETH小数位-USDT小数位))
    const price = Number(usdtReserve) / (Number(ethReserve) / Number(decimalAdjustment));
    
    // 保存到缓存中
    const cacheKey = `${chainName}:ETH/USDT`;
    this.priceCache.set(cacheKey, price);
    this.lastPriceUpdate.set(cacheKey, Date.now());
    
    console.log(`💰 ${chainName} ETH/USDT价格(V2): $${price.toFixed(2)}`);
    return price;
  }

  // 从UniswapV3类型池获取价格
  private async getEthUsdtPriceFromV3Pool(chainName: string): Promise<number> {
    const contract = this.pairContracts.get(chainName);
    if (!contract) {
      throw new Error(`${chainName} 合约未初始化`);
    }
    
    // 获取当前slot0数据
    const slot0 = await contract.slot0();
    const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96.toString());
    
    // 获取链配置
    const config = CHAIN_CONFIGS[chainName];
    
    // 计算价格
    // 在UniswapV3中，sqrtPriceX96是sqrt(price) * 2^96
    // price = (sqrtPriceX96 / 2^96)^2
    const Q96 = 2n ** 96n;
    
    let price: number;
    
    if (config.ethUsdtPool.order.eth === 0) {
      // ETH是token0, price = token1/token0
      const priceX192 = (sqrtPriceX96 * sqrtPriceX96);
      const shiftedPrice = priceX192 / Q96 / Q96;
      
      // 调整小数位数
      const ethDecimals = config.ethUsdtPool.decimals.eth;
      const usdtDecimals = config.ethUsdtPool.decimals.usdt;
      const decimalAdjustment = 10n ** BigInt(usdtDecimals - ethDecimals);
      
      price = Number(shiftedPrice) * Number(decimalAdjustment);
    } else {
      // ETH是token1, price = 1/(token1/token0) = token0/token1
      const priceX192 = (Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
      
      // 调整小数位数
      const ethDecimals = config.ethUsdtPool.decimals.eth;
      const usdtDecimals = config.ethUsdtPool.decimals.usdt;
      const decimalAdjustment = 10n ** BigInt(ethDecimals - usdtDecimals);
      
      price = Number(priceX192) / Number(decimalAdjustment);
    }
    
    // 保存到缓存中
    const cacheKey = `${chainName}:ETH/USDT`;
    this.priceCache.set(cacheKey, price);
    this.lastPriceUpdate.set(cacheKey, Date.now());
    
    console.log(`💰 ${chainName} ETH/USDT价格(V3): $${price.toFixed(2)}`);
    return price;
  }

  // 从Chainlink获取ETH/USD价格
  private async getEthUsdPriceFromChainlink(chainName: string): Promise<number> {
    if (!CHAIN_CONFIGS[chainName].chainlinkFeeds?.ethUsd) {
      throw new Error(`${chainName}没有配置Chainlink ETH/USD喂价合约`);
    }
    
    const contract = this.chainlinkContracts.get(chainName);
    if (!contract) {
      throw new Error(`${chainName} Chainlink合约未初始化`);
    }
    
    // 获取最新价格
    const latestAnswer = await contract.latestAnswer();
    
    // 获取小数位数
    const decimals = await contract.decimals();
    
    // 计算价格
    const price = Number(latestAnswer) / (10 ** Number(decimals));
    
    // 保存到缓存中
    const cacheKey = `${chainName}:ETH/USDT`;
    this.priceCache.set(cacheKey, price);
    this.lastPriceUpdate.set(cacheKey, Date.now());
    
    console.log(`💰 ${chainName} ETH/USD价格(Chainlink): $${price.toFixed(2)}`);
    return price;
  }

  // 使用CoinGecko API作为备用价格源
  private async getBackupPrice(chainName: string): Promise<number> {
    console.log(`🔄 尝试从CoinGecko获取${chainName}上的ETH/USDT价格`);
    
    // 返回缓存的价格作为最后的选择，如果有的话
    const cacheKey = `${chainName}:ETH/USDT`;
    const cachedPrice = this.priceCache.get(cacheKey);
    if (cachedPrice !== undefined) {
      const now = Date.now();
      const lastUpdate = this.lastPriceUpdate.get(cacheKey) || 0;
      const ageMinutes = (now - lastUpdate) / 60000;
      
      console.log(`找到缓存价格: $${cachedPrice.toFixed(2)} (${ageMinutes.toFixed(1)}分钟前)`);
      
      // 如果缓存很新（5分钟内），直接返回
      if (ageMinutes < 5) {
        return cachedPrice;
      }
    }
    
    try {
      // 从CoinGecko获取ETH价格
      const response = await axios.get(`${COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=usd`);
      const ethPrice = response.data.ethereum.usd;
      
      if (!ethPrice) {
        throw new Error('无法从CoinGecko获取ETH价格');
      }
      
      console.log(`📈 CoinGecko ETH/USD价格: $${ethPrice}`);
      
      // 保存到缓存中
      this.priceCache.set(cacheKey, ethPrice);
      this.lastPriceUpdate.set(cacheKey, Date.now());
      
      return ethPrice;
    } catch (error: any) {
      console.error(`从CoinGecko获取价格失败:`, error.message || String(error));
      
      // 如果有过期缓存，作为最后的选择返回它
      if (cachedPrice !== undefined) {
        console.log(`返回过期的缓存价格: $${cachedPrice.toFixed(2)}`);
        return cachedPrice;
      }
      
      throw error;
    }
  }

  // 批量获取所有链上的ETH/USDT价格
  public async batchGetEthUsdtPrices(): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    const chains = Object.keys(CHAIN_CONFIGS);
    
    // 并行请求所有链的价格
    const pricePromises = chains.map(async (chainName) => {
      try {
        console.log(`获取 ${chainName} 价格...`);
        const price = await this.getEthUsdtPrice(chainName);
        return { chainName, price, success: true };
      } catch (error: any) {
        console.error(`批量查询${chainName}价格失败:`, error.message || String(error));
        return { chainName, price: 0, success: false };
      }
    });
    
    // 等待所有请求完成
    const priceResults = await Promise.all(pricePromises);
    
    // 处理结果
    for (const result of priceResults) {
      if (result.success) {
        results.set(result.chainName, result.price);
      }
    }
    
    // 如果没有获取到任何价格，尝试从CoinGecko获取
    if (results.size === 0) {
      try {
        const coinGeckoPrice = await this.getBackupPrice('ethereum');
        results.set('coingecko', coinGeckoPrice);
      } catch (error) {
        console.error('无法从任何来源获取价格');
      }
    }
    
    return results;
  }

  // 计算价格差异
  public calculatePriceSpread(price1: number, price2: number): number {
    const min = Math.min(price1, price2);
    return min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
  }
}

// 测试函数
async function testRealEthUsdtPrices(): Promise<void> {
  console.log('===== ETH/USDT价格查询测试（真实RPC - 优化版v2）=====');
  console.log('🔍 特性: 多类型DEX支持、Chainlink集成、强化合约验证、多级容错');
  
  // 初始化价格监控器
  console.log('\n🔄 初始化价格监控器...');
  const priceMonitor = new RealPriceMonitor();
  
  // 等待初始化完成
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n✅ 初始化完成');
  console.log('📊 开始测试批量查询ETH/USDT价格...\n');
  
  try {
    // 1. 测试批量获取所有链上的价格
    console.log('测试1: 批量获取所有链上的ETH/USDT价格');
    const allPrices = await priceMonitor.batchGetEthUsdtPrices();
    
    console.log('\n批量查询结果:');
    if (allPrices.size === 0) {
      console.log('❌ 未获取到任何价格数据');
    } else {
      console.log('链名\t\t数据源\t\tETH/USDT价格');
      console.log('---------------------------------------------');
      
      // 遍历所有链，显示价格和数据源
      for (const [chainName, price] of allPrices.entries()) {
        const contractInfo = priceMonitor['verifiedContracts'].get(chainName);
        let dataSource = "未知";
        
        if (contractInfo?.verified) {
          switch (contractInfo.type) {
            case PoolType.UNISWAP_V2:
              dataSource = "UniswapV2";
              break;
            case PoolType.SUSHISWAP:
              dataSource = "SushiSwap";
              break;
            case PoolType.UNISWAP_V3:
              dataSource = "UniswapV3";
              break;
            default:
              dataSource = "链上合约";
          }
        } else if (chainName === 'coingecko') {
          dataSource = "CoinGecko";
        } else {
          dataSource = "备用源";
        }
        
        console.log(`${chainName}\t\t${dataSource}\t\t$${price.toFixed(2)}`);
      }
      console.log('✅ 批量查询成功\n');
    }
    
    // 2. 测试单个链的价格查询
    console.log('测试2: 单独查询每条链的ETH/USDT价格');
    const chains = Object.keys(CHAIN_CONFIGS);
    
    for (const chain of chains) {
      try {
        const price = await priceMonitor.getEthUsdtPrice(chain);
        console.log(`${chain}: $${price.toFixed(2)}`);
      } catch (error: any) {
        console.log(`❌ ${chain}查询失败: ${error.message || String(error)}`);
      }
    }
    console.log('✅ 单链查询测试完成\n');
    
    // 3. 测试价差计算
    console.log('测试3: 计算链间价格差异');
    
    // 筛选出有效价格
    const validPrices = new Map<string, number>();
    allPrices.forEach((price, chainName) => {
      if (price > 0) validPrices.set(chainName, price);
    });
    
    if (validPrices.size < 2) {
      console.log('⚠️ 有效价格不足两个，无法计算价差');
    } else {
      // 创建一个价格矩阵来显示所有链之间的价差
      const validChains = Array.from(validPrices.keys());
      const priceMatrix = [];
      
      for (let i = 0; i < validChains.length; i++) {
        for (let j = i + 1; j < validChains.length; j++) {
          const chain1 = validChains[i];
          const chain2 = validChains[j];
          
          const price1 = validPrices.get(chain1) as number;
          const price2 = validPrices.get(chain2) as number;
          
          // 计算价差百分比
          const spread = priceMonitor.calculatePriceSpread(price1, price2);
          
          priceMatrix.push({
            链对: `${chain1} vs ${chain2}`,
            价格1: `$${price1.toFixed(2)}`,
            价格2: `$${price2.toFixed(2)}`,
            价差: `${spread.toFixed(4)}%`,
            异常: spread > 0.5 ? '⚠️' : '✅' // 真实市场价差一般很小
          });
        }
      }
      
      // 显示价差矩阵
      console.table(priceMatrix);
      console.log('✅ 价差计算测试完成\n');
    }
    
    // 4. 测试缓存功能
    console.log('测试4: 验证缓存功能');
    console.log('再次查询以验证缓存...');
    
    // 选择一个成功的链
    const successChain = Array.from(validPrices.keys())[0] || 'ethereum';
    
    console.time('首次查询');
    await priceMonitor.getEthUsdtPrice(successChain);
    console.timeEnd('首次查询');
    
    console.time('缓存查询');
    await priceMonitor.getEthUsdtPrice(successChain);
    console.timeEnd('缓存查询');
    
    console.log('✅ 缓存功能测试完成');
  } catch (error: any) {
    console.error('❌ 测试过程中出现错误:', error.message || String(error));
  } finally {
    console.log('\n===== 测试结束 =====');
  }
}

// 执行测试
testRealEthUsdtPrices().catch(error => {
  console.error('❌ 测试执行失败:', error);
}); 