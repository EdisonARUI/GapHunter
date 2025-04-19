import { useState, useEffect, useRef, useMemo } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Container, Heading, Table, Button, Flex, Text, Box } from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import TaskForm from '../components/TaskForm';
import { TaskConfig } from '../types/task';
import priceDataProvider, { PriceComparisonData, PriceData } from '../priceMonitor/priceDataProvider';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { SuiTransactionBlockResponse } from '@mysten/sui.js/client';

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
  
  // 弹窗状态
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  
  // 在TaskForm ref上保存引用，以便可以调用TaskForm中的方法
  const taskFormRef = useRef<any>(null);

  // 加载价格比较数据
  const loadPriceComparisonData = async () => {
    try {
      setIsLoadingPrices(true);
      
      // 确保priceDataProvider已初始化
      if (!priceDataProvider.getInitStatus()) {
        await priceDataProvider.initialize();
      }
      
      // 获取支持的链和代币对
      const supportedPairs = priceDataProvider.getSupportedPairs();
      
      // 获取价格数据
      const priceData = await priceDataProvider.getAllPriceData(supportedPairs.chains, supportedPairs.tokens);
      
      // 过滤有效价格数据
      // 移除无效数据: 1. 价格为0或负数的数据 2. 特殊链上的非对应币种数据
      const validPriceData = priceData.filter(data => {
        // 排除价格无效的数据
        if (data.price <= 0) return false;

        // 特殊链和币种映射关系
        const specialChainTokenMap: Record<string, string> = {
          'sui': 'SUI-USDT',
          'solana': 'SOL-USDT',
          'bsc': 'BNB-USDT'
        };

        // 判断是否为特殊链
        if (specialChainTokenMap[data.chain]) {
          // 若是特殊链，判断代币是否匹配，不匹配则排除
          return data.token === specialChainTokenMap[data.chain];
        }

        // 对于其他链，只保留ETH-USDT
        return data.token === 'ETH-USDT';
      });
      
      // 按照币种分组生成比较数据
      const tokenGroups: Record<string, PriceData[]> = {};
      
      // 对数据按照币种分组
      validPriceData.forEach(data => {
        let tokenKey: string;
        
        // 为特殊链映射回通用代币标识符
        if (data.chain === 'sui' && data.token === 'SUI-USDT') {
          tokenKey = 'BASE-USDT';  // 使用统一标识符
        } else if (data.chain === 'solana' && data.token === 'SOL-USDT') {
          tokenKey = 'BASE-USDT';  // 使用统一标识符
        } else if (data.chain === 'bsc' && data.token === 'BNB-USDT') {
          tokenKey = 'BASE-USDT';  // 使用统一标识符
        } else {
          tokenKey = data.token;
        }
        
        if (!tokenGroups[tokenKey]) {
          tokenGroups[tokenKey] = [];
        }
        
        tokenGroups[tokenKey].push(data);
      });
      
      // 只在同一币种内进行价差计算
      let comparisonResults: PriceComparisonData[] = [];
      
      // 遍历每个币种组
      Object.values(tokenGroups).forEach(group => {
        // 对于每个币种组内进行两两比较
        if (group.length >= 2) {
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              const data1 = group[i];
              const data2 = group[j];
              
              // 计算价差
              const spread = calculatePriceSpread(data1.price, data2.price);
              
              comparisonResults.push({
                token: group[0].token,  // 使用组内第一个代币的名称
                chain1: data1.chain,
                chain2: data2.chain,
                price1: data1.price,
                price2: data2.price,
                spread,
                isAbnormal: spread > 0.5  // 超过0.5%的价差视为异常
              });
            }
          }
        }
      });
      
      // 更新状态
      setComparisonData(comparisonResults);
    } catch (err) {
      console.error('加载价格比较数据失败:', err);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // 计算价差百分比
  const calculatePriceSpread = (price1: number, price2: number): number => {
    if (price1 <= 0 || price2 <= 0) return 0;
    const min = Math.min(price1, price2);
    return min === 0 ? 0 : Math.abs(price1 - price2) / min * 100;
  };

  // 组件挂载时加载价格数据
  useEffect(() => {
    loadPriceComparisonData();
    // 每5分钟刷新一次数据
    const interval = setInterval(loadPriceComparisonData, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (task: Omit<TaskConfig, 'id' | 'last_alert'>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!currentAccount) {
        setError('请先连接钱包');
        return;
      }

      console.log('Creating task:', task);
      
      // 调用Sui合约创建任务
      try {
        // 合约包ID
        const packageId = '0x0ab66ff86fbbc74056dc9bfcfdcb7b12f0419e26eccc97fc37cab758c70b1cb7';
        
        // 创建交易
        const tx = new TransactionBlock();
        
        // 将chain_pairs转换为适合合约的格式
        // 修改：将字符串数组作为参数传递，而不是连接成单个字符串
        const chainsArray = task.chain_pairs.map(pair => {
          // 从chain_pairs中提取链名称 (从 "ethereum:ETH-USDT" 格式转为 "ethereum")
          const [chain] = pair.split(':');
          return chain;
        });
        // 直接传递数组，不使用join
        const chainPairsArg = tx.pure(chainsArray);
        
        // 传入threshold和cooldown参数
        // 注意：合约期望threshold是整数（基点），例如0.5%应该是50
        const thresholdArg = tx.pure(Math.round(task.threshold * 100)); // 转换为基点
        const cooldownArg = tx.pure(task.cooldown);
        
        // 调用create_task函数
        const createTaskResult = tx.moveCall({
          target: `${packageId}::gaphunter::create_task`,
          arguments: [
            chainPairsArg,
            thresholdArg,
            cooldownArg
          ],
        });
        
        // 新增：处理返回值，将任务对象转移给用户
        // 将返回的TaskConfig对象转移给当前用户
        tx.moveCall({
          target: `0x2::transfer::public_transfer`,
          arguments: [
            createTaskResult, // 使用create_task调用的结果
            tx.pure(currentAccount.address) // 使用tx.pure方法正确传递地址
          ],
          typeArguments: [`${packageId}::task::TaskConfig`], // 指定类型参数
        });
        
        try {
          // 使用dapp-kit 0.15.2兼容的方式处理交易
          // 创建一个简单的自定义对象
          const txJSON = tx.serialize();

          // dapp-kit 0.15.2中使用的简单字符串形式
          signAndExecuteTransaction(
            { transaction: txJSON as any },
            {
              onSuccess: (data: any) => {
                console.log('合约调用结果:', data);
                if (data && data.digest) {
                  // 使用新的弹窗组件替代 alert
                  setTransactionId(data.digest);
                  setShowSuccessDialog(true);
                  setSelectedComparison(null);
                } else {
                  console.warn('交易执行成功但未返回digest');
                }
                setIsLoading(false);
              },
              onError: (err: any) => {
                console.error('钱包交互失败:', err);
                setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
                setIsLoading(false);
              }
            }
          );
        } catch (walletError) {
          console.error('钱包交互失败:', walletError);
          setError(`钱包交互失败: ${walletError instanceof Error ? walletError.message : String(walletError)}`);
          setIsLoading(false);
        }
      } catch (contractError) {
        console.error('调用合约失败:', contractError);
        setError(`调用合约失败: ${contractError instanceof Error ? contractError.message : String(contractError)}`);
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      setIsLoading(false);
    }
  };

  // 格式化价格，保留两位小数
  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  // 格式化价差，同时显示绝对值和百分比
  const formatPriceGap = (price1: number, price2: number): string => {
    const gap = Math.abs(price1 - price2);
    return formatPrice(gap);
  };

  // 格式化代币名称，将ETH-USDT格式转换为更友好的ETH/USDT格式
  // 同时处理特殊链上的代币显示
  const formatTokenName = (token: string, chain1: string, chain2: string): string => {
    // 处理BASE-USDT特殊情况，根据链显示实际代币名称
    if (token === 'BASE-USDT') {
      // 确定两个链上应显示的代币名称
      const getTokenForChain = (chain: string) => {
        if (chain === 'sui') return 'SUI';
        if (chain === 'solana') return 'SOL';
        if (chain === 'bsc') return 'BNB';
        return 'ETH';
      };
      
      return `${getTokenForChain(chain1)}-${getTokenForChain(chain2)}/USDT`;
    }
    
    // 处理常规情况
    return token.replace('-', '/');
  };

  // 获取链的显示名称
  const getChainDisplayName = (chain: string): string => {
    return priceDataProvider.getChainDisplayName(chain);
  };

  // 处理点击价差行，将这对链和代币添加到任务表单中
  const handleComparisonRowClick = (comparison: PriceComparisonData) => {
    setSelectedComparison(comparison);
    // 滚动到表单位置
    setTimeout(() => {
      document.getElementById('task-form-section')?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  // 从价差数据中提取任务初始值
  const getTaskInitialValues = () => {
    if (!selectedComparison) return null;
    
    // 从所选价差中提取链和代币信息
    const chain1 = selectedComparison.chain1;
    const chain2 = selectedComparison.chain2;
    
    // 获取对应链上的实际代币
    const getTokenForChain = (chain: string, defaultToken: string) => {
      if (chain === 'sui') return 'SUI';
      if (chain === 'solana') return 'SOL';
      if (chain === 'bsc') return 'BNB';
      return defaultToken;
    };
    
    // 处理特殊情况，根据链选择对应的代币
    let token1: string;
    let token2: string;
    
    if (selectedComparison.token === 'BASE-USDT') {
      token1 = getTokenForChain(chain1, 'ETH');
      token2 = 'USDT';
    } else {
      // 代币格式为"ETH-USDT"，分割获取两个代币
      const tokens = selectedComparison.token.split('-');
      token1 = tokens[0];
      token2 = tokens[1] || 'USDT';
    }
    
    return {
      chain1,
      chain2,
      token1,
      token2,
      // 建议的阈值设置为当前价差的一半
      threshold: Math.max(selectedComparison.spread / 2, 0.5),
      cooldown: 300 // 默认冷却时间5分钟
    };
  };

  // 进行数据排序
  const sortedData = useMemo(() => {
    if (!comparisonData.length) return [];
    
    let sortableItems = [...comparisonData];
    
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        // @ts-ignore
        let aValue = a[sortConfig.key];
        // @ts-ignore
        let bValue = b[sortConfig.key];
        
        // 特殊处理链和代币名称的排序
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

  // 请求排序处理
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // 获取排序指示器
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  return (
    <Container style={{ backgroundColor: '#121212' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#121212' }}>
        {!currentAccount && (
          <div style={{ 
            backgroundColor: 'rgba(146, 64, 14, 0.2)', 
            borderLeftWidth: '4px', 
            borderLeftColor: '#ca8a04', 
            padding: '16px', 
            marginBottom: '16px', 
            borderRadius: '4px' 
          }}>
            <div style={{ display: 'flex' }}>
              <div style={{ flexShrink: 0 }}>
                <svg style={{ height: '20px', width: '20px', color: '#ca8a04' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
              <div style={{ marginLeft: '12px' }}>
                <p style={{ fontSize: '14px', color: '#ca8a04' }}>
                  请连接钱包以创建监控任务
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
          <div style={{ 
            backgroundColor: 'rgba(127, 29, 29, 0.2)', 
            borderLeftWidth: '4px', 
            borderLeftColor: '#dc2626', 
            padding: '16px', 
            marginBottom: '16px', 
            borderRadius: '4px' 
          }}>
            <div style={{ display: 'flex' }}>
              <div style={{ flexShrink: 0 }}>
                <svg style={{ height: '20px', width: '20px', color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
              <div style={{ marginLeft: '12px' }}>
                <p style={{ fontSize: '14px', color: '#dc2626' }}>
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

        {/* 价差计算表格 */}
        <div style={{ marginBottom: '24px', backgroundColor: '#1e1e1e', padding: '16px', borderRadius: '8px' }}>
          <Heading size="4" style={{ marginBottom: '16px', color: '#e2e8f0' }}>实时价差数据</Heading>
          
          {isLoadingPrices && comparisonData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ 
                display: 'inline-block', 
                animation: 'spin 1s linear infinite',
                borderRadius: '9999px',
                height: '24px',
                width: '24px',
                borderWidth: '3px',
                borderColor: '#3b82f6',
                borderTopColor: 'transparent'
              }}></div>
              <p style={{ marginTop: '8px', fontSize: '14px', color: '#9ca3af' }}>加载价格数据...</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table.Root variant="surface" style={{ width: '100%', color: '#e2e8f0', backgroundColor: '#262626' }}>
                <Table.Header>
                  <Table.Row style={{ backgroundColor: '#333333' }}>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('token')}
                    >
                      Symbol{getSortIndicator('token')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('chain1')}
                    >
                      Chain1{getSortIndicator('chain1')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('price1')}
                    >
                      Price1{getSortIndicator('price1')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('chain2')}
                    >
                      Chain2{getSortIndicator('chain2')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('price2')}
                    >
                      Price2{getSortIndicator('price2')}
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('price2')}
                    >
                      Price Gap
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell 
                      style={{ color: '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => requestSort('spread')}
                    >
                      Price Gap %{getSortIndicator('spread')}
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sortedData.length > 0 ? (
                    sortedData.map((comparison: PriceComparisonData, index: number) => (
                      <Table.Row 
                        key={index} 
                        style={{ 
                          backgroundColor: comparison.isAbnormal ? 'rgba(220, 38, 38, 0.1)' : (index % 2 === 0 ? '#262626' : '#2d2d2d'),
                          cursor: 'pointer',
                          // 如果此行被选中，添加高亮边框
                          border: selectedComparison && selectedComparison.chain1 === comparison.chain1 && 
                                  selectedComparison.chain2 === comparison.chain2 && 
                                  selectedComparison.token === comparison.token
                                  ? '2px solid #3b82f6' : 'none'
                        }}
                        onClick={() => handleComparisonRowClick(comparison)}
                      >
                        <Table.Cell>
                          {formatTokenName(comparison.token, comparison.chain1, comparison.chain2)}
                        </Table.Cell>
                        <Table.Cell>{getChainDisplayName(comparison.chain1)}</Table.Cell>
                        <Table.Cell>{formatPrice(comparison.price1)}</Table.Cell>
                        <Table.Cell>{getChainDisplayName(comparison.chain2)}</Table.Cell>
                        <Table.Cell>{formatPrice(comparison.price2)}</Table.Cell>
                        <Table.Cell>{formatPriceGap(comparison.price1, comparison.price2)}</Table.Cell>
                        <Table.Cell style={{ 
                          fontWeight: comparison.isAbnormal ? 'bold' : 'normal',
                          color: comparison.isAbnormal ? '#dc2626' : (comparison.spread > 0.2 ? '#eab308' : '#e2e8f0') 
                        }}>
                          {comparison.spread.toFixed(4)}%
                          {comparison.isAbnormal && (
                            <span style={{ marginLeft: '4px', color: '#dc2626' }}>⚠️</span>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                        {isLoadingPrices ? '加载中...' : '暂无价差数据'}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </div>
          )}
          
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <button 
              onClick={loadPriceComparisonData} 
              disabled={isLoadingPrices}
              style={{
                padding: '6px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: isLoadingPrices ? 'not-allowed' : 'pointer',
                opacity: isLoadingPrices ? 0.7 : 1
              }}
            >
              {isLoadingPrices ? '刷新中...' : '刷新数据'}
            </button>
          </div>
        </div>

        {/* 任务表单区域 */}
        <div id="task-form-section" style={{ backgroundColor: '#121212' }}>
          {selectedComparison && (
            <div style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.1)', 
              padding: '12px', 
              marginBottom: '16px', 
              borderRadius: '4px',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>
                已选择价差数据：{formatTokenName(selectedComparison.token, selectedComparison.chain1, selectedComparison.chain2)}
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                当前价差：{selectedComparison.spread.toFixed(4)}% | 价格：{formatPrice(selectedComparison.price1)} vs {formatPrice(selectedComparison.price2)}
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
          <div style={{ marginTop: '16px', textAlign: 'center', backgroundColor: '#121212' }}>
            <div style={{ 
              display: 'inline-block', 
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              height: '32px',
              width: '32px',
              borderWidth: '4px',
              borderColor: '#3b82f6',
              borderTopColor: 'transparent'
            }}></div>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#9ca3af' }}>创建任务中...</p>
        </div>
      )}
      
      {/* 成功弹窗 */}
      <Dialog.Root open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            position: 'fixed',
            inset: 0,
            animation: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)'
          }} />
          <Dialog.Content style={{
            backgroundColor: '#1a1a1a',
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
            color: '#fff'
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
              任务创建成功
            </Dialog.Title>
            <Dialog.Description style={{ marginTop: '16px', fontSize: '14px', color: '#aaa' }}>
              您的任务已成功创建并记录在区块链上
            </Dialog.Description>
            
            <div style={{ margin: '20px 0', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>交易ID:</div>
              <div style={{ 
                fontSize: '13px', 
                color: '#fff', 
                wordBreak: 'break-all',
                fontFamily: 'monospace'
              }}>
                {transactionId}
              </div>
            </div>
            
            <div style={{ display: 'flex', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowSuccessDialog(false)}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontWeight: 500
                }}
              >
                确定
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
                  color: '#aaa',
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