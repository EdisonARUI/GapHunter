import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Container, Heading, Table, Text, Box, Flex, Badge } from '@radix-ui/themes';
import { SuiClient, type SuiMoveObject } from '@mysten/sui.js/client';
import { TaskConfig } from '../types/task';
import { formatDistance } from 'date-fns';

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
};

// Define task status type
type TaskStatus = 'active' | 'paused' | 'completed';

// Define extended task data type with additional UI information
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
  
  // Contract package ID - keep consistent with CreateTask page
  const packageId = '0x0ab66ff86fbbc74056dc9bfcfdcb7b12f0419e26eccc97fc37cab758c70b1cb7';
  
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
  
  // Fetch tasks on page load
  useEffect(() => {
    if (currentAccount) {
      fetchUserTasks();
    } else {
      setTasks([]);
      setIsLoading(false);
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

  return (
    <Container style={styles.container}>
      <Box style={styles.card}>
        <Heading size="5" style={styles.heading}>TASK HISTORY</Heading>
        <Text size="2" style={styles.subText}>
          View all price monitoring tasks you've created and their status
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
            Please connect your wallet to view your task history
          </Text>
        </Box>
      )}
      
      {error && (
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
      )}
      
      {isLoading ? (
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
      ) : (
        <>
          {tasks.length > 0 ? (
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
          ) : (
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
          )}
        </>
      )}
      
      {/* Refresh button */}
      {currentAccount && (
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
      )}
    </Container>
  );
} 