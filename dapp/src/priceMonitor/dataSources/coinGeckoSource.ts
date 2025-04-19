/**
 * CoinGecko数据源
 */
import axios from 'axios';
import { PriceDataSource } from '../interfaces';
import { CHAIN_CONFIGS } from '../chainConfigs';

// CoinGecko API端点
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// CoinGecko数据源类
export class CoinGeckoSource implements PriceDataSource {
  public readonly name = 'CoinGecko';
  public readonly priority = 4; // 最低优先级（备用）

  private apiKey: string;
  private lastRequestTime: number = 0;
  private requestInterval: number = 1000; // 限制请求频率，避免超出API限制

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  /**
   * 实现PriceDataSource接口的getPrice方法
   */
  public async getPrice(chainName: string): Promise<number> {
    // CoinGecko不区分链，只返回全局ETH价格
    console.log(`从CoinGecko获取ETH/USD价格作为备用数据源`);
    
    // 限制请求频率
    await this.rateLimit();
    
    try {
      return await this.getEthUsdPrice();
    } catch (error) {
      console.error(`从CoinGecko获取ETH价格失败:`, error);
      throw error;
    }
  }

  /**
   * 获取ETH/USD价格
   */
  private async getEthUsdPrice(): Promise<number> {
    const url = `${COINGECKO_API}/simple/price`;
    
    const params: Record<string, string> = {
      ids: 'ethereum',
      vs_currencies: 'usd',
      include_24hr_change: 'true'
    };
    
    // 如果有API密钥，添加到请求中
    if (this.apiKey) {
      params['x_cg_api_key'] = this.apiKey;
    }
    
    const response = await axios.get(url, { params });
    
    if (!response.data || !response.data.ethereum || !response.data.ethereum.usd) {
      throw new Error('CoinGecko API返回无效数据');
    }
    
    const price = response.data.ethereum.usd;
    console.log(`ETH/USD 从CoinGecko获取的价格: $${price.toFixed(2)}`);
    
    return price;
  }

  /**
   * 限制请求频率
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.requestInterval) {
      const delay = this.requestInterval - elapsed;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
} 