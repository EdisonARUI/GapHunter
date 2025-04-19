/**
 * 增强型价格监控器
 */
import { SuiClient } from '@mysten/sui.js/client';
import { DataSourceManager } from './dataSources';
import { 
  TaskConfig, 
  PriceResult, 
  PriceMonitorConfig 
} from './interfaces';
import { SUPPORTED_CHAINS, DEFAULT_CONFIG } from './chainConfigs';

// 增强型价格监控器类
export class EnhancedPriceMonitor {
  private suiClient: SuiClient;
  private dataSourceManager: DataSourceManager;
  private priceCache: Map<string, PriceResult>;
  private monitoringTasks: Map<string, NodeJS.Timeout>;
  private config: PriceMonitorConfig;
  private lastUsedDataSources: Map<string, { source: string, timestamp: number }> = new Map();

  constructor(suiClient: SuiClient, config: Partial<PriceMonitorConfig> = {}) {
    this.suiClient = suiClient;
    this.dataSourceManager = new DataSourceManager();
    this.priceCache = new Map();
    this.monitoringTasks = new Map();
    
    // 合并配置
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    
    console.log('增强型价格监控器初始化完成');
  }

  /**
   * 获取单个链上的ETH/USDT价格
   * @param chainName 链名称
   * @returns Promise<number> 价格
   */
  public async getEthUsdtPrice(chainName: string): Promise<number> {
    // 检查链是否支持
    if (!SUPPORTED_CHAINS.includes(chainName)) {
      throw new Error(`不支持的链: ${chainName}`);
    }
    
    const cacheKey = `${chainName}:ETH/USDT`;
    const now = Date.now();
    
    // 检查缓存
    const cachedResult = this.priceCache.get(cacheKey);
    if (cachedResult && (now - cachedResult.timestamp < this.config.cacheTTL)) {
      console.log(`[缓存] ${chainName} ETH/USDT: $${cachedResult.price.toFixed(2)} (来源: ${cachedResult.source})`);
      return cachedResult.price;
    }
    
    // 获取新价格
    try {
      // 针对不同类型的链使用不同的获取方式
      let result;
      
      // 对于非EVM链使用特殊处理
      if (chainName === 'solana' || chainName === 'sui') {
        console.log(`获取非EVM链 ${chainName} 的价格数据`);
        const tokenSymbol = chainName === 'solana' ? 'SOL' : 'SUI';
        
        // 尝试从dataSourceManager获取价格
        result = await this.dataSourceManager.getPrice(chainName);
        
        // 记录使用了特殊处理方式
        result.source = `${result.source} (${tokenSymbol}/USDT)`;
      } else {
        // 普通EVM链
        result = await this.dataSourceManager.getPrice(chainName);
      }
      
      // 记录使用的数据源
      this.lastUsedDataSources.set(chainName, {
        source: result.source,
        timestamp: now
      });
      
      // 只缓存成功的结果
      if (result.success) {
        this.priceCache.set(cacheKey, result);
      }
      
      return result.price;
    } catch (error) {
      console.error(`获取${chainName}价格失败:`, error);
      
      // 如果有缓存，即使过期也返回
      if (cachedResult) {
        console.log(`[过期缓存] ${chainName} ETH/USDT: $${cachedResult.price.toFixed(2)}`);
        return cachedResult.price;
      }
      
      throw error;
    }
  }

  /**
   * 获取链最后使用的数据源信息
   * @param chainName 链名称
   * @returns 包含数据源名称和时间戳的对象，如果没有则返回null
   */
  public getLastUsedDataSource(chainName: string): { source: string, timestamp: number } | null {
    const dataSource = this.lastUsedDataSources.get(chainName);
    if (!dataSource) {
      // 尝试从缓存中获取
      const cacheKey = `${chainName}:ETH/USDT`;
      const cachedResult = this.priceCache.get(cacheKey);
      if (cachedResult) {
        return {
          source: cachedResult.source,
          timestamp: cachedResult.timestamp
        };
      }
      return null;
    }
    return dataSource;
  }

  /**
   * 批量获取ETH/USDT价格
   */
  public async batchGetEthUsdtPrices() {
    console.log('[增强型价格监控器] 开始批量获取ETH/USDT价格');
    const results = new Map();
    const chains = SUPPORTED_CHAINS;
    
    console.log(`[增强型价格监控器] 将获取以下链的价格: ${chains.join(', ')}`);
    
    // 创建并行请求
    const pricePromises = chains.map((chainName: string) => 
      this.getEthUsdtPrice(chainName)
        .then(price => {
          console.log(`[增强型价格监控器] 获取到 ${chainName} 价格: $${price.toFixed(2)}`);
          return { chainName, price, success: true };
        })
        .catch(error => {
          console.error(`[增强型价格监控器] 批量获取${chainName}价格失败:`, error.message);
          return { chainName, price: 0, success: false };
        })
    );
    
    // 等待所有请求完成
    const priceResults = await Promise.allSettled(pricePromises);
    
    // 处理结果
    for (const result of priceResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        results.set(result.value.chainName, result.value.price);
      }
    }
    
    console.log(`[增强型价格监控器] 批量获取完成，成功获取 ${results.size}/${chains.length} 条价格数据`);
    return results;
  }

  /**
   * 计算价格差异
   */
  public calculatePriceSpread(price1: number, price2: number): number {
    if (price1 <= 0 || price2 <= 0) {
      console.warn(`[增强型价格监控器] 计算价差的价格中有无效值: price1=${price1}, price2=${price2}`);
      return 0;
    }
    
    const min = Math.min(price1, price2);
    const spread = min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
    
    if (spread > 5) {
      console.warn(`[增强型价格监控器] 检测到较大价差: ${spread.toFixed(2)}%, price1=${price1}, price2=${price2}`);
    }
    
    return spread;
  }

  /**
   * 检查价格是否异常
   * @param price1 价格1
   * @param price2 价格2
   * @param threshold 阈值百分比
   * @returns boolean 是否异常
   */
  private isPriceAbnormal(price1: number, price2: number, threshold: number): boolean {
    const spread = this.calculatePriceSpread(price1, price2);
    return spread > threshold;
  }

  /**
   * 开始监控任务
   * @param task 任务配置
   * @param interval 监控间隔（毫秒）
   */
  public startMonitoring(task: TaskConfig, interval: number = 30000): void {
    // 检查任务是否已经在监控
    if (this.monitoringTasks.has(task.id)) {
      console.warn(`任务 ${task.id} 已经在监控中`);
      return;
    }

    console.log(`开始监控任务: ${task.id} - ${task.name || '未命名任务'}`);
    
    const monitor = async () => {
      try {
        // 只监控激活的任务
        if (!task.active) {
          console.log(`任务 ${task.id} 已停用`);
          return;
        }
        
        const [chain1, chain2] = task.chain_pairs;
        const [chain1Name, chain2Name] = [
          chain1.split(':')[0],
          chain2.split(':')[0]
        ];
        
        // 先尝试批量获取所有价格
        const prices = await this.batchGetEthUsdtPrices();
        let price1 = prices.get(chain1Name);
        let price2 = prices.get(chain2Name);
        
        // 如果批量获取失败，尝试单独获取
        if (price1 === undefined) {
          try {
            price1 = await this.getEthUsdtPrice(chain1Name);
          } catch (error) {
            console.error(`获取 ${chain1Name} 价格失败:`, error);
          }
        }
        
        if (price2 === undefined) {
          try {
            price2 = await this.getEthUsdtPrice(chain2Name);
          } catch (error) {
            console.error(`获取 ${chain2Name} 价格失败:`, error);
          }
        }
        
        // 检查是否获取到两个价格
        if (price1 === undefined || price2 === undefined) {
          console.error(`无法获取 ${chain1Name} 或 ${chain2Name} 的价格`);
          return;
        }
        
        // 计算价差并检查是否异常
        const spread = this.calculatePriceSpread(price1, price2);
        console.log(`${chain1Name} vs ${chain2Name}: $${price1.toFixed(2)} vs $${price2.toFixed(2)}, 价差: ${spread.toFixed(2)}%`);
        
        if (this.isPriceAbnormal(price1, price2, task.threshold)) {
          const now = Date.now();
          
          // 检查冷却期
          if (!task.last_alert || (now - task.last_alert) > task.cooldown * 1000) {
            // 触发价格警报
            console.log(`⚠️ 价格警报(${task.id}): ${chain1Name}: $${price1.toFixed(2)} vs ${chain2Name}: $${price2.toFixed(2)}`);
            console.log(`价差: ${spread.toFixed(2)}% (阈值: ${task.threshold}%)`);
            
            // 记录警报时间
            task.last_alert = now;
            
            // TODO: 在这里可以添加其他告警方式，如发送通知等
          } else {
            // 在冷却期内
            const cooldownRemaining = Math.round((task.last_alert + task.cooldown * 1000 - now) / 1000);
            console.log(`价格异常，但在冷却期内（剩余 ${cooldownRemaining} 秒）`);
          }
        }
      } catch (error) {
        console.error(`监控任务 ${task.id} 出错:`, error);
      }
    };

    // 立即执行一次监控
    monitor();
    
    // 设置定时监控
    const timer = setInterval(monitor, interval);
    this.monitoringTasks.set(task.id, timer);
    
    console.log(`任务 ${task.id} 监控已开始，间隔: ${interval}ms`);
  }

  /**
   * 停止监控任务
   * @param taskId 任务ID
   */
  public stopMonitoring(taskId: string): void {
    const timer = this.monitoringTasks.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.monitoringTasks.delete(taskId);
      console.log(`任务 ${taskId} 监控已停止`);
    } else {
      console.warn(`任务 ${taskId} 未在监控中`);
    }
  }

  /**
   * 停止所有监控任务
   */
  public stopAllMonitoring(): void {
    console.log(`停止所有监控任务 (${this.monitoringTasks.size} 个)`);
    
    for (const [taskId, timer] of this.monitoringTasks.entries()) {
      clearInterval(timer);
      console.log(`- 任务 ${taskId} 监控已停止`);
    }
    
    this.monitoringTasks.clear();
  }

  /**
   * 获取所有监控中的任务ID
   * @returns string[] 任务ID数组
   */
  public getMonitoringTaskIds(): string[] {
    return Array.from(this.monitoringTasks.keys());
  }

  /**
   * 获取相关链支持的交易对信息
   * @returns 交易对信息
   */
  public getSupportedPairs(): { chains: string[], tokens: string[] } {
    try {
      console.log(`[增强型价格监控器] 获取支持的交易对信息，支持的链: ${SUPPORTED_CHAINS.join(', ')}`);
      // 返回所有支持的链和代币对
      return {
        chains: SUPPORTED_CHAINS,
        tokens: ['ETH/USDT'] // 目前只支持ETH/USDT
      };
    } catch (error) {
      console.error('[增强型价格监控器] 获取支持的交易对信息时出错:', error);
      // 如果发生错误，返回默认值确保应用不会崩溃
      return {
        chains: ['ethereum', 'arbitrum', 'optimism'], // 至少返回几个核心链
        tokens: ['ETH/USDT']
      };
    }
  }
} 