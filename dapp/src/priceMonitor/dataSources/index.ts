/**
 * 数据源管理器
 */
import { PriceDataSource, PriceResult } from '../interfaces';
import { DexContractSource } from './dexContractSource';
import { ChainlinkSource } from './chainlinkSource';
import { ApiDataSource } from './apiDataSource';
import { CoinGeckoSource } from './coinGeckoSource';

// 数据源管理器类
export class DataSourceManager {
  private sources: PriceDataSource[];
  
  constructor() {
    // 初始化数据源，按优先级排序
    this.sources = [
      new DexContractSource(),  // 优先使用DEX合约
      new ChainlinkSource(),    // 其次使用Chainlink预言机
      new ApiDataSource(),      // 再次使用API服务
      new CoinGeckoSource()     // 最后使用CoinGecko作为备用
    ].sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * 获取所有数据源
   */
  public getAllSources(): PriceDataSource[] {
    return this.sources;
  }
  
  /**
   * 从多个数据源依次尝试获取价格，直到成功
   * @param chainName 链名称
   * @returns Promise<PriceResult> 价格结果
   */
  public async getPrice(chainName: string): Promise<PriceResult> {
    let lastError: Error | null = null;
    
    // 按优先级依次尝试各数据源
    for (const source of this.sources) {
      try {
        console.log(`尝试从 ${source.name} 获取 ${chainName} 的价格...`);
        const price = await source.getPrice(chainName);
        
        return {
          chainName,
          price,
          timestamp: Date.now(),
          source: source.name,
          success: true
        };
      } catch (error: any) {
        console.error(`从 ${source.name} 获取 ${chainName} 价格失败:`, error);
        lastError = error;
        // 继续尝试下一个数据源
      }
    }
    
    // 所有数据源都失败
    return {
      chainName,
      price: 0,
      timestamp: Date.now(),
      source: 'none',
      success: false
    };
  }
  
  /**
   * 并行获取多个链上的价格
   * @param chainNames 链名称数组
   * @param maxParallel 最大并行请求数
   * @returns Promise<PriceResult[]> 价格结果数组
   */
  public async batchGetPrices(chainNames: string[], maxParallel: number = 4): Promise<PriceResult[]> {
    const results: PriceResult[] = [];
    
    // 限制并行请求数量
    const chunks = [];
    for (let i = 0; i < chainNames.length; i += maxParallel) {
      chunks.push(chainNames.slice(i, i + maxParallel));
    }
    
    // 按块处理请求
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(chainName => this.getPrice(chainName))
      );
      results.push(...chunkResults);
    }
    
    return results;
  }
} 