import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Container, Heading, Table, Text, Box, Flex, Badge, Tabs } from '@radix-ui/themes';
import { SuiClient, type SuiMoveObject } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { TaskConfig } from '../types/task';
import { formatDistance } from 'date-fns';
import { 
  TESTNET_COUNTER_PACKAGE_ID, 
  LIQUIDITY_POOL_ID, 
  CLOCK_ID 
} from '../constants';

// Define reusable styles
const styles = {
  container: {
    backgroundColor: '#121212',
    color: '#FFFFFF',
    padding: '24px',
    minHeight: 'calc(100vh - 60px)',
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
    marginBottom: '8px',
  },
  subText: {
    color: '#94A3B8',
    fontSize: '14px',
  },
  alertWarning: {
    backgroundColor: 'rgba(146, 64, 14, 0.2)',
    borderLeft: '4px solid #ca8a04',
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  alertError: {
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderLeft: '4px solid #dc2626',
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  iconContainer: {
    flexShrink: 0,
  },
  alertText: {
    marginLeft: '12px',
    fontSize: '14px',
  },
  tableContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
    overflow: 'auto',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  tableHeader: {
    backgroundColor: '#292929',
    color: '#E2E8F0',
  },
  tableRowEven: {
    backgroundColor: '#262626',
  },
  tableRowOdd: {
    backgroundColor: '#2D2D2D',
  },
  tableCell: {
    color: '#CBD5E1',
  },
  monospaceText: {
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  emptyState: {
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
    padding: '40px 20px',
    textAlign: 'center',
    color: '#94A3B8',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    borderRadius: '9999px',
    height: '32px',
    width: '32px',
    borderWidth: '4px',
    borderColor: '#3B82F6',
    borderTopColor: 'transparent',
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
  tabs: {
    marginBottom: '16px',
  }
};

// Define task status type
type TaskStatus = 'active' | 'paused' | 'completed';

// Define extended task data type with additional UI information
interface ExtendedTaskConfig extends TaskConfig {
  status: TaskStatus;
  created_at?: number;
  chain_pair_display?: string;
}

// 定义质押交易类型
interface StakingTransaction {
  id: string;
  type: 'stake' | 'unstake';
  amount: number;
  timestamp: number;
  txDigest: string;
}

// 定义质押信息接口，与Move合约匹配
interface StakeInfo {
  amount: number;
  stake_time: number;
  last_reward_time: number;
  calculatedReward?: number; // 计算得出的奖励，非合约存储字段
}

export default function History() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [tasks, setTasks] = useState<ExtendedTaskConfig[]>([]);
  const [stakingHistory, setStakingHistory] = useState<StakingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStakingLoading, setIsStakingLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stakingError, setStakingError] = useState<string | null>(null);
  const [currentStakeInfo, setCurrentStakeInfo] = useState<{amount: number, reward: number} | null>(null);
  
  // Contract package ID - keep consistent with CreateTask page
  const packageId = '0x0ab66ff86fbbc74056dc9bfcfdcb7b12f0419e26eccc97fc37cab758c70b1cb7';
  // 质押合约包ID - 使用常量
  const liquidityPackageId = TESTNET_COUNTER_PACKAGE_ID;
  
  // 获取用户当前的质押信息
  const fetchCurrentStakeInfo = async () => {
    if (!currentAccount || !suiClient) return;
    
    console.log("Fetching current stake info using pool ID:", LIQUIDITY_POOL_ID);
    console.log("Using clock ID:", CLOCK_ID);

    try {
      // 方法1: 使用get_stake_info函数
      // 创建一个交易区块以查看流动性池中的质押信息
      const tx = new TransactionBlock();
      
      // 调用 get_stake_info 函数 - 这与Move合约中的函数匹配
      tx.moveCall({
        target: `${liquidityPackageId}::liquidity::get_stake_info`,
        arguments: [
          tx.object(LIQUIDITY_POOL_ID),
          tx.pure(currentAccount.address),
          tx.object(CLOCK_ID)
        ],
        typeArguments: []
      });
      
      // 设置交易为只读模式
      tx.setGasBudget(10000000);
      
      try {
        // 使用devInspectTransactionBlock模拟执行查询
        const simulateResult = await suiClient.devInspectTransactionBlock({
          sender: currentAccount.address,
          transactionBlock: tx.serialize()
        });
        
        console.log("Get stake info simulation result:", simulateResult);
        
        if (simulateResult && simulateResult.results && simulateResult.results.length > 0) {
          const result = simulateResult.results[0];
          if (result.returnValues && result.returnValues.length >= 2) {
            // 解析返回的质押金额和奖励
            let amount = 0;
            let reward = 0;
            
            try {
              if (Array.isArray(result.returnValues[0]) && result.returnValues[0].length > 0) {
                amount = parseInt(String(result.returnValues[0][0]));
              }
              
              if (Array.isArray(result.returnValues[1]) && result.returnValues[1].length > 0) {
                reward = parseInt(String(result.returnValues[1][0]));
              }
              
              console.log(`Stake info: amount=${amount}, reward=${reward}`);
              
              // 如果用户没有质押记录，返回null
              if (amount === 0 && reward === 0) {
                setCurrentStakeInfo(null);
                return;
              }
              
              // 更新质押信息状态
              setCurrentStakeInfo({
                amount,
                reward
              });
              return;
            } catch (parseError) {
              console.error("Failed to parse stake info:", parseError);
            }
          }
        }
        
        // 如果上面的方法失败，尝试方法2
        console.log("Method 1 failed or returned no data, trying method 2...");
      } catch (simulateError) {
        console.error("Simulation failed:", simulateError);
        console.log("Trying alternative method...");
      }
      
      // 方法2: 直接查询流动性池对象
      // 获取流动性池共享对象的完整内容
      const poolObject = await suiClient.getObject({
        id: LIQUIDITY_POOL_ID,
        options: {
          showContent: true,
          showOwner: true,
          showDisplay: true
        }
      });
      
      console.log("Liquidity pool object:", poolObject);
      
      if (!poolObject.data || !poolObject.data.content) {
        console.log("No pool data found");
        setCurrentStakeInfo(null);
        return;
      }
      
      // 尝试分析流动性池对象的stakes表
      if (poolObject.data.content.dataType === 'moveObject') {
        const poolFields = poolObject.data.content.fields as Record<string, any>;
        
        console.log("Pool fields:", poolFields);
        
        if (poolFields.stakes && poolFields.stakes.fields && poolFields.stakes.fields.id) {
          const tableId = poolFields.stakes.fields.id.id;
          
          console.log("Stakes table ID:", tableId);
          
          // 查询动态字段，找到用户的质押信息
          const dynamicFields = await suiClient.getDynamicFields({
            parentId: tableId
          });
          
          console.log("Dynamic fields:", dynamicFields);
          
          if (dynamicFields.data && dynamicFields.data.length > 0) {
            // 查找当前用户的质押记录
            const userStakeField = dynamicFields.data.find(field => 
              field.name && typeof field.name === 'object' && 'value' in field.name && field.name.value === currentAccount.address
            );
            
            if (userStakeField) {
              console.log("Found user stake field:", userStakeField);
              
              // 找到用户记录，获取详细信息
              const stakeObjectResponse = await suiClient.getObject({
                id: userStakeField.objectId,
                options: { showContent: true }
              });
              
              console.log("Stake object response:", stakeObjectResponse);
              
              if (stakeObjectResponse.data && stakeObjectResponse.data.content) {
                const content = stakeObjectResponse.data.content;
                if (content.dataType === 'moveObject') {
                  const stakeFields = content.fields as Record<string, any>;
                  
                  console.log("Stake fields:", stakeFields);
                  
                  // 提取质押信息 - 直接访问值对象
                  if (stakeFields.value && stakeFields.value.fields) {
                    const stakeValue = stakeFields.value.fields;
                    const amount = parseInt(String(stakeValue.amount || 0));
                    const stakeTime = parseInt(String(stakeValue.stake_time || 0));
                    const lastRewardTime = parseInt(String(stakeValue.last_reward_time || 0));
                    
                    // 计算奖励 (简化版，实际逻辑应与Move合约中的calculate_reward匹配)
                    const currentTime = Date.now();
                    const timeElapsed = currentTime - lastRewardTime;
                    // 这里的奖励计算是简化的，应该与Move合约中的计算匹配
                    const reward = Math.floor(amount * 0.05 * (timeElapsed / (365 * 24 * 60 * 60 * 1000)));
                    
                    // 更新质押信息状态
                    setCurrentStakeInfo({
                      amount,
                      reward
                    });
                    return;
                  }
                }
              }
            }
          }
        }
      }
      
      // 如果以上都失败，则没有找到质押信息
      setCurrentStakeInfo(null);
    } catch (error) {
      console.error("Failed to get stake info:", error);
      setCurrentStakeInfo(null);
    }
  };

  // Fetch user tasks from the blockchain
  const fetchUserTasks = async () => {
    if (!currentAccount) return;
    
    try {
      setIsLoading(true);
      
      // Get all TaskConfig objects owned by the user
      const response = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${packageId}::task::TaskConfig`
        },
        options: {
          showContent: true,
          showType: true
        }
      });
      
      console.log('User task objects:', response);
      
      if (response && response.data) {
        // Process returned object data
        const taskObjects = response.data
          .filter(obj => obj.data && obj.data.content)
          .map(obj => {
            const content = obj.data?.content;
            if (content && 'fields' in content) {
              // Use type assertion to ensure type safety
              const contentFields = content.fields as Record<string, any>;
              
              // Build extended task config object
              const taskConfig: ExtendedTaskConfig = {
                id: obj.data?.objectId || '',
                chain_pairs: Array.isArray(contentFields.chain_pairs) ? contentFields.chain_pairs : [],
                threshold: Number(contentFields.threshold) / 100, // Convert basis points to percentage
                cooldown: Number(contentFields.cooldown),
                last_alert: Number(contentFields.last_alert) || 0,
                status: 'active', // Default status is active
                // Determine task creation time (use object ID or current time as fallback)
                created_at: obj.data?.previousTransaction ? 
                  Date.now() : // Use current time, as SuiObjectData doesn't directly provide creation time
                  Date.now(),
              };
              
              // Add chain pair display string
              taskConfig.chain_pair_display = taskConfig.chain_pairs.join(', ');
              
              return taskConfig;
            }
            return null;
          })
          .filter((task): task is ExtendedTaskConfig => task !== null)
          // Sort by creation time, newest first
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
        setTasks(taskObjects);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Error fetching task data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取用户的质押和解质押交易历史
  const fetchStakingHistory = async () => {
    if (!currentAccount) return;

    try {
      setIsStakingLoading(true);
      setStakingError(null);
      
      console.log("正在查询质押历史，使用包ID:", liquidityPackageId);
      
      // 方法1：通过事件查询
      // 查询质押事件
      const stakeEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${liquidityPackageId}::liquidity::StakeEvent`
        },
        order: 'descending',
        limit: 50
      });
      
      // 查询解质押事件
      const unstakeEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${liquidityPackageId}::liquidity::UnstakeEvent`
        },
        order: 'descending',
        limit: 50
      });
      
      console.log("质押事件查询结果:", stakeEvents);
      console.log("解质押事件查询结果:", unstakeEvents);
      
      // 合并事件数据
      let events = {
        data: [
          ...(stakeEvents.data || []),
          ...(unstakeEvents.data || [])
        ]
      };
      
      // 如果通过事件查询没有找到数据，尝试方法2：查询用户的最近交易
      if (!events.data || events.data.length === 0) {
        console.log("通过事件查询未找到数据，尝试查询用户最近交易...");
        
        // 获取用户最近的交易记录
        const txs = await suiClient.queryTransactionBlocks({
          filter: {
            FromAddress: currentAccount.address
          },
          order: 'descending',
          limit: 20,
          options: {
            showInput: true,
            showEffects: true,
            showEvents: true
          }
        });
        
        console.log("用户最近交易:", txs);
        
        // 从交易中提取质押/解质押事件
        if (txs.data && txs.data.length > 0) {
          const stakingTxs: StakingTransaction[] = [];
          
          for (const tx of txs.data) {
            // 检查交易是否调用了 stake 或 unstake 函数
            if (tx.transaction && tx.transaction.data) {
              const txData = tx.transaction.data;
              
              // 确保 transactions 字段存在并且是数组
              if (typeof txData === 'object' && 'transactions' in txData) {
                const txCommands = txData.transactions as any[];
                
                if (Array.isArray(txCommands)) {
                  for (const cmd of txCommands) {
                    if (cmd && typeof cmd === 'object' && 'MoveCall' in cmd) {
                      const moveCall = cmd.MoveCall;
                      
                      // 检查是否是 stake 或 unstake 调用
                      if (moveCall && moveCall.package === liquidityPackageId && 
                          moveCall.module === 'liquidity') {
                        
                        const isStake = moveCall.function === 'stake';
                        const isUnstake = moveCall.function === 'unstake';
                        
                        if (isStake || isUnstake) {
                          // 分析交易事件以找到相关的StakeEvent或UnstakeEvent
                          let amount = 0;
                          
                          // 如果是unstake，从参数中提取amount
                          if (isUnstake && moveCall.arguments && moveCall.arguments.length > 0) {
                            try {
                              amount = parseInt(moveCall.arguments[0]);
                            } catch (error) {
                              console.error("解析unstake金额失败:", error);
                            }
                          }
                          
                          // 从交易事件中获取更多信息
                          if (tx.events && Array.isArray(tx.events)) {
                            for (const event of tx.events) {
                              if (event.type.includes('::StakeEvent') && isStake) {
                                try {
                                  if (event.parsedJson && typeof event.parsedJson === 'object') {
                                    const eventData = event.parsedJson as any;
                                    amount = parseInt(String(eventData.amount || 0));
                                  }
                                } catch (error) {
                                  console.error("解析StakeEvent失败:", error);
                                }
                                break;
                              } else if (event.type.includes('::UnstakeEvent') && isUnstake) {
                                try {
                                  if (event.parsedJson && typeof event.parsedJson === 'object') {
                                    const eventData = event.parsedJson as any;
                                    amount = parseInt(String(eventData.amount || 0));
                                  }
                                } catch (error) {
                                  console.error("解析UnstakeEvent失败:", error);
                                }
                                break;
                              }
                            }
                          }
                          
                          // 添加到质押交易列表
                          stakingTxs.push({
                            id: tx.digest,
                            type: isStake ? 'stake' : 'unstake',
                            amount: amount / 1000000, // 转换为显示单位
                            timestamp: tx.timestampMs ? parseInt(tx.timestampMs) : Date.now(),
                            txDigest: tx.digest
                          });
                          
                          break; // 找到相关调用后就跳出循环
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (stakingTxs.length > 0) {
            setStakingHistory(stakingTxs);
            setIsStakingLoading(false);
            return;
          }
        }
      }
      
      // 如果方法1有数据，处理这些数据
      if (events.data && events.data.length > 0) {
        const stakingTxs: StakingTransaction[] = [];
        
        // 处理每个事件
        for (const event of events.data) {
          try {
            if (event.parsedJson && typeof event.parsedJson === 'object') {
              const eventData = event.parsedJson as any;
              
              // 只处理当前用户的事件
              if (eventData.user && eventData.user.toLowerCase() === currentAccount.address.toLowerCase()) {
                const isStake = event.type.endsWith('::liquidity::StakeEvent');
                const amount = parseInt(String(eventData.amount || 0));
                const timestamp = event.timestampMs ? parseInt(event.timestampMs) : Date.now();
                
                stakingTxs.push({
                  id: typeof event.id === 'object' ? JSON.stringify(event.id) : String(event.id),
                  type: isStake ? 'stake' : 'unstake',
                  amount: amount / 1000000, // 转换为显示单位
                  timestamp,
                  txDigest: event.transactionModule || ''
                });
              }
            }
          } catch (error) {
            console.error('处理事件时出错:', error);
          }
        }
        
        // 按时间排序，最新的在前
        stakingTxs.sort((a, b) => b.timestamp - a.timestamp);
        setStakingHistory(stakingTxs);
      } else {
        setStakingHistory([]);
      }
    } catch (err) {
      console.error('获取质押历史失败:', err);
      setStakingError('获取质押历史失败，请稍后再试。');
    } finally {
      setIsStakingLoading(false);
    }
  };
  
  // Fetch data on page load
  useEffect(() => {
    if (currentAccount) {
      fetchUserTasks();
      fetchStakingHistory();
    } else {
      setTasks([]);
      setStakingHistory([]);
      setCurrentStakeInfo(null);
      setIsLoading(false);
      setIsStakingLoading(false);
    }
  }, [currentAccount]);
  
  // Helper function: Format timestamp to relative time
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    try {
      return formatDistance(timestamp, new Date(), { addSuffix: true });
    } catch (e) {
      return 'Invalid time';
    }
  };
  
  // Format threshold display
  const formatThreshold = (threshold: number) => {
    return `${threshold.toFixed(2)}%`;
  };
  
  // Format cooldown time
  const formatCooldown = (seconds: number) => {
    if (seconds < 60) return `${seconds} sec`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };
  
  // Get task status badge color
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'active': return 'green';
      case 'paused': return 'amber';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  };
  
  // Truncate long IDs for display
  const truncateId = (id: string, length = 8) => {
    if (!id) return '';
    if (id.length <= length * 2) return id;
    return `${id.substring(0, length)}...${id.substring(id.length - length)}`;
  };

  // 获取操作类型的Badge颜色
  const getOperationColor = (type: 'stake' | 'unstake') => {
    return type === 'stake' ? 'green' : 'red';
  };

  // 渲染质押/解质押历史表格
  const renderStakingHistory = () => {
    if (isStakingLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: '#94A3B8'
        }}>
          <div style={styles.spinner}></div>
          <Text ml="3">Loading staking history...</Text>
        </div>
      );
    }

    if (stakingError) {
      return (
        <Box style={styles.alertError}>
          <div style={styles.iconContainer}>
            <svg style={{ height: '20px', width: '20px', color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <Text style={styles.alertText}>
            {stakingError}
          </Text>
        </Box>
      );
    }

    if (stakingHistory.length === 0) {
      return (
        <Box style={styles.emptyState}>
          <svg 
            style={{ margin: '0 auto 16px', width: '48px', height: '48px', color: '#4B5563' }}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <Text size="5" style={{ color: '#CBD5E1', marginBottom: '8px' }}>
            No Staking History Found
          </Text>
          <Text size="2" style={{ color: '#94A3B8' }}>
            You have not performed any staking or unstaking operations yet. Go to the "Liquidity" page to start.
          </Text>
        </Box>
      );
    }

    return (
      <Box style={styles.tableContainer}>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row style={styles.tableHeader}>
              <Table.ColumnHeaderCell style={styles.tableHeader}>Transaction ID</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>Operation</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>Amount (gUSDT)</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>Time</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {stakingHistory.map((tx, index) => (
              <Table.Row key={tx.id} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                <Table.Cell style={styles.tableCell}>
                  <Box style={styles.monospaceText}>
                    <a 
                      href={`https://suiscan.xyz/testnet/tx/${tx.txDigest}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#60a5fa', textDecoration: 'none' }}
                    >
                      {truncateId(tx.txDigest)}
                    </a>
                  </Box>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getOperationColor(tx.type)}>
                    {tx.type === 'stake' ? 'Stake' : 'Unstake'}
                  </Badge>
                </Table.Cell>
                <Table.Cell style={styles.tableCell}>
                  {tx.amount.toFixed(2)}
                </Table.Cell>
                <Table.Cell style={styles.tableCell}>
                  {formatTime(tx.timestamp)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    );
  };

  // 渲染任务历史表格
  const renderTaskHistory = () => {
    if (isLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: '#94A3B8'
        }}>
          <div style={styles.spinner}></div>
          <Text ml="3">Loading task data...</Text>
        </div>
      );
    }

    if (error) {
      return (
        <Box style={styles.alertError}>
          <div style={styles.iconContainer}>
            <svg style={{ height: '20px', width: '20px', color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <Text style={styles.alertText}>
            {error}
          </Text>
        </Box>
      );
    }

    if (tasks.length === 0) {
      return (
        <Box style={styles.emptyState}>
          <svg 
            style={{ margin: '0 auto 16px', width: '48px', height: '48px', color: '#4B5563' }}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <Text size="5" style={{ color: '#CBD5E1', marginBottom: '8px' }}>
            No Tasks Found
          </Text>
          <Text size="2" style={{ color: '#94A3B8' }}>
            You haven't created any price monitoring tasks yet. Go to the "Create Task" page to create a new one.
          </Text>
        </Box>
      );
    }

    return (
      <Box style={styles.tableContainer}>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row style={styles.tableHeader}>
              <Table.ColumnHeaderCell style={styles.tableHeader}>TASK ID</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>MONITORED CHAINS</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>THRESHOLD</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>COOLDOWN</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>LAST ALERT</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={styles.tableHeader}>STATUS</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {tasks.map((task, index) => (
              <Table.Row key={task.id} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                <Table.Cell style={styles.tableCell}>
                  <Box style={styles.monospaceText}>
                    {truncateId(task.id)}
                  </Box>
                </Table.Cell>
                <Table.Cell style={styles.tableCell}>
                  {task.chain_pair_display || 'Unknown'}
                </Table.Cell>
                <Table.Cell style={styles.tableCell}>
                  {formatThreshold(task.threshold)}
                </Table.Cell>
                <Table.Cell style={styles.tableCell}>
                  {formatCooldown(task.cooldown)}
                </Table.Cell>
                <Table.Cell style={styles.tableCell}>
                  {task.last_alert && task.last_alert > 0 
                    ? formatTime(task.last_alert) 
                    : 'Never triggered'}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getStatusColor(task.status)}>
                    {task.status === 'active' ? 'ACTIVE' : 
                     task.status === 'paused' ? 'PAUSED' : 'COMPLETED'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    );
  };

  return (
    <Container style={styles.container}>
      <Box style={styles.card}>
        <Heading size="5" style={styles.heading}>History</Heading>
        <Text size="2" style={styles.subText}>
          View your monitoring tasks and staking/unstaking history
        </Text>
      </Box>
      
      {!currentAccount && (
        <Box style={styles.alertWarning}>
          <div style={styles.iconContainer}>
            <svg style={{ height: '20px', width: '20px', color: '#ca8a04' }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <Text style={styles.alertText}>
            Please connect your wallet to view your history
          </Text>
        </Box>
      )}
      
      {currentAccount && (
        <Tabs.Root defaultValue="staking" style={styles.tabs}>
          <Tabs.List>
            <Tabs.Trigger value="tasks">Monitoring Tasks</Tabs.Trigger>
            <Tabs.Trigger value="staking">Staking History</Tabs.Trigger>
          </Tabs.List>
          
          <Box style={{ marginTop: '16px' }}>
            <Tabs.Content value="tasks">
              {renderTaskHistory()}
              
              {/* Refresh button for tasks */}
              <Box style={{ marginTop: '16px', textAlign: 'right' }}>
                <button 
                  onClick={fetchUserTasks} 
                  style={{
                    ...styles.buttonPrimary,
                    ...(isLoading ? styles.buttonDisabled : {})
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Refreshing...' : 'Refresh Task List'}
                </button>
              </Box>
            </Tabs.Content>
            
            <Tabs.Content value="staking">
              {renderStakingHistory()}
              
              {/* Refresh button for staking */}
              <Box style={{ marginTop: '16px', textAlign: 'right' }}>
                <button 
                  onClick={fetchStakingHistory} 
                  style={{
                    ...styles.buttonPrimary,
                    ...(isStakingLoading ? styles.buttonDisabled : {})
                  }}
                  disabled={isStakingLoading}
                >
                  {isStakingLoading ? 'Refreshing...' : 'Refresh Staking History'}
                </button>
              </Box>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      )}
    </Container>
  );
} 