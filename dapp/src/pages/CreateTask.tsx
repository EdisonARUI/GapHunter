import { useState, useEffect, useRef, useMemo } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Container, Heading, Table, Button, Flex, Text, Box } from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import TaskForm from '../components/TaskForm';
import { TaskConfig } from '../types/task';
import priceDataProvider, { PriceComparisonData, PriceData } from '../priceMonitor/priceDataProvider';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { SuiTransactionBlockResponse } from '@mysten/sui.js/client';

// Define reusable styles
const styles = {
  container: {
    backgroundColor: '#121212',
    color: '#FFFFFF',
    padding: '24px 0',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    marginBottom: '24px',
  },
  heading: {
    color: '#E2E8F0',
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  alertWarning: {
    backgroundColor: 'rgba(146, 64, 14, 0.2)',
    borderLeft: '4px solid #ca8a04',
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '4px',
    display: 'flex',
  },
  alertError: {
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderLeft: '4px solid #dc2626',
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '4px',
    display: 'flex',
  },
  alertInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: '12px',
    marginBottom: '16px',
    borderRadius: '4px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  iconContainer: {
    flexShrink: 0,
  },
  alertText: {
    marginLeft: '12px',
    fontSize: '14px',
  },
  tableHeader: {
    backgroundColor: '#292929',
    color: '#E2E8F0',
    cursor: 'pointer',
  },
  tableRowEven: {
    backgroundColor: '#262626',
  },
  tableRowOdd: {
    backgroundColor: '#2D2D2D',
  },
  tableRowAbnormal: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  tableRowSelected: {
    border: '2px solid #3B82F6',
  },
  buttonPrimary: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    borderRadius: '9999px',
    borderWidth: '3px',
    borderColor: '#3B82F6',
    borderTopColor: 'transparent',
  },
  monospaceText: {
    fontFamily: 'monospace',
    wordBreak: 'break-word' as const,
  },
};

export default function CreateTask() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<PriceComparisonData[]>([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [selectedComparison, setSelectedComparison] = useState<PriceComparisonData | null>(null);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'ascending' | 'descending'}>({
    key: 'spread',
    direction: 'descending'
  });
  
  // Dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  
  // Task form reference
  const taskFormRef = useRef<any>(null);

  // Load price comparison data
  const loadPriceComparisonData = async () => {
    try {
      setIsLoadingPrices(true);
      
      // Ensure priceDataProvider is initialized
      if (!priceDataProvider.getInitStatus()) {
        await priceDataProvider.initialize();
      }
      
      // Get supported chains and token pairs
      const supportedPairs = priceDataProvider.getSupportedPairs();
      
      // Get price data
      const priceData = await priceDataProvider.getAllPriceData(supportedPairs.chains, supportedPairs.tokens);
      
      // Filter valid price data
      // Remove invalid data: 1. Price is 0 or negative 2. Special chain token mismatch
      const validPriceData = priceData.filter(data => {
        // Exclude invalid prices
        if (data.price <= 0) return false;

        // Special chain to token mapping
        const specialChainTokenMap: Record<string, string> = {
          'sui': 'SUI-USDT',
          'solana': 'SOL-USDT',
          'bsc': 'BNB-USDT'
        };

        // Check if it's a special chain
        if (specialChainTokenMap[data.chain]) {
          // If special chain, check if token matches
          return data.token === specialChainTokenMap[data.chain];
        }

        // For other chains, only keep ETH-USDT
        return data.token === 'ETH-USDT';
      });
      
      // Group data by token
      const tokenGroups: Record<string, PriceData[]> = {};
      
      // Group data by token type
      validPriceData.forEach(data => {
        let tokenKey: string;
        
        // Map special chains to unified token identifier
        if (data.chain === 'sui' && data.token === 'SUI-USDT') {
          tokenKey = 'BASE-USDT';  // Use unified identifier
        } else if (data.chain === 'solana' && data.token === 'SOL-USDT') {
          tokenKey = 'BASE-USDT';  // Use unified identifier
        } else if (data.chain === 'bsc' && data.token === 'BNB-USDT') {
          tokenKey = 'BASE-USDT';  // Use unified identifier
        } else {
          tokenKey = data.token;
        }
        
        if (!tokenGroups[tokenKey]) {
          tokenGroups[tokenKey] = [];
        }
        
        tokenGroups[tokenKey].push(data);
      });
      
      // Calculate price differences within same token group
      let comparisonResults: PriceComparisonData[] = [];
      
      // Compare prices within each token group
      Object.values(tokenGroups).forEach(group => {
        // Require at least 2 items for comparison
        if (group.length >= 2) {
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              const data1 = group[i];
              const data2 = group[j];
              
              // Calculate price spread
              const spread = calculatePriceSpread(data1.price, data2.price);
              
              comparisonResults.push({
                token: group[0].token,  // Use first token name in group
                chain1: data1.chain,
                chain2: data2.chain,
                price1: data1.price,
                price2: data2.price,
                spread,
                isAbnormal: spread > 0.5  // Consider abnormal if spread > 0.5%
              });
            }
          }
        }
      });
      
      // Update state
      setComparisonData(comparisonResults);
    } catch (err) {
      console.error('Failed to load price comparison data:', err);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Calculate price spread percentage
  const calculatePriceSpread = (price1: number, price2: number): number => {
    if (price1 <= 0 || price2 <= 0) return 0;
    const min = Math.min(price1, price2);
    return min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
  };

  // Load price data on component mount
  useEffect(() => {
    loadPriceComparisonData();
    // Refresh data every 5 minutes
    const interval = setInterval(loadPriceComparisonData, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (task: Omit<TaskConfig, 'id' | 'last_alert'>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!currentAccount) {
        setError('Please connect your wallet first');
        return;
      }

      console.log('Creating task:', task);
      
      // Call Sui contract to create task
      try {
        // Contract package ID
        const packageId = '0x0ab66ff86fbbc74056dc9bfcfdcb7b12f0419e26eccc97fc37cab758c70b1cb7';
        
        // Create transaction
        const tx = new TransactionBlock();
        
        // Convert chain_pairs to contract format
        // Update: pass string array as arguments, not joined as single string
        const chainsArray = task.chain_pairs.map(pair => {
          // Extract chain name from chain_pairs (from "ethereum:ETH-USDT" format to "ethereum")
          const [chain] = pair.split(':');
          return chain;
        });
        // Pass array directly, don't join
        const chainPairsArg = tx.pure(chainsArray);
        
        // Pass threshold and cooldown parameters
        // Note: Contract expects threshold as integer (basis points), e.g. 0.5% should be 50
        const thresholdArg = tx.pure(Math.round(task.threshold * 100)); // Convert to basis points
        const cooldownArg = tx.pure(task.cooldown);
        
        // Call create_task function
        const createTaskResult = tx.moveCall({
          target: `${packageId}::gaphunter::create_task`,
          arguments: [
            chainPairsArg,
            thresholdArg,
            cooldownArg
          ],
        });
        
        // Handle return value, transfer task object to user
        // Transfer TaskConfig object to current user
        tx.moveCall({
          target: `0x2::transfer::public_transfer`,
          arguments: [
            createTaskResult, // Use create_task call result
            tx.pure(currentAccount.address) // Use tx.pure method to correctly pass address
          ],
          typeArguments: [`${packageId}::task::TaskConfig`], // Specify type parameters
        });
        
        try {
          // Use dapp-kit 0.15.2 compatible approach
          // Create a simple custom object
          const txJSON = tx.serialize();

          // Simple string form used in dapp-kit 0.15.2
          signAndExecuteTransaction(
            { transaction: txJSON as any },
            {
              onSuccess: (data: any) => {
                console.log('Contract call result:', data);
                if (data && data.digest) {
                  // Use new dialog component instead of alert
                  setTransactionId(data.digest);
                  setShowSuccessDialog(true);
                  setSelectedComparison(null);
                } else {
                  console.warn('Transaction executed successfully but no digest returned');
                }
                setIsLoading(false);
              },
              onError: (err: any) => {
                console.error('Wallet interaction failed:', err);
                setError(`Wallet interaction failed: ${err instanceof Error ? err.message : String(err)}`);
                setIsLoading(false);
              }
            }
          );
        } catch (walletError) {
          console.error('Wallet interaction failed:', walletError);
          setError(`Wallet interaction failed: ${walletError instanceof Error ? walletError.message : String(walletError)}`);
          setIsLoading(false);
        }
      } catch (contractError) {
        console.error('Contract call failed:', contractError);
        setError(`Contract call failed: ${contractError instanceof Error ? contractError.message : String(contractError)}`);
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      setIsLoading(false);
    }
  };

  // Format price to 2 decimal places
  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  // Format price gap, showing absolute value and percentage
  const formatPriceGap = (price1: number, price2: number): string => {
    const gap = Math.abs(price1 - price2);
    return formatPrice(gap);
  };

  // Format token name, convert ETH-USDT format to more friendly ETH/USDT format
  // Also handle special chain token display
  const formatTokenName = (token: string, chain1: string, chain2: string): string => {
    // Handle BASE-USDT special case, show actual token name based on chain
    if (token === 'BASE-USDT') {
      // Determine token name for each chain
      const getTokenForChain = (chain: string) => {
        if (chain === 'sui') return 'SUI';
        if (chain === 'solana') return 'SOL';
        if (chain === 'bsc') return 'BNB';
        return 'ETH';
      };
      
      return `${getTokenForChain(chain1)}-${getTokenForChain(chain2)}/USDT`;
    }
    
    // Handle normal case
    return token.replace('-', '/');
  };

  // Get display name for chain
  const getChainDisplayName = (chain: string): string => {
    return priceDataProvider.getChainDisplayName(chain);
  };

  // Handle comparison row click, add chain pair to task form
  const handleComparisonRowClick = (comparison: PriceComparisonData) => {
    setSelectedComparison(comparison);
    // Scroll to form section
    setTimeout(() => {
      document.getElementById('task-form-section')?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  // Extract task initial values from comparison data
  const getTaskInitialValues = () => {
    if (!selectedComparison) return null;
    
    // Extract chain and token info from selected comparison
    const chain1 = selectedComparison.chain1;
    const chain2 = selectedComparison.chain2;
    
    // Get actual token for chain
    const getTokenForChain = (chain: string, defaultToken: string) => {
      if (chain === 'sui') return 'SUI';
      if (chain === 'solana') return 'SOL';
      if (chain === 'bsc') return 'BNB';
      return defaultToken;
    };
    
    // Handle special cases, choose token based on chain
    let token1: string;
    let token2: string;
    
    if (selectedComparison.token === 'BASE-USDT') {
      token1 = getTokenForChain(chain1, 'ETH');
      token2 = 'USDT';
    } else {
      // Token format is "ETH-USDT", split to get both tokens
      const tokens = selectedComparison.token.split('-');
      token1 = tokens[0];
      token2 = tokens[1] || 'USDT';
    }
    
    return {
      chain1,
      chain2,
      token1,
      token2,
      // Suggested threshold is half of current spread
      threshold: Math.max(selectedComparison.spread / 2, 0.5),
      cooldown: 300 // Default cooldown is 5 minutes
    };
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!comparisonData.length) return [];
    
    let sortableItems = [...comparisonData];
    
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        // @ts-ignore
        let aValue = a[sortConfig.key];
        // @ts-ignore
        let bValue = b[sortConfig.key];
        
        // Special handling for chain and token name sorting
        if (sortConfig.key === 'chain1' || sortConfig.key === 'chain2') {
          aValue = getChainDisplayName(aValue);
          bValue = getChainDisplayName(bValue);
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return sortableItems;
  }, [comparisonData, sortConfig, getChainDisplayName]);

  // Request sort
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Get sort indicator
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  return (
    <Container style={styles.container}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {!currentAccount && (
          <div style={styles.alertWarning}>
            <div style={styles.iconContainer}>
              <svg style={{ height: '20px', width: '20px', color: '#ca8a04' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div style={styles.alertText}>
              <p style={{ fontSize: '14px', color: '#ca8a04' }}>
                Please connect your wallet to create monitoring tasks
              </p>
          </div>
        </div>
      )}

      {error && (
          <div style={styles.alertError}>
            <div style={styles.iconContainer}>
              <svg style={{ height: '20px', width: '20px', color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div style={styles.alertText}>
              <p style={{ fontSize: '14px', color: '#dc2626' }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Price Comparison Table */}
        <div style={styles.card}>
          <h3 style={styles.heading}>REAL-TIME PRICE DIFFERENCES</h3>
          
          {isLoadingPrices && comparisonData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ 
                ...styles.spinner,
                height: '24px',
                width: '24px',
              }}></div>
              <p style={{ marginTop: '8px', fontSize: '14px', color: '#9ca3af' }}>Loading price data...</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table.Root variant="surface" style={{ width: '100%', color: '#E2E8F0', backgroundColor: '#262626' }}>
                <Table.Header>
                  <Table.Row style={{ backgroundColor: '#333333' }}>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('token')}
                    >
                      SYMBOL{getSortIndicator('token')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('chain1')}
                    >
                      CHAIN 1{getSortIndicator('chain1')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('price1')}
                    >
                      PRICE 1{getSortIndicator('price1')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('chain2')}
                    >
                      CHAIN 2{getSortIndicator('chain2')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('price2')}
                    >
                      PRICE 2{getSortIndicator('price2')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('price2')}
                    >
                      PRICE GAP
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={styles.tableHeader}
                      onClick={() => requestSort('spread')}
                    >
                      PRICE GAP %{getSortIndicator('spread')}
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sortedData.length > 0 ? (
                    sortedData.map((comparison: PriceComparisonData, index: number) => {
                      let rowStyle = {
                        cursor: 'pointer',
                      };
                      
                      // Determine row style based on conditions
                      if (comparison.isAbnormal) {
                        rowStyle = { ...rowStyle, ...styles.tableRowAbnormal };
                      } else if (index % 2 === 0) {
                        rowStyle = { ...rowStyle, ...styles.tableRowEven };
                      } else {
                        rowStyle = { ...rowStyle, ...styles.tableRowOdd };
                      }
                      
                      // Add selected highlight if this row is selected
                      if (selectedComparison && 
                          selectedComparison.chain1 === comparison.chain1 && 
                          selectedComparison.chain2 === comparison.chain2 && 
                          selectedComparison.token === comparison.token) {
                        rowStyle = { ...rowStyle, ...styles.tableRowSelected };
                      }
                      
                      return (
                        <Table.Row 
                          key={index} 
                          style={rowStyle}
                          onClick={() => handleComparisonRowClick(comparison)}
                        >
                          <Table.Cell>
                            {formatTokenName(comparison.token, comparison.chain1, comparison.chain2)}
                          </Table.Cell>
                          <Table.Cell>{getChainDisplayName(comparison.chain1)}</Table.Cell>
                          <Table.Cell style={{ fontFamily: 'monospace', textAlign: 'right' }}>
                            {formatPrice(comparison.price1)}
                          </Table.Cell>
                          <Table.Cell>{getChainDisplayName(comparison.chain2)}</Table.Cell>
                          <Table.Cell style={{ fontFamily: 'monospace', textAlign: 'right' }}>
                            {formatPrice(comparison.price2)}
                          </Table.Cell>
                          <Table.Cell style={{ fontFamily: 'monospace', textAlign: 'right' }}>
                            {formatPriceGap(comparison.price1, comparison.price2)}
                          </Table.Cell>
                          <Table.Cell style={{ 
                            fontWeight: comparison.isAbnormal ? 'bold' : 'normal',
                            color: comparison.isAbnormal ? '#dc2626' : (comparison.spread > 0.2 ? '#eab308' : '#e2e8f0'),
                            fontFamily: 'monospace',
                            textAlign: 'right'
                          }}>
                            {comparison.spread.toFixed(4)}%
                            {comparison.isAbnormal && (
                              <span style={{ marginLeft: '4px', color: '#dc2626' }}>⚠️</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                        {isLoadingPrices ? 'Loading...' : 'No price difference data available'}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
        </div>
      )}

          <div style={{ textAlign: 'right', marginTop: '16px' }}>
            <button 
              onClick={loadPriceComparisonData} 
              disabled={isLoadingPrices}
              style={{
                ...styles.buttonPrimary,
                ...(isLoadingPrices ? styles.buttonDisabled : {})
              }}
            >
              {isLoadingPrices ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Task Form Section */}
        <div id="task-form-section">
          {selectedComparison && (
            <div style={styles.alertInfo}>
              <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>
                Selected price difference: {formatTokenName(selectedComparison.token, selectedComparison.chain1, selectedComparison.chain2)}
              </p>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>
                Current spread: {selectedComparison.spread.toFixed(4)}% | Prices: {formatPrice(selectedComparison.price1)} vs {formatPrice(selectedComparison.price2)}
              </p>
            </div>
          )}
          <TaskForm 
            ref={taskFormRef}
            onSubmit={handleSubmit}
            initialValues={getTaskInitialValues()}
          />
        </div>

        {isLoading && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ 
              ...styles.spinner,
              height: '32px',
              width: '32px',
              borderWidth: '4px'
            }}></div>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#94A3B8' }}>Creating task...</p>
        </div>
      )}
      
        {/* Success Dialog */}
        <Dialog.Root open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <Dialog.Portal>
            <Dialog.Overlay style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              position: 'fixed',
              inset: 0,
              animation: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)'
            }} />
            <Dialog.Content style={{
              backgroundColor: '#1A1A1A',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90vw',
              maxWidth: '450px',
              maxHeight: '85vh',
              padding: '24px',
              animation: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
              border: '1px solid #333',
              color: '#FFFFFF'
            }}>
              <Dialog.Title style={{ margin: 0, fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.2)', 
                  color: '#22c55e',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 10L9 12L13 8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                Task Created Successfully
              </Dialog.Title>
              <Dialog.Description style={{ marginTop: '16px', fontSize: '14px', color: '#94A3B8' }}>
                Your task has been successfully created and recorded on the blockchain
              </Dialog.Description>
              
              <div style={{ margin: '20px 0', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Transaction ID:</div>
                <div style={styles.monospaceText}>
                  {transactionId}
                </div>
              </div>
              
              <div style={{ display: 'flex', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setShowSuccessDialog(false)}
                  style={styles.buttonPrimary}
                >
                  OK
                </button>
              </div>
              
              <Dialog.Close asChild>
                <button
                  style={{
                    fontFamily: 'inherit',
                    borderRadius: '100%',
                    height: '25px',
                    width: '25px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    border: 'none'
                  }}
                  aria-label="Close"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                  </svg>
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
    </div>
    </Container>
  );
} 