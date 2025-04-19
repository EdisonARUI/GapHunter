/**
 * DEX合约数据源
 */
import { ethers } from 'ethers';
import { PriceDataSource, PoolType, PoolTypeValue } from '../interfaces';
import { CHAIN_CONFIGS } from '../chainConfigs';
import { 
  IUniswapV2PairABI, 
  IUniswapV3PoolABI 
} from '../contractAbis';
import axios from 'axios';

// DEX合约数据源类
export class DexContractSource implements PriceDataSource {
  public readonly name = 'DEX合约';
  public readonly priority = 1; // 最高优先级

  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private backupProviders: Map<string, ethers.providers.JsonRpcProvider>;
  private pairContracts: Map<string, ethers.Contract>;
  private verifiedContracts: Map<string, { verified: boolean, type: string | PoolTypeValue }>;

  constructor() {
    this.providers = new Map();
    this.backupProviders = new Map();
    this.pairContracts = new Map();
    this.verifiedContracts = new Map();
    this.initializeProviders();
  }

  /**
   * 初始化各链的提供者
   */
  private async initializeProviders(): Promise<void> {
    for (const [chainName, config] of Object.entries(CHAIN_CONFIGS)) {
      try {
        // 创建主RPC提供者
        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        this.providers.set(chainName, provider);
        
        // 创建备用RPC提供者
        const backupProvider = new ethers.providers.JsonRpcProvider(config.backupRpcUrl);
        this.backupProviders.set(chainName, backupProvider);
        
        // 初始化合约对象
        await this.initializeContract(chainName, config.ethUsdtPool.address, provider, config.ethUsdtPool.type);
      } catch (error) {
        console.error(`初始化${chainName}提供者失败:`, error);
      }
    }
  }

  /**
   * 初始化合约
   */
  private async initializeContract(
    chainName: string, 
    address: string, 
    provider: ethers.providers.JsonRpcProvider,
    poolType: PoolTypeValue
  ): Promise<void> {
    try {
      let contract: ethers.Contract;
      
      // 根据池类型选择合适的ABI
      switch (poolType) {
        case PoolType.UNISWAP_V2:
        case PoolType.SUSHISWAP:
          contract = new ethers.Contract(address, IUniswapV2PairABI, provider);
          break;
        case PoolType.UNISWAP_V3:
          contract = new ethers.Contract(address, IUniswapV3PoolABI, provider);
          break;
        default:
          throw new Error(`不支持的池类型: ${poolType}`);
      }
      
      this.pairContracts.set(chainName, contract);
      
      // 验证合约
      const verified = await this.verifyContract(chainName, address, provider, poolType);
      this.verifiedContracts.set(chainName, { verified, type: poolType });
    } catch (error) {
      console.error(`初始化${chainName}合约失败:`, error);
      this.verifiedContracts.set(chainName, { verified: false, type: 'error' });
    }
  }

  /**
   * 验证合约
   */
  private async verifyContract(
    chainName: string, 
    address: string, 
    provider: ethers.providers.JsonRpcProvider,
    poolType: PoolTypeValue
  ): Promise<boolean> {
    try {
      const contract = this.pairContracts.get(chainName);
      if (!contract) return false;
      
      // 根据池类型执行不同的验证
      switch (poolType) {
        case PoolType.UNISWAP_V2:
        case PoolType.SUSHISWAP:
          // 尝试获取储备金，这将验证合约是否具有正确的接口
          await contract.getReserves();
          return true;
        
        case PoolType.UNISWAP_V3:
          // 尝试获取slot0信息，这将验证合约是否具有正确的接口
          await contract.slot0();
          return true;
          
        default:
          return false;
      }
    } catch (error) {
      console.error(`验证${chainName}合约失败:`, error);
      return false;
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
   * 获取价格
   */
  public async getPrice(chainName: string): Promise<number> {
    if (!CHAIN_CONFIGS[chainName]) {
      throw new Error(`不支持的链: ${chainName}`);
    }
    
    // 对于非EVM链，使用特殊处理
    if (chainName === 'solana') {
      return this.getSolanaPriceFromRaydium(chainName);
    } else if (chainName === 'sui') {
      return this.getSuiPriceFromCetus(chainName);
    }
    
    // 其他EVM链继续使用常规方法
    const config = CHAIN_CONFIGS[chainName];
    const poolConfig = config.ethUsdtPool;
    const poolType = poolConfig.type;
    
    // 检查合约是否已验证
    const contractInfo = this.verifiedContracts.get(chainName);
    if (!contractInfo || !contractInfo.verified) {
      throw new Error(`${chainName}合约未通过验证`);
    }
    
    // 根据合约类型选择不同的价格获取方法
    switch (poolType) {
      case PoolType.UNISWAP_V2:
      case PoolType.SUSHISWAP:
        return await this.getPriceFromUniswapV2Pool(chainName);
      case PoolType.UNISWAP_V3:
        return await this.getPriceFromUniswapV3Pool(chainName);
      default:
        throw new Error(`不支持的合约类型: ${contractInfo.type}`);
    }
  }

  /**
   * 从UniswapV2风格池获取ETH/USDT价格
   */
  private async getPriceFromUniswapV2Pool(chainName: string): Promise<number> {
    const contract = this.pairContracts.get(chainName);
    if (!contract) {
      throw new Error(`${chainName}合约未初始化`);
    }
    
    const config = CHAIN_CONFIGS[chainName];
    
    try {
      // 获取池中的储备金
      const [reserve0, reserve1] = await contract.getReserves();
      
      // 获取代币精度
      const { eth: ethDecimals, usdt: usdtDecimals } = config.ethUsdtPool.decimals;
      
      // 获取代币顺序
      const { eth: ethIndex, usdt: usdtIndex } = config.ethUsdtPool.order;
      
      // 计算价格（考虑代币顺序和精度）
      const reserves = [reserve0, reserve1];
      const ethReserve = reserves[ethIndex];
      const usdtReserve = reserves[usdtIndex];
      
      // 调整精度并计算价格
      const ethAmount = ethers.utils.formatUnits(ethReserve, ethDecimals);
      const usdtAmount = ethers.utils.formatUnits(usdtReserve, usdtDecimals);
      
      const price = parseFloat(usdtAmount) / parseFloat(ethAmount);
      console.log(`${chainName} ETH/USDT 从V2池获取的价格: $${price.toFixed(2)}`);
      
      return price;
    } catch (error) {
      console.error(`从V2池获取${chainName}价格失败:`, error);
      
      // 尝试使用备用提供者
      try {
        const backupProvider = this.backupProviders.get(chainName);
        if (backupProvider) {
          const backupContract = new ethers.Contract(
            config.ethUsdtPool.address,
            IUniswapV2PairABI,
            backupProvider
          );
          
          const [reserve0, reserve1] = await backupContract.getReserves();
          
          // 获取代币精度
          const { eth: ethDecimals, usdt: usdtDecimals } = config.ethUsdtPool.decimals;
          
          // 获取代币顺序
          const { eth: ethIndex, usdt: usdtIndex } = config.ethUsdtPool.order;
          
          // 计算价格（考虑代币顺序和精度）
          const reserves = [reserve0, reserve1];
          const ethReserve = reserves[ethIndex];
          const usdtReserve = reserves[usdtIndex];
          
          // 调整精度并计算价格
          const ethAmount = ethers.utils.formatUnits(ethReserve, ethDecimals);
          const usdtAmount = ethers.utils.formatUnits(usdtReserve, usdtDecimals);
          
          const price = parseFloat(usdtAmount) / parseFloat(ethAmount);
          console.log(`${chainName} ETH/USDT 从V2池备用RPC获取的价格: $${price.toFixed(2)}`);
          
          return price;
        }
      } catch (backupError) {
        console.error(`从V2池备用RPC获取${chainName}价格失败:`, backupError);
      }
      
      throw error;
    }
  }

  /**
   * 从UniswapV3风格池获取ETH/USDT价格
   */
  private async getPriceFromUniswapV3Pool(chainName: string): Promise<number> {
    const contract = this.pairContracts.get(chainName);
    if (!contract) {
      throw new Error(`${chainName}合约未初始化`);
    }
    
    const config = CHAIN_CONFIGS[chainName];
    
    try {
      // 获取当前价格平方根
      const slot0 = await contract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // 获取代币精度
      const { eth: ethDecimals, usdt: usdtDecimals } = config.ethUsdtPool.decimals;
      
      // 获取代币顺序
      const { eth: ethIndex, usdt: usdtIndex } = config.ethUsdtPool.order;
      
      // 计算价格（考虑代币顺序和精度）
      // sqrtPriceX96 = sqrt(price) * 2^96
      const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / Math.pow(2, 96);
      
      // price = sqrtPrice^2 * 10^(decimals1 - decimals0)
      let price = Math.pow(sqrtPrice, 2);
      
      // 调整代币顺序和精度
      if (ethIndex === 0) {
        // ETH是token0，price = USDT/ETH
        price = price * Math.pow(10, usdtDecimals - ethDecimals);
      } else {
        // ETH是token1，price = ETH/USDT，需要取倒数
        price = (1 / price) * Math.pow(10, ethDecimals - usdtDecimals);
      }
      
      console.log(`${chainName} ETH/USDT 从V3池获取的价格: $${price.toFixed(2)}`);
      
      return price;
    } catch (error) {
      console.error(`从V3池获取${chainName}价格失败:`, error);
      
      // 尝试使用备用提供者
      try {
        const backupProvider = this.backupProviders.get(chainName);
        if (backupProvider) {
          const backupContract = new ethers.Contract(
            config.ethUsdtPool.address,
            IUniswapV3PoolABI,
            backupProvider
          );
          
          const slot0 = await backupContract.slot0();
          const sqrtPriceX96 = slot0.sqrtPriceX96;
          
          // 获取代币精度
          const { eth: ethDecimals, usdt: usdtDecimals } = config.ethUsdtPool.decimals;
          
          // 获取代币顺序
          const { eth: ethIndex, usdt: usdtIndex } = config.ethUsdtPool.order;
          
          // 计算价格
          const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / Math.pow(2, 96);
          let price = Math.pow(sqrtPrice, 2);
          
          // 调整代币顺序和精度
          if (ethIndex === 0) {
            price = price * Math.pow(10, usdtDecimals - ethDecimals);
          } else {
            price = (1 / price) * Math.pow(10, ethDecimals - usdtDecimals);
          }
          
          console.log(`${chainName} ETH/USDT 从V3池备用RPC获取的价格: $${price.toFixed(2)}`);
          
          return price;
        }
      } catch (backupError) {
        console.error(`从V3池备用RPC获取${chainName}价格失败:`, backupError);
      }
      
      throw error;
    }
  }

  /**
   * 从Raydium获取Solana上的SOL/USDT价格
   */
  private async getSolanaPriceFromRaydium(chainName: string): Promise<number> {
    console.log(`从Raydium获取Solana SOL/USDT价格`);
    
    try {
      // 使用CoinGecko作为备选数据源获取SOL价格
      // 在真实环境中，你应该实现对Raydium池子的直接查询
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`;
      const response = await axios.get(url);
      
      if (response.data && response.data.solana && response.data.solana.usd) {
        const price = response.data.solana.usd;
        console.log(`Solana SOL/USDT 价格: $${price.toFixed(2)}`);
        return price;
      }
      
      throw new Error('获取SOL价格失败');
    } catch (error) {
      console.error('Raydium获取SOL价格失败:', error);
      throw new Error(`获取SOL价格失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 从Cetus获取SUI上的SUI/USDT价格
   */
  private async getSuiPriceFromCetus(chainName: string): Promise<number> {
    console.log(`从Cetus获取SUI SUI/USDT价格`);
    
    try {
      // 使用SUI客户端SDK获取SUI Network的价格数据
      // 在实际环境中，你应该实现对Cetus池子的直接查询
      // 此处使用CoinGecko作为备选数据源
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd`;
      const response = await axios.get(url);
      
      if (response.data && response.data.sui && response.data.sui.usd) {
        const price = response.data.sui.usd;
        console.log(`SUI SUI/USDT 价格: $${price.toFixed(2)}`);
        return price;
      }
      
      throw new Error('获取SUI价格失败');
    } catch (error) {
      console.error('Cetus获取SUI价格失败:', error);
      throw new Error(`获取SUI价格失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 