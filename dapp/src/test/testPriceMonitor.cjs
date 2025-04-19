/**
 * ETH/USDT价格查询功能测试 - 纯Wormhole SDK版本
 * 使用方法: node src/test/testPriceMonitor.cjs
 */

// 使用纯CommonJS导入
const { SuiClient } = require('@mysten/sui.js/client');
const axios = require('axios');

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV !== 'production';

// Wormhole链ID映射
const CHAIN_IDS = {
  ethereum: 2,
  arbitrum: 23,
  optimism: 24,
  base: 30
};

// ETH/USDT交易对地址配置
const ETH_USDT_POOLS = {
  ethereum: {
    address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852', // Uniswap V2 ETH/USDT
    decimals: { eth: 18, usdt: 6 },
    order: { eth: 0, usdt: 1 } // 0表示token0是ETH，1表示token1是USDT
  },
  arbitrum: {
    address: '0xc31e54c7a869b9fcbecc14363cf510d1c41fa443', // SushiSwap ETH/USDT
    decimals: { eth: 18, usdt: 6 },
    order: { eth: 0, usdt: 1 }
  },
  optimism: {
    address: '0x7B28472c1427C84435e112EE0AD1666bCD17f95E', // Optimism ETH/USDT
    decimals: { eth: 18, usdt: 6 },
    order: { eth: 1, usdt: 0 } // 这里token0是USDT，token1是ETH
  },
  base: {
    address: '0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18', // BaseSwap ETH/USDT
    decimals: { eth: 18, usdt: 6 },
    order: { eth: 0, usdt: 1 }
  }
};

// 函数签名常量
const FUNCTION_SIGNATURES = {
  getReserves: '0x0902f1ac', // UniswapV2式getReserves()函数
};

// 使用Wormhole SDK
const wormholeQuerySdk = require('@wormhole-foundation/wormhole-query-sdk');
const {
  EthCallQueryRequest,
  PerChainQueryRequest,
  QueryProxyMock,
  QueryRequest,
  QueryResponse,
} = wormholeQuerySdk;

// 新增：获取最新区块号
async function getLatestBlockNumber(rpcUrl) {
  try {
    console.log(`获取${rpcUrl}的最新区块号...`);
    
    const response = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBlockByNumber',
      params: ['latest', false]
    });
    
    if (response.data.error) {
      throw new Error(`获取区块号错误: ${response.data.error.message}`);
    }
    
    const blockNumber = response.data.result.number;
    console.log(`获取到最新区块号: ${blockNumber}`);
    return blockNumber;
  } catch (error) {
    console.error('获取区块号失败:', error.message);
    // 返回一个合理的默认值，如'0x0'
    return '0x1'; // 使用区块1作为备选
  }
}

// 实现一个专注于Wormhole SDK的PriceMonitor
class PriceMonitorWormhole {
  constructor(suiClient, rpcEndpoints) {
    this.suiClient = suiClient;
    this.rpcEndpoints = rpcEndpoints;
    this.priceCache = new Map();
    this.lastPriceUpdate = new Map();
    this.monitoringTasks = new Map();
    // 缓存最新区块号
    this.latestBlocks = new Map();
  }

  // 批量获取多个EVM链上的ETH/USDT价格
  async batchGetEthUsdtPrices() {
    try {
      // 准备查询目标
      const targets = Object.entries(CHAIN_IDS).map(([chainName, chainId]) => {
        const pool = ETH_USDT_POOLS[chainName];
        if (!pool) return null;
        
        return {
          chainId,
          chainName,
          address: pool.address,
          data: FUNCTION_SIGNATURES.getReserves
        };
      }).filter(Boolean);

      if (targets.length === 0) {
        console.warn('No valid ETH/USDT pool targets configured');
        return new Map();
      }

      // 使用Wormhole SDK获取价格
      return this.batchGetPricesWithSDK(targets);
    } catch (error) {
      console.error('Wormhole SDK批量查询失败:', error);
      
      // 返回缓存的价格作为备选
      const cachedResults = new Map();
      for (const chainName of Object.keys(CHAIN_IDS)) {
        const cacheKey = `${chainName}:ETH/USDT`;
        const cachedPrice = this.priceCache.get(cacheKey);
        if (cachedPrice !== undefined) {
          cachedResults.set(chainName, cachedPrice);
        }
      }
      
      return cachedResults;
    }
  }
  
  // 使用Wormhole SDK的批量查询方法
  async batchGetPricesWithSDK(targets) {
    try {
      // 构建per-chain查询请求，为每个请求获取最新区块号
      const perChainRequests = [];
      
      for (const target of targets) {
        // 为每个链获取最新区块号，而不是使用'latest'
        const blockId = await this.getChainBlockId(target.chainId);
        
        perChainRequests.push(
          new PerChainQueryRequest(
            target.chainId,
            new EthCallQueryRequest(blockId, [
              { to: target.address, data: target.data }
            ])
          )
        );
      }

      // 构建完整查询请求
      const request = new QueryRequest(0, perChainRequests);
      const serialized = request.serialize();
      
      let response;
      
      // 由于是测试环境，使用Mock模式
      console.log('使用QueryProxyMock获取ETH/USDT价格');
      const mock = new QueryProxyMock(
        // 为每个链配置RPC
        Object.fromEntries(
          targets.map(t => [t.chainId, this.rpcEndpoints[t.chainId]])
        )
      );
      response = await mock.mock(request);
      
      // Mock响应格式
      const bytes = response.bytes;
      
      // 解析查询响应
      const queryResponse = QueryResponse.from(bytes);
      return this.processQueryResponse(queryResponse, targets);
    } catch (error) {
      console.error('Wormhole SDK批量查询失败:', error);
      return new Map();
    }
  }
  
  // 处理查询响应
  processQueryResponse(queryResponse, targets) {
    const results = new Map();
    
    // 处理每个链的响应结果
    for (let i = 0; i < queryResponse.responses.length; i++) {
      const target = targets[i];
      const chainResponse = queryResponse.responses[i].response;
      
      if (!chainResponse.results || chainResponse.results.length === 0) {
        console.warn(`No results for ${target.chainName}`);
        continue;
      }
      
      const result = chainResponse.results[0];
      const pool = ETH_USDT_POOLS[target.chainName];
      
      // 解析getReserves返回值
      // UniswapV2 getReserves返回: (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
      if (result && result.length >= 194) {
        const reserve0Hex = result.substring(2, 58); // 第一个reserve (uint112)
        const reserve1Hex = result.substring(58, 114); // 第二个reserve (uint112)
        
        // 转换为BigInt
        const reserve0 = BigInt(`0x${reserve0Hex}`);
        const reserve1 = BigInt(`0x${reserve1Hex}`);
        
        // 确定ETH和USDT的储备量
        const ethIndex = pool.order.eth;
        const usdtIndex = pool.order.usdt;
        
        const ethReserve = ethIndex === 0 ? reserve0 : reserve1;
        const usdtReserve = usdtIndex === 0 ? reserve0 : reserve1;
        
        if (ethReserve === 0n) {
          console.warn(`ETH reserve is zero for ${target.chainName}`);
          continue;
        }
        
        // 计算价格，考虑不同代币的小数位数
        const ethDecimals = pool.decimals.eth;
        const usdtDecimals = pool.decimals.usdt;
        const decimalAdjustment = 10n ** BigInt(ethDecimals - usdtDecimals);
        
        // ETH/USDT价格 = USDT储备 / (ETH储备 * 10^(ETH小数位-USDT小数位))
        const price = Number(usdtReserve) / (Number(ethReserve) / Number(decimalAdjustment));
        
        // 保存结果和更新时间
        results.set(target.chainName, price);
        this.priceCache.set(`${target.chainName}:ETH/USDT`, price);
        this.lastPriceUpdate.set(`${target.chainName}:ETH/USDT`, Date.now());
        
        console.log(`${target.chainName} ETH/USDT Price: ${price}`);
      }
    }
    
    return results;
  }
  
  // 获取区块号
  async getChainBlockId(chainId) {
    // 检查是否有最近缓存的区块号
    const now = Date.now();
    const cacheEntry = this.latestBlocks.get(chainId);
    
    if (cacheEntry && (now - cacheEntry.time) < 60000) { // 1分钟内的缓存有效
      return cacheEntry.blockId;
    }
    
    // 获取最新区块号
    try {
      const rpcUrl = this.rpcEndpoints[chainId];
      const blockId = await getLatestBlockNumber(rpcUrl);
      
      // 缓存区块号
      this.latestBlocks.set(chainId, {
        blockId,
        time: now
      });
      
      return blockId;
    } catch (error) {
      console.error(`获取链${chainId}的区块号失败:`, error);
      // 返回一个备用值
      return '0x1';
    }
  }

  // 获取单个链上的ETH/USDT价格
  async getEthUsdtPrice(chainName) {
    // 检查链是否在支持的列表中
    if (!(chainName in CHAIN_IDS)) {
      throw new Error(`Unsupported chain: ${chainName}`);
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
    
    // 否则获取新的价格数据
    try {
      const prices = await this.batchGetEthUsdtPrices();
      const price = prices.get(chainName);
      
      if (price === undefined) {
        throw new Error(`Failed to get ETH/USDT price for ${chainName} using Wormhole SDK`);
      }
      
      return price;
    } catch (error) {
      console.error(`获取${chainName}的ETH/USDT价格失败:`, error);
      
      // 返回缓存的价格作为备选
      const cachedPrice = this.priceCache.get(cacheKey);
      if (cachedPrice !== undefined) {
        console.log(`[过期缓存] ${chainName} ETH/USDT: $${cachedPrice.toFixed(2)}`);
        return cachedPrice;
      }
      
      throw new Error(`无法获取${chainName}的ETH/USDT价格`);
    }
  }

  // 计算价格差异
  calculatePriceSpread(price1, price2) {
    const min = Math.min(price1, price2);
    return min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
  }

  // 检查价格是否异常
  isPriceAbnormal(price1, price2, threshold) {
    const spread = this.calculatePriceSpread(price1, price2);
    return spread > threshold;
  }

  // 开始监控任务
  startMonitoring(task, interval = 30000) {
    if (this.monitoringTasks.has(task.id)) {
      console.warn(`Task ${task.id} is already being monitored`);
      return;
    }

    const monitor = async () => {
      try {
        const [chain1, chain2] = task.chain_pairs;
        const [chain1Name, chain2Name] = [
          chain1.split(':')[0],
          chain2.split(':')[0]
        ];
        
        // 获取两个链上的ETH/USDT价格
        const prices = await this.batchGetEthUsdtPrices();
        const price1 = prices.get(chain1Name);
        const price2 = prices.get(chain2Name);
        
        if (!price1 || !price2) {
          console.error(`Could not get prices for ${chain1Name} or ${chain2Name}`);
          return;
        }

        if (this.isPriceAbnormal(price1, price2, task.threshold)) {
          const now = Date.now();
          if (!task.last_alert || (now - task.last_alert) > task.cooldown * 1000) {
            // 触发价格警报
            console.log(`价格警报(${task.id}): ${chain1Name}: ${price1} vs ${chain2Name}: ${price2}`);
            console.log(`价差: ${this.calculatePriceSpread(price1, price2).toFixed(2)}%`);
            task.last_alert = now;
          }
        }
      } catch (error) {
        console.error(`监控任务${task.id}出错:`, error);
      }
    };

    // 立即执行一次监控
    monitor();
    
    // 设置定时监控
    const timer = setInterval(monitor, interval);
    this.monitoringTasks.set(task.id, timer);
  }

  // 停止监控任务
  stopMonitoring(taskId) {
    const timer = this.monitoringTasks.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.monitoringTasks.delete(taskId);
    }
  }

  // 停止所有监控任务
  stopAllMonitoring() {
    for (const timer of this.monitoringTasks.values()) {
      clearInterval(timer);
    }
    this.monitoringTasks.clear();
  }
}

// 测试函数
async function testPriceMonitorWormhole() {
  console.log('===== ETH/USDT价格查询测试（Wormhole SDK专用版）=====');
  
  // 确保使用开发环境
  process.env.NODE_ENV = 'development';
  
  // 配置主要公共RPC端点
  const rpcEndpoints = {
    2: 'https://ethereum.publicnode.com',        // Ethereum
    23: 'https://arbitrum-one.publicnode.com',   // Arbitrum
    24: 'https://optimism.publicnode.com',       // Optimism
    30: 'https://base.publicnode.com'            // Base
  };
  
  // 备用RPC端点
  const backupRpcEndpoints = {
    2: 'https://eth.llamarpc.com',               // Ethereum
    23: 'https://arbitrum.llamarpc.com',         // Arbitrum
    24: 'https://optimism.llamarpc.com',         // Optimism
    30: 'https://base.llamarpc.com'              // Base
  };

  // 创建SuiClient实例
  const suiClient = new SuiClient({ url: 'https://sui-mainnet.publicnode.com' });
  
  // 初始化测试版PriceMonitor
  console.log('初始化PriceMonitor...');
  const priceMonitor = new PriceMonitorWormhole(suiClient, rpcEndpoints);
  
  console.log('✅ 已初始化PriceMonitor');
  console.log('📊 开始测试Wormhole SDK功能...\n');
  
  try {
    // 1. 测试批量获取所有链上的价格
    console.log('测试1: 使用Wormhole SDK批量获取所有链上的ETH/USDT价格');
    const allPrices = await priceMonitor.batchGetEthUsdtPrices();
    
    console.log('\n批量查询结果:');
    if (allPrices.size === 0) {
      console.log('❌ 未获取到任何价格数据');
    } else {
      console.log('链名\t\tETH/USDT价格');
      console.log('------------------------');
      allPrices.forEach((price, chainName) => {
        console.log(`${chainName}\t\t$${price.toFixed(2)}`);
      });
      console.log('✅ 批量查询成功\n');
    }
    
    // 2. 测试单个链的价格查询
    console.log('测试2: 单独查询每条链的ETH/USDT价格');
    const chains = ['ethereum', 'arbitrum', 'optimism', 'base'];
    
    for (const chain of chains) {
      try {
        const price = await priceMonitor.getEthUsdtPrice(chain);
        console.log(`${chain}: $${price.toFixed(2)}`);
      } catch (error) {
        console.log(`❌ ${chain}查询失败: ${error.message || error}`);
      }
    }
    console.log('✅ 单链查询测试完成\n');
    
    // 3. 测试价差计算
    console.log('测试3: 计算链间价格差异');
    // 创建一个价格矩阵来显示所有链之间的价差
    const priceMatrix = [];
    
    // 获取有效价格的链
    const chainsWithPrices = [];
    const validPrices = new Map();
    
    for (const chain of chains) {
      const price = allPrices.get(chain);
      if (price !== undefined) {
        chainsWithPrices.push(chain);
        validPrices.set(chain, price);
      }
    }
    
    for (let i = 0; i < chainsWithPrices.length; i++) {
      for (let j = i + 1; j < chainsWithPrices.length; j++) {
        const chain1 = chainsWithPrices[i];
        const chain2 = chainsWithPrices[j];
        
        const price1 = validPrices.get(chain1);
        const price2 = validPrices.get(chain2);
        
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
    if (priceMatrix.length > 0) {
      console.table(priceMatrix);
    } else {
      console.log('❌ 没有足够的价格数据计算价差');
    }
    console.log('✅ 价差计算测试完成\n');
    
    // 4. 测试缓存功能
    console.log('测试4: 验证缓存功能');
    console.log('再次查询以验证缓存...');
    
    // 获取一个有效的链来测试缓存
    const chainForCacheTest = chainsWithPrices.length > 0 ? chainsWithPrices[0] : 'ethereum';
    
    console.time('首次查询');
    await priceMonitor.getEthUsdtPrice(chainForCacheTest);
    console.timeEnd('首次查询');
    
    console.time('缓存查询');
    await priceMonitor.getEthUsdtPrice(chainForCacheTest);
    console.timeEnd('缓存查询');
    
    console.log('✅ 缓存功能测试完成');
    
    // 5. 测试监控任务功能
    console.log('\n测试5: 价格监控任务');
    
    if (chainsWithPrices.length >= 2) {
      // 创建一个监控任务配置
      const taskConfig = {
        id: 'test-task-1',
        chain_pairs: [`${chainsWithPrices[0]}:ETH/USDT`, `${chainsWithPrices[1]}:ETH/USDT`],
        threshold: 0.5, // 价差阈值百分比
        cooldown: 60, // 冷却时间（秒）
      };
      
      console.log('开始监控任务...');
      // 启动监控任务，但只运行5秒
      priceMonitor.startMonitoring(taskConfig, 2000);
      
      // 5秒后停止监控任务
      await new Promise(resolve => setTimeout(resolve, 5000));
      priceMonitor.stopMonitoring(taskConfig.id);
      console.log('已停止监控任务');
      console.log('✅ 监控任务测试完成');
    } else {
      console.log('❌ 没有足够的链价格数据进行监控测试');
    }
    
  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error);
    
    // 尝试使用备用RPC
    console.log('\n尝试使用备用RPC端点...');
    const backupPriceMonitor = new PriceMonitorWormhole(suiClient, backupRpcEndpoints);
    
    try {
      const backupPrices = await backupPriceMonitor.batchGetEthUsdtPrices();
      console.log('\n备用RPC查询结果:');
      backupPrices.forEach((price, chainName) => {
        console.log(`${chainName}: ETH/USDT = $${price.toFixed(2)}`);
      });
    } catch (backupError) {
      console.error('❌ 备用RPC也失败了:', backupError);
    }
  } finally {
    console.log('\n===== 测试结束 =====');
  }
}

// 执行测试
testPriceMonitorWormhole().catch(error => {
  console.error('❌ 测试执行失败:', error);
}); 