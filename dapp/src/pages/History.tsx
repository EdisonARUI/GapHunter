import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Container, Heading, Table, Text, Box, Flex, Badge } from '@radix-ui/themes';
import { SuiClient, type SuiMoveObject } from '@mysten/sui.js/client';
import { TaskConfig } from '../types/task';
import { formatDistance } from 'date-fns';

// 定义任务状态类型
type TaskStatus = 'active' | 'paused' | 'completed';

// 定义扩展的任务数据类型，包含UI显示需要的额外信息
interface ExtendedTaskConfig extends TaskConfig {
  status: TaskStatus;
  created_at?: number;
  chain_pair_display?: string;
}

export default function History() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [tasks, setTasks] = useState<ExtendedTaskConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 合约包ID - 与CreateTask页面保持一致
  const packageId = '0x0ab66ff86fbbc74056dc9bfcfdcb7b12f0419e26eccc97fc37cab758c70b1cb7';
  
  // 从链上获取用户的任务对象
  const fetchUserTasks = async () => {
    if (!currentAccount) return;
    
    try {
      setIsLoading(true);
      
      // 获取用户拥有的所有TaskConfig对象
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
      
      console.log('用户任务对象:', response);
      
      if (response && response.data) {
        // 处理返回的对象数据
        const taskObjects = response.data
          .filter(obj => obj.data && obj.data.content)
          .map(obj => {
            const content = obj.data?.content;
            if (content && 'fields' in content) {
              // 使用类型断言确保类型安全
              const contentFields = content.fields as Record<string, any>;
              
              // 构建扩展的任务配置对象
              const taskConfig: ExtendedTaskConfig = {
                id: obj.data?.objectId || '',
                chain_pairs: Array.isArray(contentFields.chain_pairs) ? contentFields.chain_pairs : [],
                threshold: Number(contentFields.threshold) / 100, // 将基点转换为百分比
                cooldown: Number(contentFields.cooldown),
                last_alert: Number(contentFields.last_alert) || 0,
                status: 'active', // 默认状态为活跃
                // 确定任务创建时间（使用对象ID或当前时间作为后备）
                created_at: obj.data?.previousTransaction ? 
                  Date.now() : // 使用当前时间，因为SuiObjectData没有直接提供创建时间
                  Date.now(),
              };
              
              // 添加链对显示字符串
              taskConfig.chain_pair_display = taskConfig.chain_pairs.join(', ');
              
              return taskConfig;
            }
            return null;
          })
          .filter((task): task is ExtendedTaskConfig => task !== null)
          // 按创建时间排序，最新的在前面
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
        setTasks(taskObjects);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('获取任务失败:', err);
      setError('获取任务数据时出错，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 页面加载时获取任务
  useEffect(() => {
    if (currentAccount) {
      fetchUserTasks();
    } else {
      setTasks([]);
      setIsLoading(false);
    }
  }, [currentAccount]);
  
  // 帮助函数：格式化时间戳为相对时间
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '未知';
    try {
      return formatDistance(timestamp, new Date(), { addSuffix: true });
    } catch (e) {
      return '无效时间';
    }
  };
  
  // 格式化阈值显示
  const formatThreshold = (threshold: number) => {
    return `${threshold.toFixed(2)}%`;
  };
  
  // 格式化冷却时间
  const formatCooldown = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`;
  };
  
  // 获取任务状态标签颜色
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'active': return 'green';
      case 'paused': return 'amber';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  };
  
  // 截断显示ID等长字符串
  const truncateId = (id: string, length = 8) => {
    if (!id) return '';
    if (id.length <= length * 2) return id;
    return `${id.substring(0, length)}...${id.substring(id.length - length)}`;
  };

  return (
    <Container style={{ backgroundColor: '#121212', padding: '16px', minHeight: 'calc(100vh - 60px)' }}>
      <Box mb="4" style={{ backgroundColor: '#1a1a1a', padding: '16px', borderRadius: '8px' }}>
        <Heading size="5" style={{ color: '#e2e8f0', marginBottom: '8px' }}>任务历史</Heading>
        <Text size="2" style={{ color: '#94a3b8' }}>
          查看您创建的所有价格监控任务及其状态
        </Text>
      </Box>
      
      {!currentAccount && (
        <Box style={{ 
          backgroundColor: 'rgba(146, 64, 14, 0.2)', 
          borderLeftWidth: '4px', 
          borderLeftColor: '#ca8a04', 
          padding: '16px', 
          marginBottom: '16px', 
          borderRadius: '4px' 
        }}>
          <Flex align="center">
            <div style={{ flexShrink: 0 }}>
              <svg style={{ height: '20px', width: '20px', color: '#ca8a04' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <Text style={{ marginLeft: '12px', fontSize: '14px', color: '#ca8a04' }}>
              请连接钱包以查看您的任务历史
            </Text>
          </Flex>
        </Box>
      )}
      
      {error && (
        <Box style={{ 
          backgroundColor: 'rgba(127, 29, 29, 0.2)', 
          borderLeftWidth: '4px', 
          borderLeftColor: '#dc2626', 
          padding: '16px', 
          marginBottom: '16px', 
          borderRadius: '4px' 
        }}>
          <Flex align="center">
            <div style={{ flexShrink: 0 }}>
              <svg style={{ height: '20px', width: '20px', color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <Text style={{ marginLeft: '12px', fontSize: '14px', color: '#dc2626' }}>
              {error}
            </Text>
          </Flex>
        </Box>
      )}
      
      {isLoading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: '#94a3b8'
        }}>
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
          <Text ml="3">加载任务数据...</Text>
        </div>
      ) : (
        <>
          {tasks.length > 0 ? (
            <Box style={{ 
              backgroundColor: '#1e1e1e', 
              borderRadius: '8px', 
              overflow: 'auto',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row style={{ backgroundColor: '#292929' }}>
                    <Table.ColumnHeaderCell style={{ color: '#e2e8f0' }}>任务ID</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ color: '#e2e8f0' }}>监控链对</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ color: '#e2e8f0' }}>价差阈值</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ color: '#e2e8f0' }}>冷却时间</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ color: '#e2e8f0' }}>上次警报</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ color: '#e2e8f0' }}>状态</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {tasks.map((task, index) => (
                    <Table.Row key={task.id} style={{ 
                      backgroundColor: index % 2 === 0 ? '#262626' : '#2d2d2d'
                    }}>
                      <Table.Cell style={{ color: '#cbd5e1' }}>
                        <Box style={{
                          fontFamily: 'monospace',
                          fontSize: '12px'
                        }}>
                          {truncateId(task.id)}
                        </Box>
                      </Table.Cell>
                      <Table.Cell style={{ color: '#cbd5e1' }}>
                        {task.chain_pair_display || '未知'}
                      </Table.Cell>
                      <Table.Cell style={{ color: '#cbd5e1' }}>
                        {formatThreshold(task.threshold)}
                      </Table.Cell>
                      <Table.Cell style={{ color: '#cbd5e1' }}>
                        {formatCooldown(task.cooldown)}
                      </Table.Cell>
                      <Table.Cell style={{ color: '#cbd5e1' }}>
                        {task.last_alert && task.last_alert > 0 
                          ? formatTime(task.last_alert) 
                          : '从未触发'}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={getStatusColor(task.status)}>
                          {task.status === 'active' ? '活跃' : 
                           task.status === 'paused' ? '暂停' : '已完成'}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          ) : (
            <Box style={{ 
              backgroundColor: '#1e1e1e', 
              borderRadius: '8px', 
              padding: '40px 20px',
              textAlign: 'center',
              color: '#94a3b8'
            }}>
              <svg 
                style={{ margin: '0 auto 16px', width: '48px', height: '48px', color: '#4b5563' }}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <Text size="5" style={{ color: '#cbd5e1', marginBottom: '8px' }}>
                暂无任务记录
              </Text>
              <Text size="2" style={{ color: '#94a3b8' }}>
                您还没有创建任何价格监控任务，请前往「创建任务」页面创建一个新任务
              </Text>
            </Box>
          )}
        </>
      )}
      
      {/* 刷新按钮 */}
      {currentAccount && (
        <Box style={{ marginTop: '16px', textAlign: 'right' }}>
          <button 
            onClick={fetchUserTasks} 
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
            disabled={isLoading}
          >
            {isLoading ? '刷新中...' : '刷新任务列表'}
          </button>
        </Box>
      )}
    </Container>
  );
} 