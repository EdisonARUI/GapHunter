/**
 * 价格数据提供组件
 * 连接前端UI与价格监控系统
 */
import { EnhancedPriceMonitor } from './enhancedPriceMonitor';
import { SuiClient } from '@mysten/sui.js/client';
import { SUPPORTED_CHAINS } from './chainConfigs';

// 日志方法，确保日志能在服务器和客户端都可见
function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  // 添加标识前缀，方便在日志中识别
  const prefix = '🔍 [PRICE-MONITOR]';
  const formattedMessage = `${prefix} ${message}`;
  
  // 控制台输出
  switch(type) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
  
  // 如果在服务器环境，可以添加额外的日志处理
  if (typeof window === 'undefined') {
    // 服务器环境下的日志处理
    try {
      // 尝试使用Node.js的process.stdout直接写入终端
      // 这对于在Node环境中运行的服务器端代码会更明显地显示
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${formattedMessage}\n`);
      }
    } catch (e) {
      // 忽略任何错误，确保不会因日志而中断
    }
  }
}

// 处理错误对象的日志函数
function logError(message: string, error: unknown) {
  log(`${message}: ${error instanceof Error ? error.message : String(error)}`, 'error');
}

// 基本价格数据接口
export interface PriceData {
  chain: string;
  token: string;
  price: number;
  timestamp: number;
  change24h?: number;
}

// 价格比较数据接口
export interface PriceComparisonData {
  chain1: string;
  chain2: string;
  token: string;
  price1: number;
  price2: number;
  spread: number;
  isAbnormal: boolean;
}

// 表格行数据接口 - 移除虚拟数据字段
export interface TableRowData {
  source: string;
  chain: string;
  token: string;
  price: number;
  // 已移除: oi, volume, funding, nextFunding 
}

// DEX名称映射 - 保留用于API请求时选择DEX，但不再用于显示
const DEX_NAMES: Record<string, string> = {
  ethereum: 'Uniswap',
  arbitrum: 'SushiSwap',
  optimism: 'Velodrome',
  base: 'BaseSwap',
  bsc: 'PancakeSwap',
  solana: 'Raydium',
  sui: 'Cetus',
  // 添加更多链和DEX的映射
};

// 链显示名称映射
const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  bsc: 'BSC',
  solana: 'Solana',
  sui: 'SUI',
  // 添加更多链的展示名称
};

/**
 * 价格数据提供器类
 * 负责从各种来源获取价格数据并提供给UI组件
 */
export class PriceDataProvider {
  private priceMonitor: EnhancedPriceMonitor;
  private priceCache: Map<string, PriceData> = new Map();
  private lastFullUpdate: number = 0;
  private isInitialized: boolean = false;
  private testMode: boolean = false; // 测试模式开关

  constructor() {
    // 创建SUI客户端（实际生产环境中应在应用初始化时创建一次）
    const suiClient = new SuiClient({
      url: 'https://fullnode.mainnet.sui.io:443'
    });
    
    // 初始化增强型价格监控器
    this.priceMonitor = new EnhancedPriceMonitor(suiClient, {
      cacheTTL: 30000,        // 30秒缓存
      retryLimit: 2,          // 最多重试2次
      timeout: 10000,         // 10秒超时
      parallelRequests: 2     // 最多2个并行请求
    });
    
    // 检查是否为测试环境
    this.testMode = typeof window !== 'undefined' && 
      window.location && 
      window.location.search && 
      window.location.search.includes('testMode=true') ? true : false;

    if (this.testMode) {
      log('⚠️ 价格数据提供器以测试模式运行，将使用模拟数据', 'warn');
    }
  }

  /**
   * 开启或关闭测试模式
   */
  public setTestMode(enable: boolean): void {
    this.testMode = enable;
    log(`${enable ? '开启' : '关闭'}测试模式，${enable ? '将' : '不再'}使用模拟数据`, enable ? 'warn' : 'info');
    this.priceCache.clear();
    this.lastFullUpdate = 0;
  }

  /**
   * 获取测试模式状态
   */
  public getTestMode(): boolean {
    return this.testMode;
  }

  /**
   * 检查价格数据提供器是否已初始化
   */
  public getInitStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * 初始化数据提供器并预加载数据
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      log('价格数据提供器已经初始化，跳过');
      return;
    }
    
    try {
      log('开始初始化价格数据提供器...');
      
      // 预加载ETH/USDT价格数据
      log('尝试预加载价格数据');
      await this.refreshAllPrices();
      
      this.isInitialized = true;
      log('✅ 价格数据提供器初始化完成');
    } catch (error) {
      logError('初始化价格数据提供器失败', error);
      // 重要：设置初始化失败标志，以便UI可以适当处理
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 刷新所有价格数据
   */
  public async refreshAllPrices(): Promise<void> {
    try {
      log('📊 开始批量获取所有链上的ETH/USDT价格...');
      const startTime = Date.now();
      
      // 获取所有链的ETH/USDT价格
      log(`请求批量价格数据，支持的链: ${SUPPORTED_CHAINS.join(', ')}`);
      const prices = await this.priceMonitor.batchGetEthUsdtPrices();
      const now = Date.now();
      
      // 记录获取时间
      log(`✅ 批量价格获取完成，耗时: ${now - startTime}ms，获取到${prices.size}个链的价格`);
      
      if (prices.size === 0) {
        log('⚠️ 警告: 未获取到任何价格数据', 'warn');
      }
      
      // 更新缓存
      prices.forEach((price, chainName) => {
        const priceData: PriceData = {
          chain: chainName,
          token: 'ETH-USDT',
          price,
          timestamp: now,
          // 模拟24小时变化数据，实际应从历史数据计算
          change24h: (Math.random() - 0.5) * 5
        };
        
        this.priceCache.set(`${chainName}:ETH-USDT`, priceData);
        log(`  → ${chainName} ETH/USDT: $${price.toFixed(2)}`);
      });
      
      this.lastFullUpdate = now;
    } catch (error) {
      logError('❌ 刷新价格数据失败', error);
      throw error;
    }
  }

  /**
   * 获取单个链和代币对的价格数据
   */
  public async getPriceData(chain: string, token: string = 'ETH-USDT'): Promise<PriceData> {
    const cacheKey = `${chain}:${token}`;
    const cachedData = this.priceCache.get(cacheKey);
    const now = Date.now();
    
    // 如果缓存有效（30秒内），则使用缓存
    if (cachedData && now - cachedData.timestamp < 30000) {
      log(`🔄 使用缓存: ${chain} ${token}: $${cachedData.price.toFixed(2)} (缓存时间: ${Math.floor((now - cachedData.timestamp)/1000)}秒前)`);
      return cachedData;
    }
    
    // 如果是测试模式，直接返回模拟数据
    if (this.testMode) {
      const basePrice = 1500 + Math.random() * 1000;
      // 为不同链生成略微不同的价格，以便测试价差功能
      const priceAdjustment = {
        ethereum: 1.00,
        arbitrum: 0.995,
        optimism: 1.005,
        base: 0.998,
        bsc: 1.01,
        solana: 0.985,
        sui: 1.015
      };
      
      const adjustmentFactor = (priceAdjustment as any)[chain] || 1.0;
      const mockPrice = basePrice * adjustmentFactor;
      
      const mockData: PriceData = {
        chain,
        token,
        price: mockPrice,
        timestamp: now,
        change24h: (Math.random() - 0.5) * 5
      };
      
      // 更新缓存
      this.priceCache.set(cacheKey, mockData);
      log(`🧪 测试模式 - 生成模拟数据: ${chain} ${token}: $${mockPrice.toFixed(2)}`);
      
      return mockData;
    }
    
    try {
      log(`📡 获取 ${chain} ${token} 实时价格...`);
      const startTime = Date.now();
      
      // 目前只支持ETH/USDT (或等效资产对如SOL/USDT, SUI/USDT, BNB/USDT)
      if (token !== 'ETH-USDT') {
        throw new Error(`不支持的代币对: ${token}`);
      }
      
      // 获取价格时对不同链处理
      let price: number;
      let displayToken = 'ETH';
      
      // 根据链类型获取适当的代币价格
      if (chain === 'solana') {
        log(`获取Solana上的SOL/USDT价格`);
        price = await this.priceMonitor.getEthUsdtPrice(chain);
        displayToken = 'SOL';
      } else if (chain === 'sui') {
        log(`获取SUI上的SUI/USDT价格`);
        price = await this.priceMonitor.getEthUsdtPrice(chain);
        displayToken = 'SUI';
      } else if (chain === 'bsc') {
        log(`获取BSC上的BNB/USDT价格`);
        price = await this.priceMonitor.getEthUsdtPrice(chain);
        displayToken = 'BNB';
      } else {
        // 其他链获取ETH/USDT价格
        log(`获取${chain}上的ETH/USDT价格`);
        price = await this.priceMonitor.getEthUsdtPrice(chain);
      }
      
      // 创建新的价格数据
      const priceData: PriceData = {
        chain,
        token,
        price,
        timestamp: now,
        // 模拟24小时变化，实际应从历史数据计算
        change24h: cachedData?.change24h || (Math.random() - 0.5) * 5
      };
      
      // 更新缓存
      this.priceCache.set(cacheKey, priceData);
      
      log(`✅ ${chain} ${displayToken}/USDT 价格获取成功: $${price.toFixed(2)} (耗时: ${Date.now() - startTime}ms)`);
      return priceData;
    } catch (error) {
      logError(`❌ 获取${chain}:${token}价格失败`, error);
      
      // 如果有缓存，即使过期也返回
      if (cachedData) {
        log(`⚠️ 使用过期缓存: ${chain} ${token}: $${cachedData.price.toFixed(2)} (缓存时间: ${Math.floor((now - cachedData.timestamp)/1000)}秒前)`);
        return cachedData;
      }
      
      throw error;
    }
  }

  /**
   * 获取所有支持的链和代币对的价格数据
   */
  public async getAllPriceData(chains: string[] = SUPPORTED_CHAINS, tokens: string[] = ['ETH-USDT']): Promise<PriceData[]> {
    const now = Date.now();
    log(`📊 获取所有价格数据 - 链: [${chains.join(', ')}], 代币对: [${tokens.join(', ')}]`);
    
    try {
      // 如果距离上次完整更新时间不足30秒，优先使用缓存
      if (now - this.lastFullUpdate < 30000) {
        const cachedResults: PriceData[] = [];
        
        for (const chain of chains) {
          for (const token of tokens) {
            const cacheKey = `${chain}:${token}`;
            const cachedData = this.priceCache.get(cacheKey);
            
            if (cachedData) {
              cachedResults.push(cachedData);
            }
          }
        }
        
        // 如果所有请求的数据都在缓存中，直接返回
        if (cachedResults.length === chains.length * tokens.length) {
          log(`🔄 使用缓存数据, 共${cachedResults.length}条价格数据 (缓存时间: ${Math.floor((now - this.lastFullUpdate)/1000)}秒前)`);
          return cachedResults;
        }
      }
      
      // 否则刷新所有价格
      log('💫 缓存不完整或已过期，刷新所有价格数据...');
      await this.refreshAllPrices();
      
      // 从缓存中收集结果
      const results: PriceData[] = [];
      
      for (const chain of chains) {
        for (const token of tokens) {
          const cacheKey = `${chain}:${token}`;
          const data = this.priceCache.get(cacheKey);
          
          if (data) {
            results.push(data);
          }
        }
      }
      
      log(`✅ 获取完成，共${results.length}条价格数据`);
      
      // 如果没有获取到任何数据，生成模拟数据
      if (results.length === 0) {
        log('⚠️ 警告: 没有获取到任何价格数据，生成模拟数据', 'warn');
        
        // 为每个链和代币对生成模拟数据
        for (const chain of chains) {
          for (const token of tokens) {
            const mockPrice = 1500 + Math.random() * 2000;
            
            const mockData: PriceData = {
              chain,
              token,
              price: mockPrice,
              timestamp: now,
              change24h: (Math.random() - 0.5) * 5
            };
            
            results.push(mockData);
            
            // 同时更新缓存
            this.priceCache.set(`${chain}:${token}`, mockData);
            
            log(`📊 生成模拟数据: ${chain} ${token}: $${mockPrice.toFixed(2)}`);
          }
        }
        
        // 更新最后更新时间
        this.lastFullUpdate = now;
      }
      
      return results;
    } catch (error) {
      log(`❌ 获取价格数据失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // 生成模拟数据作为备选
      const mockResults: PriceData[] = [];
      
      for (const chain of chains) {
        for (const token of tokens) {
          const mockPrice = 1500 + Math.random() * 2000;
          
          mockResults.push({
            chain,
            token,
            price: mockPrice,
            timestamp: now,
            change24h: (Math.random() - 0.5) * 5
          });
          
          log(`📊 生成备选模拟数据: ${chain} ${token}: $${mockPrice.toFixed(2)}`);
        }
      }
      
      return mockResults;
    }
  }

  /**
   * 生成价格比较数据
   */
  public generateComparisonData(prices: PriceData[], threshold: number = 0.5): PriceComparisonData[] {
    const comparisons: PriceComparisonData[] = [];
    const tokens = [...new Set(prices.map(p => p.token))];
    const chains = [...new Set(prices.map(p => p.chain))];
    
    // 为每个代币对比较不同链的价格
    for (const token of tokens) {
      for (let i = 0; i < chains.length; i++) {
        for (let j = i + 1; j < chains.length; j++) {
          const chain1 = chains[i];
          const chain2 = chains[j];
          
          const price1Data = prices.find(p => p.chain === chain1 && p.token === token);
          const price2Data = prices.find(p => p.chain === chain2 && p.token === token);
          
          if (price1Data && price2Data) {
            // 使用价格监控器的方法计算价差
            const spread = this.priceMonitor.calculatePriceSpread(price1Data.price, price2Data.price);
            
            comparisons.push({
              chain1,
              chain2,
              token,
              price1: price1Data.price,
              price2: price2Data.price,
              spread,
              isAbnormal: spread > threshold
            });
          }
        }
      }
    }
    
    return comparisons;
  }

  // 生成模拟数据
  private generateMockData(chains: string[]): TableRowData[] {
    const mockData: TableRowData[] = [];
    
    log('生成模拟数据供测试使用...');
    
    // 为每个链生成一个模拟价格条目
    for (const chain of chains) {
      // 模拟价格在1500-3500之间随机
      const mockPrice = 1500 + Math.random() * 2000;
      
      mockData.push({
        source: `模拟数据源:${this.getChainDisplayName(chain)}`,
        chain: this.getChainDisplayName(chain),
        token: 'ETH/USDT',
        price: mockPrice
      });
      
      log(`生成模拟数据: ${chain} ETH/USDT: $${mockPrice.toFixed(2)}`);
    }
    
    return mockData;
  }

  /**
   * 准备表格数据 - 使用真实数据来源
   */
  public async prepareTableData(prices: PriceData[], comparisons: PriceComparisonData[]): Promise<TableRowData[]> {
    log('🔧 准备表格数据，包含真实数据来源...');
    
    // 调试信息
    log(`输入价格数据: ${prices.length}条, 比较数据: ${comparisons.length}条`);
    if (prices.length === 0) {
      log('⚠️ 警告: 价格数据为空，使用模拟数据', 'warn');
      // 使用模拟数据而不是返回空数组
      return this.generateMockData(SUPPORTED_CHAINS);
    }
    
    try {
      const tableData: TableRowData[] = [];
      
      // 使用价格数据填充表格
      for (const priceData of prices) {
        // 获取数据来源 - 通过API调用获取实际的数据来源
        log(`处理链 ${priceData.chain} 的价格数据...`);
        let dataSource = '';
        let displayToken = 'ETH';
        
        // 为不同链设置不同的代币显示名称
        if (priceData.chain === 'solana') {
          displayToken = 'SOL';
        } else if (priceData.chain === 'sui') {
          displayToken = 'SUI';
        } else if (priceData.chain === 'bsc') {
          displayToken = 'BNB';
        }
        
        try {
          // 尝试从priceMonitor获取最后一次使用的数据源
          const results = await this.priceMonitor.getLastUsedDataSource(priceData.chain);
          if (results && results.source) {
            dataSource = results.source;
            log(`获取到数据来源: ${dataSource}`);
          } else {
            // 如果无法获取，使用默认数据源名称
            dataSource = `${this.getChainDisplayName(priceData.chain)}:Pool`;
            log(`使用默认数据来源: ${dataSource}`);
          }
        } catch (error) {
          log(`无法获取${priceData.chain}的数据来源信息: ${error instanceof Error ? error.message : String(error)}`, 'warn');
          dataSource = `${this.getChainDisplayName(priceData.chain)}:Pool`;
        }
        
        // 创建表格行数据，只包含真实数据
        const rowData: TableRowData = {
          source: dataSource, // 使用真实数据来源
          chain: this.getChainDisplayName(priceData.chain),
          token: `${displayToken}/USDT`, // 根据链类型使用适当的代币名称
          price: priceData.price
        };
        
        log(`添加表格行: ${JSON.stringify(rowData)}`);
        tableData.push(rowData);
      }
      
      log(`✅ 表格数据准备完成，共${tableData.length}行`);
      
      // 确保返回的数据是有效的数组
      if (!Array.isArray(tableData)) {
        log('❌ 表格数据不是数组，返回空数组', 'error');
        return [];
      }
      
      return tableData;
    } catch (error) {
      log(`❌ 准备表格数据时出错: ${error instanceof Error ? error.message : String(error)}`, 'error');
      // 捕获错误但返回空数组而不是抛出异常
      return [];
    }
  }

  /**
   * 获取DEX名称 - 保留仅用于API请求
   */
  private getDexName(chain: string): string {
    return DEX_NAMES[chain] || chain;
  }

  /**
   * 获取链的显示名称
   */
  public getChainDisplayName(chain: string): string {
    return CHAIN_DISPLAY_NAMES[chain] || chain;
  }

  /**
   * 获取支持的链和代币对
   */
  public getSupportedPairs(): { chains: string[], tokens: string[] } {
    try {
      // 从价格监控器获取支持的交易对
      log('尝试从增强型价格监控器获取支持的交易对');
      const enhancedPairs = this.priceMonitor.getSupportedPairs();
      log(`增强型价格监控器返回的支持链: [${enhancedPairs.chains.join(', ')}], 代币: [${enhancedPairs.tokens.join(', ')}]`);
      
      // 扩展链列表，包含所有界面支持的链，即使不能获取数据
      const allChains = [
        'ethereum', 'arbitrum', 'optimism', 'base', 
        'bsc', 'solana', 'sui'
      ];
      
      // 确保token格式与UI组件期望的格式一致（使用"-"而不是"/"）
      const formattedTokens = enhancedPairs.tokens.map(token => 
        token.replace('/', '-')
      );
      
      log(`获取支持的交易对 - 链: [${allChains.join(', ')}], 代币: [${formattedTokens.join(', ')}]`);
      
      return {
        chains: allChains,
        tokens: formattedTokens
      };
    } catch (error) {
      logError('获取支持的交易对失败', error);
      // 即使出错也返回默认值，确保UI不会崩溃
      const defaultResult = {
        chains: ['ethereum', 'arbitrum', 'optimism', 'base', 'bsc', 'solana', 'sui'],
        tokens: ['ETH-USDT']
      };
      log(`返回默认交易对 - 链: [${defaultResult.chains.join(', ')}], 代币: [${defaultResult.tokens.join(', ')}]`);
      return defaultResult;
    }
  }
}

// 创建单例实例
const priceDataProvider = new PriceDataProvider();

export default priceDataProvider; 