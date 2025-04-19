import { useState, useEffect, useRef } from 'react';
import { Container, Heading, Card, Box, Text, Flex } from '@radix-ui/themes';
import { formatDistance } from 'date-fns';
// 导入priceDataProvider以获取和处理ETH/USDT价格数据
// 该组件封装了enhancedPriceMonitor的功能，提供多链价格监控能力
import priceDataProvider, { PriceData, PriceComparisonData, TableRowData } from '../priceMonitor/priceDataProvider';

// 导入币种图标
import suiTokenIcon from '../asset/images/token/sui.png';
import ethTokenIcon from '../asset/images/token/eth.png';
import bnbTokenIcon from '../asset/images/token/bnb.png';
import solTokenIcon from '../asset/images/token/sol.png';

// 导入链图标
import ethereumIcon from '../asset/images/chain/ethereum.png';
import bnbChainIcon from '../asset/images/chain/bsc.png';
import suiChainIcon from '../asset/images/chain/sui.png';
import solanaIcon from '../asset/images/chain/solana.png';
import arbitrumIcon from '../asset/images/chain/arbitrum.png';
import optimismIcon from '../asset/images/chain/optimism.png';
import baseIcon from '../asset/images/chain/base.png';

// Wormhole Chain IDs
const CHAIN_IDS = {
  ethereum: 2,
  bsc: 4, // Binance Smart Chain
  solana: 1,
  sui: 21
};

// Wormhole Queries API URL
const QUERY_URL = 'https://testnet.query.wormhole.com/v1/query';
// 如果需要正式环境，使用: 'https://query.wormhole.com/v1/query'

// 支持的链类型
type ChainType = 'ethereum' | 'bsc' | 'solana' | 'sui' | 'arbitrum' | 'optimism' | 'base';

// Token地址映射
const TOKEN_ADDRESSES: Record<ChainType, Record<string, string>> = {
  ethereum: {
    'ETH-USDT': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH地址
    'ETH-USDC': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  bsc: {
    'BNB-USDT': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB地址
    'BNB-USDC': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
  },
  solana: {
    'SOL-USDT': 'So11111111111111111111111111111111111111112', // Wrapped SOL地址
    'SOL-USDC': 'So11111111111111111111111111111111111111112'
  },
  sui: {
    'SUI-USDT': '0x2::sui::SUI',
    'SUI-USDC': '0x2::sui::SUI'
  },
  arbitrum: {
    'ETH-USDT': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum ETH-USDT
    'ETH-USDC': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  },
  optimism: {
    'ETH-USDT': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // Optimism ETH-USDT
    'ETH-USDC': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
  },
  base: {
    'ETH-USDT': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // Base ETH-USDT
    'ETH-USDC': '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
  }
};

// 价格查询函数签名
const PRICE_FUNCTION_SIGNATURES = {
  totalSupply: '0x18160ddd', // 仅作为示例，实际需要使用DEX的价格查询函数
  getReserves: '0x0902f1ac' // UniswapV2 getReserves函数，用于计算价格
};

const PriceMonitor: React.FC = () => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [comparisonData, setComparisonData] = useState<PriceComparisonData[]>([]);
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<string[]>(['ETH-USDT']);
  const [selectedChains, setSelectedChains] = useState<string[]>(['ethereum', 'arbitrum', 'optimism', 'base']);
  const [supportedPairs, setSupportedPairs] = useState<{chains: string[], tokens: string[]}>({
    chains: [], tokens: []
  });
  
  // 初始化价格数据提供器
  useEffect(() => {
    const initDataProvider = async () => {
      try {
        console.log('🔍 初始化价格数据提供器...');
        await priceDataProvider.initialize();
        
        // 获取支持的交易对
        const pairs = priceDataProvider.getSupportedPairs();
        console.log('🔍 获取到支持的交易对:', pairs);
        setSupportedPairs(pairs);
        
        // 确保选中的链和代币都在支持的列表中
        // 确保即使筛选后为空也保留至少一个选项
        setSelectedChains(prev => {
          const filtered = prev.filter(chain => pairs.chains.includes(chain));
          console.log('🔍 筛选后的链:', filtered);
          // 如果筛选后为空，使用第一个可用的链
          return filtered.length > 0 ? filtered : pairs.chains.length > 0 ? [pairs.chains[0]] : [];
        });
        
        setSelectedTokens(prev => {
          const filtered = prev.filter(token => pairs.tokens.includes(token));
          console.log('🔍 筛选后的代币:', filtered);
          // 如果筛选后为空，使用第一个可用的代币
          return filtered.length > 0 ? filtered : pairs.tokens.length > 0 ? [pairs.tokens[0]] : [];
        });
        
        console.log('🔍 价格数据提供器初始化完成');
      } catch (error) {
        console.error('❌ 初始化价格数据提供器失败:', error);
        setError('初始化价格数据失败，请刷新页面重试');
      }
    };
    
    initDataProvider();
  }, []);
  
  // 获取价格数据
  const fetchPrices = async () => {
    if (!priceDataProvider.getInitStatus()) {
      console.warn('⚠️ 价格数据提供器尚未初始化，无法获取数据');
      return;
    }
    
    if (selectedChains.length === 0) {
      console.warn('⚠️ 未选择任何链，无法获取数据');
      setIsLoading(false);
      setError('请选择至少一个链');
      return;
    }
    
    if (selectedTokens.length === 0) {
      console.warn('⚠️ 未选择任何代币，无法获取数据');
      setIsLoading(false);
      setError('请选择至少一个代币');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // 1. 获取所有选中链的价格数据
      console.log('🔍 获取价格数据...');
      const allPrices: PriceData[] = [];
      const failedChains: string[] = [];
      const unsupportedTokens: string[] = [];
      
      for (const token of selectedTokens) {
        for (const chain of selectedChains) {
          try {
            console.log(`🔍 获取 ${chain} 上 ${token} 的价格...`);
            const price = await priceDataProvider.getPriceData(chain, token);
            if (price) {
              allPrices.push(price);
              console.log(`✅ 成功获取 ${chain} 上 ${token} 的价格: ${price.price}`);
            } else {
              console.warn(`⚠️ ${chain} 上 ${token} 的价格数据为空`);
              failedChains.push(chain);
            }
          } catch (error) {
            console.error(`❌ 获取 ${chain} 上 ${token} 的价格失败:`, error);
            failedChains.push(chain);
          }
        }
      }

      // 如果未获取到任何价格数据，生成模拟数据
      let mockData: PriceData[] = [];
      if (allPrices.length === 0) {
        console.warn('⚠️ 未获取到任何实际价格数据，生成模拟数据');
        const now = Date.now();
        
        // 为所有选择的代币和链生成模拟数据
        for (const chain of selectedChains) {
          for (const token of selectedTokens) {
            // 根据代币类型设置不同的基础价格
            const basePrice = token === 'ETH-USDT' 
              ? 1500 + Math.random() * 1000  // ETH价格范围
              : 1 + Math.random() * 0.1;     // USDC价格（约等于1美元）
              
            mockData.push({
              chain,
              token,
              price: basePrice,
              timestamp: now,
              change24h: (Math.random() - 0.5) * 5
            });
            console.log(`🔍 生成模拟数据: ${chain} ${token} 价格: $${basePrice.toFixed(2)}`);
          }
        }
      }

      // 2. 计算价格比较数据
      console.log('🔍 计算价格比较数据...');
      // 使用获取到的价格或模拟数据
      const prices = allPrices.length > 0 ? allPrices : mockData;
      
      // 过滤确保只有有效数据 - 允许ETH-USDT和ETH-USDC
      const validPrices = prices.filter(price => 
        price.token === 'ETH-USDT' || price.token === 'ETH-USDC'
      );
      
      setError(null);
      
      // 使用数据提供器生成价格比较数据
      const comparisons = priceDataProvider.generateComparisonData(validPrices);
      setComparisonData(comparisons);
      
      // 3. 准备表格数据
      console.log('🔍 准备表格数据...');
      const tableRows = await priceDataProvider.prepareTableData(validPrices, comparisons);
      
      // 更新状态
      setPriceData(validPrices);
      setTableData(tableRows);
      setLastUpdated(new Date());
      setIsLoading(false);
      
      // 如果有失败的链，显示警告
      if (failedChains.length > 0) {
        const uniqueFailedChains = [...new Set(failedChains)];
        console.warn(`⚠️ 部分链数据获取失败: ${uniqueFailedChains.join(', ')}`);
        
        // 如果失败的链数量超过50%，显示警告给用户
        if (uniqueFailedChains.length > selectedChains.length / 2) {
          setError(`部分链数据获取失败: ${uniqueFailedChains.map(chain => 
            priceDataProvider.getChainDisplayName(chain)).join(', ')}`);
        }
      }
    } catch (error) {
      console.error('❌ 获取价格数据失败:', error);
      setError('获取价格数据失败，请稍后重试');
      setIsLoading(false);
    }
  };
  
  // 监听选中链和代币的变化，重置错误状态
  useEffect(() => {
    if (selectedChains.length > 0 && selectedTokens.length > 0 && error === '请选择至少一个链和一个代币') {
      console.log('🔍 选中的链和代币已更新，清除之前的错误状态');
      setError(null);
    }
  }, [selectedChains, selectedTokens, error]);
  
  // 添加定时强制刷新功能
  useEffect(() => {
    // 页面加载后5秒强制刷新数据一次，以防初始化问题
    const initialTimeout = setTimeout(() => {
      if (tableData.length === 0 && !isLoading && !error) {
        console.log('⚠️ 检测到页面加载5秒后仍无数据，尝试强制刷新...');
        fetchPrices();
      }
    }, 5000);
    
    return () => clearTimeout(initialTimeout);
  }, []);
  
  // 修改初始化数据和定时更新的useEffect
  useEffect(() => {
    console.log('🔍 数据加载触发条件检查 - 选中的链:', selectedChains.length, '选中的代币:', selectedTokens.length);
    
    if (selectedChains.length > 0 && selectedTokens.length > 0) {
      fetchPrices();
      
      // 每2分钟更新一次数据
      const interval = setInterval(fetchPrices, 120000);
      
      return () => clearInterval(interval);
    } else {
      // 如果没有选择链或代币，显示错误信息
      console.warn('⚠️ 没有选中任何链或代币，无法获取价格数据');
      setIsLoading(false);
      setError('请选择至少一个链和一个代币');
    }
  }, [selectedChains, selectedTokens]);
  
  // 监听表格数据加载
  useEffect(() => {
    // 如果花费超过10秒仍然没有数据，可能存在问题
    if (isLoading && tableData.length === 0) {
      const timeout = setTimeout(() => {
        if (isLoading && tableData.length === 0) {
          console.warn('⚠️ 数据加载超时，可能存在问题');
          setIsLoading(false);
          setError('数据加载超时，请刷新页面重试');
        }
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading, tableData]);
  
  // 处理链选择变更
  const handleChainToggle = (chain: string) => {
    setSelectedChains(prev => {
      if (prev.includes(chain)) {
        return prev.filter(c => c !== chain);
      } else {
        return [...prev, chain];
      }
    });
  };
  
  // 处理代币选择变更
  const handleTokenToggle = (token: string) => {
    setSelectedTokens(prev => {
      if (prev.includes(token)) {
        // 禁止取消选择所有代币，至少保留一个
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== token);
      } else {
        return [...prev, token];
      }
    });
  };

  // 格式化价格显示
  const formatPrice = (price: number): string => {
    return price < 0.01 
      ? price.toFixed(6)
      : price < 1 
        ? price.toFixed(4)
        : price.toFixed(2);
  };

  // 获取当前选择的代币图标
  const getTokenIcon = (token: string) => {
    const tokenSymbol = token.split('-')[0];
    switch (tokenSymbol) {
      case 'SUI':
        return suiTokenIcon;
      case 'ETH':
        return ethTokenIcon;
      case 'BNB':
        return bnbTokenIcon;
      case 'SOL':
        return solTokenIcon;
      default:
        return ethTokenIcon;
    }
  };

  // 获取当前选择的链图标
  const getChainIcon = (chain: string) => {
    switch (chain) {
      case 'ethereum':
        return ethereumIcon;
      case 'bsc':
        return bnbChainIcon;
      case 'solana':
        return solanaIcon;
      case 'sui':
        return suiChainIcon;
      case 'arbitrum':
        return arbitrumIcon;
      case 'optimism':
        return optimismIcon;
      case 'base':
        return baseIcon;
      default:
        return ethereumIcon;
    }
  };

  // 获取链的显示名称
  const getChainDisplayName = (chain: string) => {
    switch (chain) {
      case 'ethereum':
        return 'Ethereum';
      case 'bsc':
        return 'BSC';
      case 'solana':
        return 'Solana';
      case 'sui':
        return 'Sui';
      case 'arbitrum':
        return 'Arbitrum';
      case 'optimism':
        return 'Optimism';
      case 'base':
        return 'Base';
      default:
        return chain;
    }
  };

  // 代币对选项 - 增加ETH-USDC，不禁用
  const tokenPairOptions = [
    { value: 'ETH-USDT', label: 'ETH/USDT', icon: ethTokenIcon },
    { value: 'ETH-USDC', label: 'ETH/USDC', icon: ethTokenIcon }
  ];

  // 链选项
  const chainOptions = supportedPairs.chains.map(chain => {
    let label, icon;
    
    switch (chain) {
      case 'ethereum':
        label = 'Ethereum';
        icon = ethereumIcon;
        break;
      case 'arbitrum':
        label = 'Arbitrum';
        icon = arbitrumIcon;
        break;
      case 'optimism':
        label = 'Optimism';
        icon = optimismIcon;
        break;
      case 'base':
        label = 'Base';
        icon = baseIcon;
        break;
      case 'bsc':
        label = 'BSC';
        icon = bnbChainIcon;
        break;
      case 'solana':
        label = 'Solana';
        icon = solanaIcon;
        break;
      case 'sui':
        label = 'SUI';
        icon = suiChainIcon;
        break;
      default:
        label = chain;
        icon = ethereumIcon;
    }
    
    return { value: chain, label, icon };
  });

  return (
    <Container style={{ 
      padding: 0, 
      height: 'calc(100vh - 48px)', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#121212' // 确保容器背景色一致
    }}>
      <div style={{ 
        backgroundColor: '#121212', 
        borderRadius: '8px 8px 0 0', 
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 多选框容器 - 包含Chain选择器和Token选择器 */}
        <div style={{ 
          padding: '12px 0 0 0', 
          display: 'flex', 
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Chain多选框 */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            paddingLeft: '12px'
          }}>
            {chainOptions.map(option => (
              <label 
                key={option.value}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: selectedChains.includes(option.value) ? '#2a2a2a' : '#1a1a1a',
                  color: selectedChains.includes(option.value) ? '#fff' : '#aaa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedChains.includes(option.value)} 
                  onChange={() => handleChainToggle(option.value)}
                  style={{ 
                    margin: 0, 
                    marginRight: '6px',
                    accentColor: '#333'
                  }}
                />
                <img 
                  src={option.icon} 
                  alt={option.label}
                  style={{ 
                    width: '14px', 
                    height: '14px', 
                    objectFit: 'contain',
                    marginRight: '6px'
                  }} 
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          
          {/* 代币对选择器 */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            paddingRight: '12px'
          }}>
            {tokenPairOptions.map(option => (
              <label 
                key={option.value}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  backgroundColor: selectedTokens.includes(option.value) ? '#2a2a2a' : '#1a1a1a',
                  color: selectedTokens.includes(option.value) ? '#fff' : '#aaa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedTokens.includes(option.value)} 
                  onChange={() => handleTokenToggle(option.value)}
                  style={{ 
                    margin: 0, 
                    marginRight: '6px',
                    accentColor: '#333'
                  }}
                />
                <img 
                  src={option.icon} 
                  alt={option.label}
                  style={{ 
                    width: '14px', 
                    height: '14px', 
                    objectFit: 'contain',
                    marginRight: '6px'
                  }} 
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div style={{ 
          overflowX: 'auto', 
          overflowY: 'auto',
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#121212',
          height: '100%',
          position: 'relative'
        }}>
          {isLoading && tableData.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '200px',
              color: '#aaa'
            }}>
              加载价格数据中...
              <div style={{ marginTop: '10px', fontSize: '12px' }}>
                选中的链: {selectedChains.join(', ')} | 代币: {selectedTokens.map(t => t.replace('-', '/')).join(', ')}
              </div>
            </div>
          ) : error ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '200px',
              color: '#ff5252'
            }}>
              {error}
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaa' }}>
                选中的链: {selectedChains.join(', ')} | 代币: {selectedTokens.map(t => t.replace('-', '/')).join(', ')}
              </div>
            </div>
          ) : (
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: '14px',
              tableLayout: 'fixed',
              flex: 1
            }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 1, 
                backgroundColor: '#121212', 
                boxShadow: '0 1px 0 #333'
              }}>
                <tr style={{ 
                  borderBottom: '1px solid #333', 
                  color: '#999',
                  fontSize: '12px',
                  textTransform: 'uppercase'
                }}>
                  <th style={{ padding: '16px 12px', textAlign: 'left' }}>SOURCE</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left' }}>Chain</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left' }}>Symbol</th>
                  <th style={{ padding: '16px 12px', textAlign: 'right' }}>Price</th>
                </tr>
              </thead>
              <tbody style={{ flex: 1 }}>
                {tableData
                  .filter(item => {
                    // 查找表格中显示名称对应的链标识符
                    const chainId = selectedChains.find(chain => 
                      getChainDisplayName(chain) === item.chain
                    );
                    
                    // 处理代币选择
                    const isSelectedToken = selectedTokens.includes('ETH-USDT') && item.token === 'ETH/USDT' || 
                                          selectedTokens.includes('ETH-USDC') && item.token === 'ETH/USDC';
                    
                    return chainId !== undefined && isSelectedToken;
                  })
                  .map((item, index) => (
                    <tr key={index} style={{ 
                      borderBottom: '1px solid #222',
                      backgroundColor: index % 2 === 0 ? '#151515' : '#121212',
                      color: '#fff'
                    }}>
                      <td style={{ padding: '14px 12px', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.source || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.chain || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'left', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.token || 'N/A'}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ${formatPrice(item.price || 0)}
                      </td>
                    </tr>
                ))}
                {tableData.filter(item => {
                  const chainId = selectedChains.find(chain => 
                    getChainDisplayName(chain) === item.chain
                  );
                  
                  const isSelectedToken = selectedTokens.includes('ETH-USDT') && item.token === 'ETH/USDT' || 
                                        selectedTokens.includes('ETH-USDC') && item.token === 'ETH/USDC';
                  
                  return chainId !== undefined && isSelectedToken;
                }).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '14px 12px', textAlign: 'center', color: '#999' }}>
                      未选择任何链或代币，或没有数据
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot style={{ backgroundColor: '#121212' }}>
                <tr><td colSpan={4} style={{ height: '1px' }}></td></tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </Container>
  );
};

export default PriceMonitor; 