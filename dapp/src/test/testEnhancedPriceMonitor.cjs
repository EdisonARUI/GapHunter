/**
 * 增强型价格监控器测试脚本 - CommonJS自包含版本
 * 使用方法: node src/test/testEnhancedPriceMonitor.cjs
 */

// 使用纯CommonJS导入
const { SuiClient } = require('@mysten/sui.js/client');
const axios = require('axios');

// 设置环境为开发环境
process.env.NODE_ENV = 'development';

// 支持的链配置
const CHAIN_CONFIGS = {
  ethereum: {
    name: "Ethereum",
    rpcUrl: "https://ethereum.publicnode.com",
    backupRpcUrl: "https://eth.llamarpc.com",
    ethUsdtPool: {
      address: "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852", // Uniswap V2 ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 0, usdt: 1 } // 0表示token0是ETH，1表示token1是USDT
    },
    chainlinkFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" // ETH/USD 主网喂价合约
  },
  arbitrum: {
    name: "Arbitrum",
    rpcUrl: "https://arbitrum-one.publicnode.com",
    backupRpcUrl: "https://arb1.arbitrum.io/rpc",
    ethUsdtPool: {
      address: "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443", // SushiSwap ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 0, usdt: 1 }
    },
    chainlinkFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" // ETH/USD Arbitrum预言机
  },
  optimism: {
    name: "Optimism", 
    rpcUrl: "https://optimism.publicnode.com",
    backupRpcUrl: "https://mainnet.optimism.io",
    ethUsdtPool: {
      address: "0x7B28472c1427C84435e112EE0AD1666bCD17f95E", // Optimism ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 1, usdt: 0 } // 这里token0是USDT，token1是ETH
    },
    chainlinkFeed: "0x13e3Ee699D1909E989722E753853AE30b17e08c5" // ETH/USD Optimism预言机
  },
  base: {
    name: "Base",
    rpcUrl: "https://base.publicnode.com",
    backupRpcUrl: "https://mainnet.base.org",
    ethUsdtPool: {
      address: "0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18", // BaseSwap ETH/USDT
      decimals: { eth: 18, usdt: 6 },
      order: { eth: 0, usdt: 1 }
    },
    chainlinkFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" // ETH/USD Base预言机
  },
  bsc: {
    name: "BSC",
    rpcUrl: "https://bsc-dataseed.binance.org",
    backupRpcUrl: "https://bsc-dataseed1.defibit.io",
    ethUsdtPool: {
      address: "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE", // PancakeSwap ETH/USDT
      decimals: { eth: 18, usdt: 18 },
      order: { eth: 0, usdt: 1 }
    },
    chainlinkFeed: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e" // ETH/USD BSC预言机
  },
  solana: {
    name: "Solana",
    isNonEVM: true,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    backupRpcUrl: "https://solana-api.projectserum.com",
    // Solana使用API方式获取价格，不需要池地址和Chainlink配置
  },
  sui: {
    name: "SUI",
    isNonEVM: true,
    rpcUrl: "https://fullnode.mainnet.sui.io",
    backupRpcUrl: "https://sui-mainnet-rpc.nodereal.io",
    // SUI使用API方式获取价格，不需要池地址和Chainlink配置
  }
};

// 函数签名常量
const FUNCTION_SIGNATURES = {
  getReserves: '0x0902f1ac', // UniswapV2式getReserves()函数
  latestAnswer: '0x50d25bcd' // Chainlink预言机latestAnswer()函数
};

// 获取最新区块号
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
    return '0x1'; // 使用区块1作为备选
  }
}

// 增强型价格监控器 - 自包含实现
class EnhancedPriceMonitor {
  constructor(suiClient, options = {}) {
    this.suiClient = suiClient;
    this.options = {
      cacheTTL: options.cacheTTL || 30000, // 缓存有效期（毫秒）
      retryLimit: options.retryLimit || 3,  // 重试次数
      timeout: options.timeout || 10000,    // 请求超时（毫秒）
      parallelRequests: options.parallelRequests || 4 // 并行请求数
    };
    
    // 初始化缓存和状态跟踪
    this.priceCache = new Map();
    this.lastPriceUpdate = new Map();
    this.monitoringTasks = new Map();
    this.latestBlocks = new Map();
    this.dataSources = ['dex', 'chainlink', 'backup'];
    
    console.log('已初始化增强型价格监控器，配置:', this.options);
  }
  
  // 获取支持的交易对信息
  getSupportedPairs() {
    return {
      chains: Object.keys(CHAIN_CONFIGS),
      tokens: ['ETH/USDT']
    };
  }
  
  // 批量获取ETH/USDT价格
  async batchGetEthUsdtPrices() {
    const results = new Map();
    const chains = Object.keys(CHAIN_CONFIGS);
    
    // 创建并行请求
    const pricePromises = chains.map(chainName => 
      this.getEthUsdtPrice(chainName)
        .then(price => ({ chainName, price, success: true }))
        .catch(error => {
          console.error(`批量获取${chainName}价格失败:`, error.message);
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
    
    return results;
  }
  
  // 获取单个链上的ETH/USDT价格
  async getEthUsdtPrice(chainName) {
    // 检查链是否受支持
    if (!CHAIN_CONFIGS[chainName]) {
      throw new Error(`不支持的链: ${chainName}`);
    }
    
    const cacheKey = `${chainName}:ETH/USDT`;
    const now = Date.now();
    const lastUpdate = this.lastPriceUpdate.get(cacheKey) || 0;
    
    // 如果有缓存且在有效期内，直接返回缓存值
    if (now - lastUpdate < this.options.cacheTTL) {
      const cachedPrice = this.priceCache.get(cacheKey);
      if (cachedPrice !== undefined) {
        console.log(`[缓存] ${chainName} ETH/USDT: $${cachedPrice.toFixed(2)}`);
        return cachedPrice;
      }
    }
    
    // 尝试不同的数据源获取价格
    for (const source of this.dataSources) {
      try {
        let price;
        
        switch (source) {
          case 'dex':
            price = await this.getPriceFromDex(chainName);
            break;
          case 'chainlink':
            price = await this.getPriceFromChainlink(chainName);
            break;
          case 'backup':
            price = await this.getPriceFromBackup(chainName);
            break;
        }
        
        if (price > 0) {
          // 更新缓存
          this.priceCache.set(cacheKey, price);
          this.lastPriceUpdate.set(cacheKey, Date.now());
          console.log(`[${source}] ${chainName} ETH/USDT: $${price.toFixed(2)}`);
          return price;
        }
      } catch (error) {
        console.error(`通过${source}获取${chainName}价格失败:`, error.message);
        // 继续尝试下一个数据源
      }
    }
    
    // 如果所有数据源都失败，检查是否有过期缓存可用
    const cachedPrice = this.priceCache.get(cacheKey);
    if (cachedPrice !== undefined) {
      console.log(`[过期缓存] ${chainName} ETH/USDT: $${cachedPrice.toFixed(2)}`);
      return cachedPrice;
    }
    
    throw new Error(`无法获取${chainName}的ETH/USDT价格`);
  }
  
  // 从DEX获取价格
  async getPriceFromDex(chainName) {
    const config = CHAIN_CONFIGS[chainName];
    const pool = config.ethUsdtPool;
    
    try {
      // 构建RPC请求
      const response = await axios.post(
        config.rpcUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            { to: pool.address, data: FUNCTION_SIGNATURES.getReserves },
            'latest'
          ]
        },
        { timeout: this.options.timeout }
      );
      
      if (response.data.error) {
        throw new Error(`RPC错误: ${response.data.error.message}`);
      }
      
      const result = response.data.result;
      
      // 解析getReserves返回值
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
          throw new Error('ETH储备量为0');
        }
        
        // 计算价格，考虑不同代币的小数位数
        const ethDecimals = pool.decimals.eth;
        const usdtDecimals = pool.decimals.usdt;
        const decimalAdjustment = 10n ** BigInt(ethDecimals - usdtDecimals);
        
        // ETH/USDT价格 = USDT储备 / (ETH储备 * 10^(ETH小数位-USDT小数位))
        const price = Number(usdtReserve) / (Number(ethReserve) / Number(decimalAdjustment));
        return price;
      } else {
        throw new Error('无效的RPC响应数据');
      }
    } catch (error) {
      throw new Error(`DEX查询失败: ${error.message}`);
    }
  }
  
  // 从Chainlink获取价格
  async getPriceFromChainlink(chainName) {
    const config = CHAIN_CONFIGS[chainName];
    const feedAddress = config.chainlinkFeed;
    
    if (!feedAddress) {
      throw new Error(`${chainName}未配置Chainlink Feed`);
    }
    
    try {
      // 构建RPC请求
      const response = await axios.post(
        config.rpcUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            { to: feedAddress, data: FUNCTION_SIGNATURES.latestAnswer },
            'latest'
          ]
        },
        { timeout: this.options.timeout }
      );
      
      if (response.data.error) {
        throw new Error(`RPC错误: ${response.data.error.message}`);
      }
      
      const result = response.data.result;
      
      // 解析latestAnswer返回值
      if (result && result.length >= 66) {
        // Chainlink返回值通常是8位小数
        const answerBigInt = BigInt(result);
        const price = Number(answerBigInt) / 1e8;
        return price;
      } else {
        throw new Error('无效的Chainlink响应数据');
      }
    } catch (error) {
      throw new Error(`Chainlink查询失败: ${error.message}`);
    }
  }
  
  // 从备用源获取价格
  async getPriceFromBackup(chainName) {
    try {
      // 使用CoinGecko API获取ETH价格
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', 
        { timeout: this.options.timeout }
      );
      
      if (response.data && response.data.ethereum && response.data.ethereum.usd) {
        return response.data.ethereum.usd;
      } else {
        throw new Error('无效的API响应数据');
      }
    } catch (error) {
      throw new Error(`备用源查询失败: ${error.message}`);
    }
  }
  
  // 计算价格差异
  calculatePriceSpread(price1, price2) {
    const min = Math.min(price1, price2);
    return min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
  }
  
  // 开始监控任务
  startMonitoring(task, interval = 30000) {
    if (this.monitoringTasks.has(task.id)) {
      console.warn(`任务${task.id}已在监控中`);
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
        const price1 = await this.getEthUsdtPrice(chain1Name);
        const price2 = await this.getEthUsdtPrice(chain2Name);
        
        // 计算价差
        const spread = this.calculatePriceSpread(price1, price2);
        
        console.log(`当前价差: ${chain1Name}($${price1.toFixed(2)}) vs ${chain2Name}($${price2.toFixed(2)}) = ${spread.toFixed(4)}%`);
        
        // 检查是否超过阈值
        if (spread > task.threshold) {
          const now = Date.now();
          if (!task.last_alert || (now - task.last_alert) > task.cooldown * 1000) {
            // 触发价格警报
            console.log(`⚠️ 价格警报(${task.id}): ${chain1Name}: $${price1.toFixed(2)} vs ${chain2Name}: $${price2.toFixed(2)}`);
            console.log(`⚠️ 价差: ${spread.toFixed(2)}% (超过阈值${task.threshold}%)`);
            task.last_alert = now;
          }
        }
      } catch (error) {
        console.error(`监控任务${task.id}出错:`, error.message);
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

// 测试主函数
async function testEnhancedPriceMonitor() {
  console.log('===== 增强型价格监控器测试 =====');
  console.log('🔍 特性: 多重数据源、容错机制、自动降级、智能缓存');
  
  // 初始化SUI客户端（用于与SUI链交互，实际测试中不会使用）
  const suiClient = new SuiClient({
    url: 'https://fullnode.mainnet.sui.io:443'
  });
  
  // 初始化增强型价格监控器（使用测试配置）
  console.log('\n🔄 初始化增强型价格监控器...');
  const priceMonitor = new EnhancedPriceMonitor(suiClient, {
    cacheTTL: 30000,        // 30秒缓存
    retryLimit: 2,          // 最多重试2次
    timeout: 10000,         // 10秒超时
    parallelRequests: 2     // 最多2个并行请求
  });
  
  // 等待初始化完成
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n✅ 初始化完成');
  
  try {
    // 测试1: 获取支持的交易对信息
    console.log('\n📋 测试1: 获取支持的交易对信息');
    const supportedPairs = priceMonitor.getSupportedPairs();
    console.log('支持的链:', supportedPairs.chains);
    console.log('支持的代币对:', supportedPairs.tokens);
    
    // 测试2: 批量获取所有链上的ETH/USDT价格
    console.log('\n📊 测试2: 批量获取所有链上的ETH/USDT价格');
    const startTime = Date.now();
    const allPrices = await priceMonitor.batchGetEthUsdtPrices();
    const endTime = Date.now();
    
    console.log(`批量查询耗时: ${endTime - startTime}ms\n`);
    if (allPrices.size === 0) {
      console.log('❌ 未获取到任何价格数据');
    } else {
      console.log('链名\t\tETH/USDT价格');
      console.log('------------------------');
      
      // 显示所有价格
      for (const [chainName, price] of allPrices.entries()) {
        console.log(`${chainName}\t\t$${price.toFixed(2)}`);
      }
      console.log('✅ 批量查询成功\n');
    }
    
    // 测试2.1: 专门测试新增链 (Solana, SUI, BSC)
    console.log('\n🌐 测试2.1: 专门测试新增链 (Solana, SUI, BSC)');
    const newChains = ['solana', 'sui', 'bsc'];
    const newChainResults = new Map();
    
    for (const chain of newChains) {
      console.log(`\n获取 ${chain.toUpperCase()} 上的ETH/USDT价格...`);
      try {
        console.time(`${chain} 查询`);
        const chainPrice = await priceMonitor.getEthUsdtPrice(chain);
        console.timeEnd(`${chain} 查询`);
        
        if (chainPrice > 0) {
          console.log(`✅ ${chain.toUpperCase()} ETH/USDT价格: $${chainPrice.toFixed(2)}`);
          newChainResults.set(chain, chainPrice);
        } else {
          console.log(`⚠️ ${chain.toUpperCase()} 返回了无效价格: ${chainPrice}`);
        }
      } catch (error) {
        console.log(`❌ ${chain.toUpperCase()} 查询失败: ${error.message}`);
      }
    }
    
    // 总结新链测试结果
    console.log('\n新增链测试结果:');
    console.table(
      [...newChainResults.entries()].map(([chain, price]) => ({
        链: chain.toUpperCase(),
        '价格(ETH/USDT)': `$${price.toFixed(2)}`,
        状态: '✅ 成功'
      }))
    );
    
    // 检查是否所有新链都成功获取了价格
    const successRate = newChainResults.size / newChains.length;
    console.log(`新增链测试成功率: ${(successRate * 100).toFixed(1)}% (${newChainResults.size}/${newChains.length})`);
    
    // 测试3: 单独查询特定链的价格
    console.log('\n💰 测试3: 单独查询特定链的价格');
    
    // 选择一个成功的链进行单独查询
    const testChain = allPrices.size > 0 ? 
      Array.from(allPrices.keys())[0] : 'ethereum';
    
    console.log(`尝试查询 ${testChain} 的ETH/USDT价格...`);
    
    console.time('首次查询');
    const price = await priceMonitor.getEthUsdtPrice(testChain);
    console.timeEnd('首次查询');
    console.log(`${testChain} ETH/USDT价格: $${price.toFixed(2)}`);
    
    // 测试缓存
    console.log('\n再次查询以测试缓存效果:');
    
    console.time('缓存查询');
    const cachedPrice = await priceMonitor.getEthUsdtPrice(testChain);
    console.timeEnd('缓存查询');
    console.log(`${testChain} ETH/USDT缓存价格: $${cachedPrice.toFixed(2)}`);
    
    // 测试4: 价差计算
    console.log('\n📉 测试4: 计算链间价格差异');
    
    // 筛选出有效价格
    const validPrices = new Map();
    allPrices.forEach((price, chainName) => {
      if (price > 0) validPrices.set(chainName, price);
    });
    // 添加新链的价格到有效价格表中
    newChainResults.forEach((price, chainName) => {
      validPrices.set(chainName, price);
    });
    
    if (validPrices.size < 2) {
      console.log('⚠️ 有效价格不足两个，无法计算价差');
    } else {
      // 计算所有链对之间的价差
      const validChains = Array.from(validPrices.keys());
      const priceMatrix = [];
      
      for (let i = 0; i < validChains.length; i++) {
        for (let j = i + 1; j < validChains.length; j++) {
          const chain1 = validChains[i];
          const chain2 = validChains[j];
          
          const price1 = validPrices.get(chain1) || 0;
          const price2 = validPrices.get(chain2) || 0;
          
          // 计算价差百分比
          const spread = priceMonitor.calculatePriceSpread(price1, price2);
          
          priceMatrix.push({
            链对: `${chain1} vs ${chain2}`,
            价格1: `$${price1.toFixed(2)}`,
            价格2: `$${price2.toFixed(2)}`,
            价差: `${spread.toFixed(4)}%`,
            异常: spread > 0.5 ? '⚠️' : '✅' // 0.5%作为异常阈值
          });
        }
      }
      
      // 显示价差矩阵
      console.table(priceMatrix);
    }
    
    // 测试5: 启动监控任务
    console.log('\n🔔 测试5: 启动价格监控任务');
    
    // 如果有至少两个有效价格，创建监控任务
    if (validPrices.size >= 2) {
      const validChains = Array.from(validPrices.keys());
      const chain1 = validChains[0];
      const chain2 = validChains[1];
      
      const monitorTask = {
        id: 'test-monitor',
        name: `${chain1}-${chain2}价差监控`,
        chain_pairs: [`${chain1}:ETH/USDT`, `${chain2}:ETH/USDT`],
        token_pairs: ['ETH/USDT'],
        threshold: 0.5,  // 0.5%价差阈值
        cooldown: 10,    // 10秒冷却期
        active: true
      };
      
      console.log(`创建监控任务: ${monitorTask.name}`);
      console.log(`监控阈值: ${monitorTask.threshold}%`);
      console.log(`冷却期: ${monitorTask.cooldown}秒\n`);
      
      // 启动监控（短时间测试）
      priceMonitor.startMonitoring(monitorTask, 5000); // 5秒检查一次
      
      // 运行30秒后停止
      console.log('监控任务已启动，将在30秒后停止...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      priceMonitor.stopMonitoring('test-monitor');
      console.log('\n✅ 监控任务已停止');
    } else {
      console.log('⚠️ 有效价格不足两个，无法创建监控任务');
    }
    
  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error instanceof Error ? error.message : String(error));
  } finally {
    console.log('\n===== 测试结束 =====');
  }
}

// 执行测试
testEnhancedPriceMonitor().catch(error => {
  console.error('❌ 测试执行失败:', error);
}); 