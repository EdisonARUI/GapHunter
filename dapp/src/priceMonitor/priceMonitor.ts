import { TaskConfig } from '../types/task.ts';
import { SuiClient } from '@mysten/sui.js/client';
import axios from 'axios';

// 使用require导入CommonJS模块
const wormholeQuerySdk = require('@wormhole-foundation/wormhole-query-sdk');
const {
  EthCallQueryRequest,
  EthCallQueryResponse,
  PerChainQueryRequest,
  QueryProxyMock,
  QueryRequest,
  QueryResponse,
} = wormholeQuerySdk;

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV !== 'production';

// Wormhole链ID映射
const CHAIN_IDS = {
  ethereum: 2,
  bsc: 4, // Binance Smart Chain
  solana: 1,
  sui: 21,
//   avalanche: 6,
//   polygon: 5,
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
  },
  bsc: {
    address: '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE', // PancakeSwap BNB/USDT
    decimals: { eth: 18, usdt: 18 },
    order: { eth: 0, usdt: 1 }
  },
  solana: {
    address: '8JPJJkmDScpcNmBRKGZuPuG2GYAveQgP3t5gFuMymwvF', // Raydium SOL/USDT
    decimals: { eth: 9, usdt: 6 },
    order: { eth: 0, usdt: 1 }
  },
  sui: {
    address: '0x5eb232c309d38d73dc095aea0376daf260588689c0ee24e7sd69b6c3a67556bf4', // Cetus SUI/USDT
    decimals: { eth: 9, usdt: 6 },
    order: { eth: 0, usdt: 1 }
  }
};

// 函数签名常量
const FUNCTION_SIGNATURES = {
  getReserves: '0x0902f1ac', // UniswapV2式getReserves()函数
  slot0: '0x3850c7bd', // UniswapV3 slot0()函数
  latestAnswer: '0x50d25bcd', // Chainlink预言机latestAnswer()函数
}

// Wormhole Queries API URL
const QUERY_URL = isDevelopment
  ? 'https://testnet.query.wormhole.com/v1/query'
  : 'https://query.wormhole.com/v1/query';

// 从环境变量获取API密钥
const API_KEY = process.env.WORMHOLE_API_KEY || '';

export class PriceMonitor {
    private suiClient: SuiClient;
    private priceCache: Map<string, number>;
    private monitoringTasks: Map<string, NodeJS.Timeout>;
    private rpcEndpoints: Record<number, string>;
    private lastPriceUpdate: Map<string, number>; // 记录每个代币最后更新时间

    constructor(suiClient: SuiClient, rpcEndpoints: Record<number, string>) {
        this.suiClient = suiClient;
        this.priceCache = new Map();
        this.monitoringTasks = new Map();
        this.rpcEndpoints = rpcEndpoints;
        this.lastPriceUpdate = new Map();
    }

    // 批量获取多个EVM链上的ETH/USDT价格
    public async batchGetEthUsdtPrices(): Promise<Map<string, number>> {
        try {
            // 准备查询目标
            const targets = Object.entries(CHAIN_IDS).map(([chainName, chainId]) => {
                const pool = ETH_USDT_POOLS[chainName as keyof typeof ETH_USDT_POOLS];
                if (!pool) return null;
                
                return {
                    chainId,
                    chainName,
                    address: pool.address,
                    data: FUNCTION_SIGNATURES.getReserves
                };
            }).filter(Boolean) as Array<{
                chainId: number;
                chainName: string;
                address: string;
                data: string;
            }>;

            if (targets.length === 0) {
                console.warn('No valid ETH/USDT pool targets configured');
                return new Map();
            }

            // 构建per-chain查询请求
            const perChainRequests = targets.map(t =>
                new PerChainQueryRequest(
                    t.chainId,
                    new EthCallQueryRequest('latest', [
                        { to: t.address, data: t.data }
                    ])
                )
            );

            // 构建完整查询请求
            const request = new QueryRequest(0, perChainRequests);
            const serialized = request.serialize();
            
            let response: any;
            
            if (isDevelopment && !API_KEY) {
                // 开发环境使用Mock
                console.log('Using QueryProxyMock for ETH/USDT prices');
                const mock = new QueryProxyMock(
                    // 为每个链配置RPC
                    Object.fromEntries(
                        targets.map(t => [t.chainId, this.rpcEndpoints[t.chainId]])
                    )
                );
                response = await mock.mock(request);
            } else {
                // 生产环境发送到Wormhole Queries服务
                response = await axios.post(
                    QUERY_URL,
                    { bytes: Buffer.from(serialized).toString('hex') },
                    { 
                        headers: { 
                            'Content-Type': 'application/json',
                            ...(API_KEY ? { 'X-API-Key': API_KEY } : {})
                        } 
                    }
                );
            }

            // 根据响应类型获取字节数据
            let bytes: string;
            if (isDevelopment && !API_KEY) {
                // Mock响应格式
                bytes = (response as { bytes: string }).bytes;
            } else {
                // API响应格式
                bytes = (response as { data: { bytes: string } }).data.bytes;
            }
            
            // 解析查询响应
            const queryResponse = QueryResponse.from(bytes);
            const results = new Map<string, number>();
            
            // 处理每个链的响应结果
            for (let i = 0; i < queryResponse.responses.length; i++) {
                const target = targets[i];
                const chainResponse = queryResponse.responses[i].response as typeof EthCallQueryResponse;
                
                if (!chainResponse.results || chainResponse.results.length === 0) {
                    console.warn(`No results for ${target.chainName}`);
                    continue;
                }
                
                const result = chainResponse.results[0];
                const pool = ETH_USDT_POOLS[target.chainName as keyof typeof ETH_USDT_POOLS];
                
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
        } catch (error) {
            console.error('Failed to batch get ETH/USDT prices:', error);
            
            // 返回缓存的价格作为备选
            const cachedResults = new Map<string, number>();
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

    // 获取单个链上的ETH/USDT价格
    public async getEthUsdtPrice(chainName: string): Promise<number> {
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
                return cachedPrice;
            }
        }
        
        // 否则获取新的价格数据
        const prices = await this.batchGetEthUsdtPrices();
        const price = prices.get(chainName);
        
        if (price === undefined) {
            throw new Error(`Failed to get ETH/USDT price for ${chainName}`);
        }
        
        return price;
    }

    // 计算价格差异
    private calculatePriceSpread(price1: number, price2: number): number {
        const min = Math.min(price1, price2);
        return min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
    }

    // 检查价格是否异常
    private isPriceAbnormal(price1: number, price2: number, threshold: number): boolean {
        const spread = this.calculatePriceSpread(price1, price2);
        return spread > threshold;
    }

    // 开始监控任务
    public startMonitoring(task: TaskConfig, interval: number = 30000): void {
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
                        console.log(`Price alert for task ${task.id}: ${chain1Name}: ${price1} vs ${chain2Name}: ${price2}`);
                        console.log(`Price spread: ${this.calculatePriceSpread(price1, price2).toFixed(2)}%`);
                        task.last_alert = now;
                    }
                }
            } catch (error) {
                console.error(`Error monitoring task ${task.id}:`, error);
            }
        };

        // 立即执行一次监控
        monitor();
        
        // 设置定时监控
        const timer = setInterval(monitor, interval);
        this.monitoringTasks.set(task.id, timer);
    }

    // 停止监控任务
    public stopMonitoring(taskId: string): void {
        const timer = this.monitoringTasks.get(taskId);
        if (timer) {
            clearInterval(timer);
            this.monitoringTasks.delete(taskId);
        }
    }

    // 停止所有监控任务
    public stopAllMonitoring(): void {
        for (const timer of this.monitoringTasks.values()) {
            clearInterval(timer);
        }
        this.monitoringTasks.clear();
    }
} 