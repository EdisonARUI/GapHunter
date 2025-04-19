/**
 * API数据源
 */
import axios from 'axios';
import { PriceDataSource } from '../interfaces';
import { CHAIN_CONFIGS } from '../chainConfigs';

// API端点配置
const API_ENDPOINTS = {
  moralis: "https://deep-index.moralis.io/api/v2",
  sushiswap: "https://api.sushi.com",
  uniswapGraph: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
};

// API数据源类
export class ApiDataSource implements PriceDataSource {
  public readonly name = 'API服务';
  public readonly priority = 3; // 第三优先级

  private apiKeys: Record<string, string>;

  constructor(apiKeys: Record<string, string> = {}) {
    this.apiKeys = apiKeys;
  }

  /**
   * 实现PriceDataSource接口的getPrice方法
   */
  public async getPrice(chainName: string): Promise<number> {
    if (!CHAIN_CONFIGS[chainName]) {
      throw new Error(`不支持的链: ${chainName}`);
    }
    
    const config = CHAIN_CONFIGS[chainName];
    const apiConfig = config.apiConfig;
    
    if (!apiConfig) {
      throw new Error(`${chainName}未配置API信息`);
    }
    
    // 尝试各种API
    let errors = [];
    
    // 1. 尝试使用Moralis API
    if (apiConfig.moralis) {
      try {
        const price = await this.getPriceFromMoralis(chainName);
        return price;
      } catch (error) {
        errors.push(`Moralis: ${error}`);
      }
    }
    
    // 2. 尝试使用SushiSwap API
    if (apiConfig.sushiswap) {
      try {
        const price = await this.getPriceFromSushiSwap(chainName);
        return price;
      } catch (error) {
        errors.push(`SushiSwap: ${error}`);
      }
    }
    
    // 3. 尝试使用UniswapV3 Graph API
    if (apiConfig.uniswapGraph) {
      try {
        const price = await this.getPriceFromUniswapGraph(chainName);
        return price;
      } catch (error) {
        errors.push(`UniswapGraph: ${error}`);
      }
    }
    
    // 所有API都失败
    throw new Error(`所有API尝试获取${chainName}价格均失败: ${errors.join(', ')}`);
  }

  /**
   * 从Moralis API获取价格
   */
  private async getPriceFromMoralis(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName].apiConfig?.moralis;
    if (!config) {
      throw new Error(`${chainName}未配置Moralis API信息`);
    }
    
    console.log(`使用Moralis API获取${chainName}上的ETH价格`);
    
    const url = `${API_ENDPOINTS.moralis}/erc20/${config.tokenAddress}/price`;
    const headers: Record<string, string> = {
      "Accept": "application/json"
    };
    
    // 添加API密钥（如果有）
    if (this.apiKeys.moralis) {
      headers["X-API-Key"] = this.apiKeys.moralis;
    } else {
      throw new Error('缺少Moralis API密钥');
    }
    
    const response = await axios.get(url, { 
      headers,
      params: { chain: config.chain }
    });
    
    if (!response.data || !response.data.usdPrice) {
      throw new Error(`Moralis API返回无效数据`);
    }
    
    const price = response.data.usdPrice;
    console.log(`${chainName} ETH/USD 从Moralis API获取的价格: $${price.toFixed(2)}`);
    
    return price;
  }

  /**
   * 从SushiSwap API获取价格
   */
  private async getPriceFromSushiSwap(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName].apiConfig?.sushiswap;
    if (!config) {
      throw new Error(`${chainName}未配置SushiSwap API信息`);
    }
    
    console.log(`使用SushiSwap API获取${chainName}上的ETH/USDT价格`);
    
    // SushiSwap API请求
    const url = `${API_ENDPOINTS.sushiswap}/api/v1/pairs/${config.pairAddress}`;
    const response = await axios.get(url);
    
    if (!response.data || !response.data.token0Price || !response.data.token1Price) {
      throw new Error(`SushiSwap API返回无效数据`);
    }
    
    // 获取ETH价格（取决于ETH是token0还是token1）
    const poolConfig = CHAIN_CONFIGS[chainName].ethUsdtPool;
    const price = poolConfig.order.eth === 0 ? 
      1 / Number(response.data.token0Price) : 
      1 / Number(response.data.token1Price);
    
    console.log(`${chainName} ETH/USDT 从SushiSwap API获取的价格: $${price.toFixed(2)}`);
    
    return price;
  }

  /**
   * 从UniswapV3 Graph API获取价格
   */
  private async getPriceFromUniswapGraph(chainName: string): Promise<number> {
    const config = CHAIN_CONFIGS[chainName].apiConfig?.uniswapGraph;
    if (!config) {
      throw new Error(`${chainName}未配置UniswapV3 Graph API信息`);
    }
    
    console.log(`使用UniswapV3 Graph API获取${chainName}上的ETH/USDT价格`);
    
    // 构造GraphQL查询
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
        sqrtPrice
        tick
      }
    }`;
    
    const response = await axios.post(API_ENDPOINTS.uniswapGraph, { query });
    
    if (!response.data || !response.data.data || !response.data.data.pool) {
      throw new Error(`UniswapV3 Graph API返回无效数据`);
    }
    
    const pool = response.data.data.pool;
    const sqrtPriceX96 = BigInt(pool.sqrtPrice);
    
    // 获取代币精度
    const token0Decimals = parseInt(pool.token0.decimals);
    const token1Decimals = parseInt(pool.token1.decimals);
    
    // 获取代币顺序（根据符号判断）
    const ethIndex = pool.token0.symbol.toUpperCase().includes('ETH') ? 0 : 1;
    const usdtIndex = 1 - ethIndex;
    
    // 计算价格（考虑代币顺序和精度）
    // sqrtPriceX96 = sqrt(price) * 2^96
    const sqrtPrice = Number(sqrtPriceX96) / Math.pow(2, 96);
    
    // price = sqrtPrice^2 * 10^(decimals1 - decimals0)
    let price = Math.pow(sqrtPrice, 2);
    
    // 调整代币顺序和精度
    if (ethIndex === 0) {
      // ETH是token0，price = USDT/ETH
      price = price * Math.pow(10, token1Decimals - token0Decimals);
    } else {
      // ETH是token1，price = ETH/USDT，需要取倒数
      price = (1 / price) * Math.pow(10, token0Decimals - token1Decimals);
    }
    
    console.log(`${chainName} ETH/USDT 从UniswapV3 Graph获取的价格: $${price.toFixed(2)}`);
    
    return price;
  }
} 