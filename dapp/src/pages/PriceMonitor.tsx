import { useState, useEffect, useRef } from 'react';
import { Container, Heading, Card, Box, Text, Flex } from '@radix-ui/themes';
import { formatDistance } from 'date-fns';
// Import priceDataProvider to fetch and process ETH/USDT price data
// This component wraps enhancedPriceMonitor functionality to provide multi-chain price monitoring
import priceDataProvider, { PriceData, PriceComparisonData, TableRowData } from '../priceMonitor/priceDataProvider';

// Import token icons
import suiTokenIcon from '../asset/images/token/sui.png';
import ethTokenIcon from '../asset/images/token/eth.png';
import bnbTokenIcon from '../asset/images/token/bnb.png';
import solTokenIcon from '../asset/images/token/sol.png';

// Import chain icons
import ethereumIcon from '../asset/images/chain/ethereum.png';
import bnbChainIcon from '../asset/images/chain/bsc.png';
import suiChainIcon from '../asset/images/chain/sui.png';
import solanaIcon from '../asset/images/chain/solana.png';
import arbitrumIcon from '../asset/images/chain/arbitrum.png';
import optimismIcon from '../asset/images/chain/optimism.png';
import baseIcon from '../asset/images/chain/base.png';

// Define reusable styles
const styles = {
  container: {
    padding: 0,
    height: 'calc(100vh - 48px)',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#121212',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: '8px 8px 0 0',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  filtersContainer: {
    padding: '12px 0 0 0',
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterGroup: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  filterItemBase: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    transition: 'all 0.2s',
    userSelect: 'none' as const,
    cursor: 'pointer',
  },
  filterItemSelected: {
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
  },
  filterItemUnselected: {
    backgroundColor: '#1A1A1A',
    color: '#AAAAAA',
  },
  checkbox: {
    margin: 0,
    marginRight: '6px',
    accentColor: '#333',
  },
  icon: {
    width: '14px',
    height: '14px',
    objectFit: 'contain' as const,
    marginRight: '6px',
  },
  contentContainer: {
    overflowX: 'auto' as const,
    overflowY: 'auto' as const,
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#121212',
    height: '100%',
    position: 'relative' as const,
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#AAAAAA',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#FF5252',
  },
  statusText: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#AAAAAA',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
    tableLayout: 'fixed' as const,
    flex: 1,
  },
  tableHeader: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
    backgroundColor: '#121212',
    boxShadow: '0 1px 0 #333',
  },
  tableHeaderRow: {
    borderBottom: '1px solid #333',
    color: '#999999',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
  },
  tableHeaderCell: {
    padding: '16px 12px',
    textAlign: 'left' as const,
  },
  tableHeaderCellRight: {
    padding: '16px 12px',
    textAlign: 'right' as const,
  },
  tableRowEven: {
    borderBottom: '1px solid #222',
    backgroundColor: '#151515',
    color: '#FFFFFF',
  },
  tableRowOdd: {
    borderBottom: '1px solid #222',
    backgroundColor: '#121212',
    color: '#FFFFFF',
  },
  tableCell: {
    padding: '14px 12px',
    textAlign: 'left' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableCellNumeric: {
    padding: '14px 12px',
    textAlign: 'right' as const,
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableCellToken: {
    padding: '14px 12px',
    textAlign: 'left' as const,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tableFooter: {
    backgroundColor: '#121212',
  },
  emptyTableMessage: {
    padding: '14px 12px',
    textAlign: 'center' as const,
    color: '#999999',
  },
};

// Wormhole Chain IDs
const CHAIN_IDS = {
  ethereum: 2,
  bsc: 4, // Binance Smart Chain
  solana: 1,
  sui: 21
};

// Wormhole Queries API URL
const QUERY_URL = 'https://testnet.query.wormhole.com/v1/query';
// For production environment, use: 'https://query.wormhole.com/v1/query'

// Supported chain types
type ChainType = 'ethereum' | 'bsc' | 'solana' | 'sui' | 'arbitrum' | 'optimism' | 'base';

// Token address mapping
const TOKEN_ADDRESSES: Record<ChainType, Record<string, string>> = {
  ethereum: {
    'ETH-USDT': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH address
    'ETH-USDC': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  bsc: {
    'BNB-USDT': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB address
    'BNB-USDC': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
  },
  solana: {
    'SOL-USDT': 'So11111111111111111111111111111111111111112', // Wrapped SOL address
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

// Price query function signatures
const PRICE_FUNCTION_SIGNATURES = {
  totalSupply: '0x18160ddd', // Example only, actual DEX price query function needed
  getReserves: '0x0902f1ac' // UniswapV2 getReserves function, used to calculate price
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
  
  // Initialize price data provider
  useEffect(() => {
    const initDataProvider = async () => {
      try {
        console.log('🔍 Initializing price data provider...');
        await priceDataProvider.initialize();
        
        // Get supported trading pairs
        const pairs = priceDataProvider.getSupportedPairs();
        console.log('🔍 Retrieved supported pairs:', pairs);
        setSupportedPairs(pairs);
        
        // Ensure selected chains and tokens are in the supported list
        // If filtered selection is empty, keep at least one option
        setSelectedChains(prev => {
          const filtered = prev.filter(chain => pairs.chains.includes(chain));
          console.log('🔍 Filtered chains:', filtered);
          // If filtered is empty, use first available chain
          return filtered.length > 0 ? filtered : pairs.chains.length > 0 ? [pairs.chains[0]] : [];
        });
        
        setSelectedTokens(prev => {
          const filtered = prev.filter(token => pairs.tokens.includes(token));
          console.log('🔍 Filtered tokens:', filtered);
          // If filtered is empty, use first available token
          return filtered.length > 0 ? filtered : pairs.tokens.length > 0 ? [pairs.tokens[0]] : [];
        });
        
        console.log('🔍 Price data provider initialization complete');
      } catch (error) {
        console.error('❌ Failed to initialize price data provider:', error);
        setError('Failed to initialize price. Please refresh the page to try again.');
      }
    };
    
    initDataProvider();
  }, []);
  
  // Fetch price data
  const fetchPrices = async () => {
    if (!priceDataProvider.getInitStatus()) {
      console.warn('⚠️ Price data provider not initialized, cannot fetch data');
      return;
    }
    
    if (selectedChains.length === 0) {
      console.warn('⚠️ No chains selected, cannot fetch data');
      setIsLoading(false);
      setError('Please select at least one chain');
      return;
    }
    
    if (selectedTokens.length === 0) {
      console.warn('⚠️ No tokens selected, cannot fetch data');
      setIsLoading(false);
      setError('Please select at least one token');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // 1. Get price data for all selected chains
      console.log('🔍 Fetching price data...');
      const allPrices: PriceData[] = [];
      const failedChains: string[] = [];
      const unsupportedTokens: string[] = [];
      
      for (const token of selectedTokens) {
        for (const chain of selectedChains) {
          try {
            console.log(`🔍 Fetching ${token} price on ${chain}...`);
            const price = await priceDataProvider.getPriceData(chain, token);
            if (price) {
              allPrices.push(price);
              console.log(`✅ Successfully fetched ${token} price on ${chain}: ${price.price}`);
            } else {
              console.warn(`⚠️ Empty price data for ${token} on ${chain}`);
              failedChains.push(chain);
            }
          } catch (error) {
            console.error(`❌ Failed to fetch ${token} price on ${chain}:`, error);
            failedChains.push(chain);
          }
        }
      }

      // If no actual price data, generate mock data
      let mockData: PriceData[] = [];
      if (allPrices.length === 0) {
        console.warn('⚠️ No actual price data retrieved, generating mock data');
        const now = Date.now();
        
        // Generate mock data for all selected tokens and chains
        for (const chain of selectedChains) {
          for (const token of selectedTokens) {
            // Set different base prices based on token type
            const basePrice = token === 'ETH-USDT' 
              ? 1500 + Math.random() * 1000  // ETH price range
              : 1 + Math.random() * 0.1;     // USDC price (approximately $1)
              
            mockData.push({
              chain,
              token,
              price: basePrice,
              timestamp: now,
              change24h: (Math.random() - 0.5) * 5
            });
            console.log(`🔍 Generated mock data: ${chain} ${token} price: $${basePrice.toFixed(2)}`);
          }
        }
      }

      // 2. Calculate price comparison data
      console.log('🔍 Calculating price comparison data...');
      // Use actual or mock data
      const prices = allPrices.length > 0 ? allPrices : mockData;
      
      // Filter to ensure only valid data - allow ETH-USDT and ETH-USDC
      const validPrices = prices.filter(price => 
        price.token === 'ETH-USDT' || price.token === 'ETH-USDC'
      );
      
      setError(null);
      
      // Use data provider to generate price comparisons
      const comparisons = priceDataProvider.generateComparisonData(validPrices);
      setComparisonData(comparisons);
      
      // 3. Prepare table data
      console.log('🔍 Preparing table data...');
      const tableRows = await priceDataProvider.prepareTableData(validPrices, comparisons);
      
      // Update state
      setPriceData(validPrices);
      setTableData(tableRows);
      setLastUpdated(new Date());
      setIsLoading(false);
      
      // If there are failed chains, show warning
      if (failedChains.length > 0) {
        const uniqueFailedChains = [...new Set(failedChains)];
        console.warn(`⚠️ Some chains failed to fetch data: ${uniqueFailedChains.join(', ')}`);
        
        // If more than 50% of chains failed, show warning to user
        if (uniqueFailedChains.length > selectedChains.length / 2) {
          setError(`Failed to fetch data for some chains: ${uniqueFailedChains.map(chain => 
            priceDataProvider.getChainDisplayName(chain)).join(', ')}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch price data:', error);
      setError('Failed to fetch price data. Please try again later.');
      setIsLoading(false);
    }
  };
  
  // Monitor selected chains and tokens changes, reset error state
  useEffect(() => {
    if (selectedChains.length > 0 && selectedTokens.length > 0 && error === 'Please select at least one chain and one token') {
      console.log('🔍 Selected chains and tokens updated, clearing previous error state');
      setError(null);
    }
  }, [selectedChains, selectedTokens, error]);
  
  // Add forced refresh timer
  useEffect(() => {
    // Force refresh data once after 5 seconds of page load to handle initialization issues
    const initialTimeout = setTimeout(() => {
      if (tableData.length === 0 && !isLoading && !error) {
        console.log('⚠️ No data detected 5 seconds after page load, forcing refresh...');
        fetchPrices();
      }
    }, 5000);
    
    return () => clearTimeout(initialTimeout);
  }, []);
  
  // Initialize data and set up periodic updates
  useEffect(() => {
    console.log('🔍 Data loading trigger check - Selected chains:', selectedChains.length, 'Selected tokens:', selectedTokens.length);
    
    if (selectedChains.length > 0 && selectedTokens.length > 0) {
      fetchPrices();
      
      // Update data every 2 minutes
      const interval = setInterval(fetchPrices, 120000);
      
      return () => clearInterval(interval);
    } else {
      // Show error if no chains or tokens selected
      console.warn('⚠️ No chains or tokens selected, cannot fetch price data');
      setIsLoading(false);
      setError('Please select at least one chain and one token');
    }
  }, [selectedChains, selectedTokens]);
  
  // Monitor table data loading
  useEffect(() => {
    // If it takes more than 10 seconds and still no data, there might be a problem
    if (isLoading && tableData.length === 0) {
      const timeout = setTimeout(() => {
        if (isLoading && tableData.length === 0) {
          console.warn('⚠️ Data loading timeout, possible issue');
          setIsLoading(false);
          setError('Data loading timeout. Please refresh the page to try again.');
        }
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading, tableData]);
  
  // Handle chain selection toggle
  const handleChainToggle = (chain: string) => {
    setSelectedChains(prev => {
      if (prev.includes(chain)) {
        return prev.filter(c => c !== chain);
      } else {
        return [...prev, chain];
      }
    });
  };
  
  // Handle token selection toggle
  const handleTokenToggle = (token: string) => {
    setSelectedTokens(prev => {
      if (prev.includes(token)) {
        // Prevent deselecting all tokens, keep at least one
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== token);
      } else {
        return [...prev, token];
      }
    });
  };

  // Format price display
  const formatPrice = (price: number): string => {
    return price < 0.01 
      ? price.toFixed(6)
      : price < 1 
        ? price.toFixed(4)
        : price.toFixed(2);
  };

  // Get token icon based on selected token
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

  // Get chain icon based on selected chain
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

  // Get display name for chain
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

  // Token pair options - add ETH-USDC, don't disable
  const tokenPairOptions = [
    { value: 'ETH-USDT', label: 'ETH/USDT', icon: ethTokenIcon },
    { value: 'ETH-USDC', label: 'ETH/USDC', icon: ethTokenIcon }
  ];

  // Chain options
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
    <Container style={styles.container}>
      <div style={styles.card}>
        {/* Filters container - Chain selector and Token selector */}
        <div style={styles.filtersContainer}>
          {/* Chain filters */}
          <div style={{
            ...styles.filterGroup,
            paddingLeft: '12px'
          }}>
            {chainOptions.map(option => (
              <label 
                key={option.value}
                style={{ 
                  ...styles.filterItemBase,
                  ...(selectedChains.includes(option.value) 
                    ? styles.filterItemSelected 
                    : styles.filterItemUnselected)
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedChains.includes(option.value)} 
                  onChange={() => handleChainToggle(option.value)}
                  style={styles.checkbox}
                />
                <img 
                  src={option.icon} 
                  alt={option.label}
                  style={styles.icon} 
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          
          {/* Token filters */}
          <div style={{
            ...styles.filterGroup,
            paddingRight: '12px'
          }}>
            {tokenPairOptions.map(option => (
              <label 
                key={option.value}
                style={{ 
                  ...styles.filterItemBase,
                  ...(selectedTokens.includes(option.value) 
                    ? styles.filterItemSelected 
                    : styles.filterItemUnselected)
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedTokens.includes(option.value)} 
                  onChange={() => handleTokenToggle(option.value)}
                  style={styles.checkbox}
                />
                <img 
                  src={option.icon} 
                  alt={option.label}
                  style={styles.icon} 
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div style={styles.contentContainer}>
          {isLoading && tableData.length === 0 ? (
            <div style={styles.loadingState}>
              Loading price data...
              <div style={styles.statusText}>
                Selected chains: {selectedChains.join(', ')} | Tokens: {selectedTokens.map(t => t.replace('-', '/')).join(', ')}
              </div>
            </div>
          ) : error ? (
            <div style={styles.errorState}>
              {error}
              <div style={styles.statusText}>
                Selected chains: {selectedChains.join(', ')} | Tokens: {selectedTokens.map(t => t.replace('-', '/')).join(', ')}
              </div>
            </div>
          ) : (
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead style={styles.tableHeader}>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeaderCell}>SOURCE</th>
                  <th style={styles.tableHeaderCell}>CHAIN</th>
                  <th style={styles.tableHeaderCell}>SYMBOL</th>
                  <th style={styles.tableHeaderCellRight}>PRICE</th>
                </tr>
              </thead>
              <tbody>
                {tableData
                  .filter(item => {
                    // Find chain identifier matching the display name in the table
                    const chainId = selectedChains.find(chain => 
                      getChainDisplayName(chain) === item.chain
                    );
                    
                    // Handle token selection
                    const isSelectedToken = selectedTokens.includes('ETH-USDT') && item.token === 'ETH/USDT' || 
                                          selectedTokens.includes('ETH-USDC') && item.token === 'ETH/USDC';
                    
                    return chainId !== undefined && isSelectedToken;
                  })
                  .map((item, index) => (
                    <tr key={index} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                      <td style={styles.tableCell}>
                        {item.source || 'N/A'}
                      </td>
                      <td style={styles.tableCell}>
                        {item.chain || 'N/A'}
                      </td>
                      <td style={styles.tableCellToken}>
                        {item.token || 'N/A'}
                      </td>
                      <td style={styles.tableCellNumeric}>
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
                    <td colSpan={4} style={styles.emptyTableMessage}>
                      No chains or tokens selected, or no data available
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot style={styles.tableFooter}>
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