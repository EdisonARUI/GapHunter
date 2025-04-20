/**
 * Chainlink预言机数据源
 */
import { ethers } from 'ethers';
import { PriceDataSource } from '../interfaces';
import { CHAIN_CONFIGS } from '../chainConfigs';
import { IChainlinkAggregatorABI } from '../contractAbis';

// Chainlink预言机数据源类
export class ChainlinkSource implements PriceDataSource {
  public readonly name = 'Chainlink Oracle';
  public readonly priority = 2; // 第二优先级

  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private backupProviders: Map<string, ethers.providers.JsonRpcProvider>;
  private chainlinkContracts: Map<string, ethers.Contract>;

  constructor() {
    this.providers = new Map();
    this.backupProviders = new Map();
    this.chainlinkContracts = new Map();
    this.initializeProviders();
  }

  /**
   * 初始化各链的提供者
   */
  private async initializeProviders(): Promise<void> {
    for (const [chainName, config] of Object.entries(CHAIN_CONFIGS)) {
      // 只初始化有Chainlink喂价合约的链
      if (config.chainlinkFeeds?.ethUsd) {
        try {
          // 创建主RPC提供者
          const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
          this.providers.set(chainName, provider);
          
          // 创建备用RPC提供者
          const backupProvider = new ethers.providers.JsonRpcProvider(config.backupRpcUrl);
          this.backupProviders.set(chainName, backupProvider);
          
          // 初始化Chainlink合约
          const contract = new ethers.Contract(
            config.chainlinkFeeds.ethUsd,
            IChainlinkAggregatorABI,
            provider
          );
          this.chainlinkContracts.set(chainName, contract);
        } catch (error) {
          console.error(`初始化${chainName} Chainlink提供者失败:`, error);
        }
      }
    }
  }

  /**
   * 获取提供者（优先使用主RPC，失败时切换到备用RPC）
   */
  private getProvider(chainName: string): ethers.providers.JsonRpcProvider {
    const provider = this.providers.get(chainName);
    if (!provider) {
      const backupProvider = this.backupProviders.get(chainName);
      if (!backupProvider) {
        throw new Error(`找不到${chainName}的RPC提供者`);
      }
      return backupProvider;
    }
    return provider;
  }

  /**
   * 实现PriceDataSource接口的getPrice方法
   */
  public async getPrice(chainName: string): Promise<number> {
    if (!CHAIN_CONFIGS[chainName]) {
      throw new Error(`不支持的链: ${chainName}`);
    }
    
    // 检查是否有Chainlink喂价合约
    if (!CHAIN_CONFIGS[chainName].chainlinkFeeds?.ethUsd) {
      throw new Error(`${chainName}没有配置Chainlink喂价合约`);
    }
    
    return await this.getEthUsdPriceFromChainlink(chainName);
  }

  /**
   * 从Chainlink预言机获取ETH/USD价格
   */
  private async getEthUsdPriceFromChainlink(chainName: string): Promise<number> {
    const contract = this.chainlinkContracts.get(chainName);
    if (!contract) {
      throw new Error(`${chainName} Chainlink合约未初始化`);
    }
    
    try {
      // 获取最新价格和精度
      const answer = await contract.latestAnswer();
      const decimals = await contract.decimals();
      
      // 计算价格（考虑精度）
      const price = parseFloat(answer.toString()) / Math.pow(10, decimals);
      console.log(`${chainName} ETH/USD 从Chainlink获取的价格: $${price.toFixed(2)}`);
      
      return price;
    } catch (error) {
      console.error(`从Chainlink获取${chainName}价格失败:`, error);
      
      // 尝试使用备用提供者
      try {
        const backupProvider = this.backupProviders.get(chainName);
        if (backupProvider) {
          const config = CHAIN_CONFIGS[chainName];
          const backupContract = new ethers.Contract(
            config.chainlinkFeeds?.ethUsd!,
            IChainlinkAggregatorABI,
            backupProvider
          );
          
          const answer = await backupContract.latestAnswer();
          const decimals = await backupContract.decimals();
          
          const price = parseFloat(answer.toString()) / Math.pow(10, decimals);
          console.log(`${chainName} ETH/USD 从Chainlink备用RPC获取的价格: $${price.toFixed(2)}`);
          
          return price;
        }
      } catch (backupError) {
        console.error(`从Chainlink备用RPC获取${chainName}价格失败:`, backupError);
      }
      
      throw error;
    }
  }
} 