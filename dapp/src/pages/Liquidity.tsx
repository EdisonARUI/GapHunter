import { useState, ChangeEvent, useMemo } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Container, Button, Flex, Text, Box } from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import { Transaction } from '@mysten/sui/transactions';
import type { SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { 
  TESTNET_COUNTER_PACKAGE_ID, 
  TREASURY_CAP_ID, 
  LIQUIDITY_POOL_ID, 
  CLOCK_ID 
} from '../constants';
import { bcs } from '@mysten/sui/bcs';

// 定义样式
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
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '24px',
  },
  button: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    margin: '8px',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  alertError: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderLeft: '4px solid #dc2626',
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '4px',
  },
  alertText: {
    color: '#dc2626',
    fontSize: '14px',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '12px'
  },
  inputLabel: {
    color: '#E2E8F0',
    width: '80px',
    fontSize: '14px',
  },
  inputField: {
    flex: 1,
    backgroundColor: '#2D3748',
    color: '#FFFFFF',
    border: '1px solid #4A5568',
    borderRadius: '4px',
    padding: '8px 12px',
    width: '100%',
  },
  monospaceText: {
    fontFamily: 'monospace',
    wordBreak: 'break-word' as const,
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
};

// gUSDT的精度，定义在智能合约中为6位小数
const TOKEN_DECIMALS = 6;
const DECIMAL_MULTIPLIER = 10 ** TOKEN_DECIMALS;

export default function Liquidity() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayMintAmount, setDisplayMintAmount] = useState(10000);
  const [displayStakeAmount, setDisplayStakeAmount] = useState(10000);
  const [displayUnstakeAmount, setDisplayUnstakeAmount] = useState(10000);
  
  // 计算链上实际使用的数值（考虑代币精度）
  const mintAmount = useMemo(() => displayMintAmount * DECIMAL_MULTIPLIER, [displayMintAmount]);
  const stakeAmount = useMemo(() => displayStakeAmount * DECIMAL_MULTIPLIER, [displayStakeAmount]);
  const unstakeAmount = useMemo(() => displayUnstakeAmount * DECIMAL_MULTIPLIER, [displayUnstakeAmount]);
  
  // Dialog 状态
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successOperation, setSuccessOperation] = useState('');
  const [transactionId, setTransactionId] = useState('');

  // 处理输入变化
  const handleMintAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDisplayMintAmount(parseFloat(e.target.value) || 0);
  };

  const handleStakeAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDisplayStakeAmount(parseFloat(e.target.value) || 0);
  };

  const handleUnstakeAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDisplayUnstakeAmount(parseFloat(e.target.value) || 0);
  };

  // 铸造gUSDT
  const handleMint = async () => {
    try {
      if (!currentAccount) {
        throw new Error('请先连接钱包');
      }

      setIsLoading(true);
      setError(null);

      const tx = new Transaction();
      const packageId = TESTNET_COUNTER_PACKAGE_ID;

      console.log(`准备铸造 ${displayMintAmount} gUSDT（链上数值：${mintAmount}）`);

      // 铸造gUSDT
      tx.moveCall({
        target: `${packageId}::mycoin::mint`,
        arguments: [
          tx.object(TREASURY_CAP_ID), // TreasuryCap ID
          tx.pure(bcs.u64().serialize(mintAmount)), // 铸造数量（已考虑精度）
          tx.pure(bcs.Address.serialize(currentAccount.address)), // 接收者地址
        ],
      });

      // 使用回调处理结果
      signAndExecuteTransaction(
        { transaction: tx.serialize() },
        {
          onSuccess: (result) => {
            console.log('铸造交易执行结果:', result);
            setSuccessOperation('铸造');
            if (result && typeof result === 'object' && 'digest' in result) {
              setTransactionId(result.digest);
            } else {
              setTransactionId('交易已提交，但未返回交易ID');
            }
            setShowSuccessDialog(true);
            setIsLoading(false);
          },
          onError: (err) => {
            console.error('执行铸造交易失败:', err);
            setError('执行铸造交易失败: ' + (err instanceof Error ? err.message : String(err)));
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error('准备铸造交易失败:', error);
      setError('准备铸造交易失败: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  // 质押gUSDT
  const handleStake = async () => {
    try {
      if (!currentAccount) {
        throw new Error('请先连接钱包');
      }

      setIsLoading(true);
      setError(null);

      const tx = new Transaction();
      const packageId = TESTNET_COUNTER_PACKAGE_ID;

      console.log(`准备质押 ${displayStakeAmount} gUSDT（链上数值：${stakeAmount}）`);

      // 质押gUSDT
      tx.moveCall({
        target: `${packageId}::liquidity::stake`,
        arguments: [
          tx.object(LIQUIDITY_POOL_ID), // LiquidityPool ID
          tx.pure(bcs.u64().serialize(stakeAmount)), // 质押数量（已考虑精度）
          tx.object(CLOCK_ID), // Clock对象
        ],
      });

      // 使用回调处理结果
      signAndExecuteTransaction(
        { transaction: tx.serialize() },
        {
          onSuccess: (result) => {
            console.log('质押交易执行结果:', result);
            setSuccessOperation('质押');
            if (result && typeof result === 'object' && 'digest' in result) {
              setTransactionId(result.digest);
            } else {
              setTransactionId('交易已提交，但未返回交易ID');
            }
            setShowSuccessDialog(true);
            setIsLoading(false);
          },
          onError: (err) => {
            console.error('执行质押交易失败:', err);
            setError('执行质押交易失败: ' + (err instanceof Error ? err.message : String(err)));
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error('准备质押交易失败:', error);
      setError('准备质押交易失败: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  // 解质押gUSDT
  const handleUnstake = async () => {
    try {
      if (!currentAccount) {
        throw new Error('请先连接钱包');
      }

      setIsLoading(true);
      setError(null);

      const tx = new Transaction();
      const packageId = TESTNET_COUNTER_PACKAGE_ID;

      console.log(`准备解质押 ${displayUnstakeAmount} gUSDT（链上数值：${unstakeAmount}）`);

      // 解质押gUSDT
      tx.moveCall({
        target: `${packageId}::liquidity::unstake`,
        arguments: [
          tx.object(LIQUIDITY_POOL_ID), // LiquidityPool ID
          tx.pure(bcs.u64().serialize(unstakeAmount)), // 解质押数量（已考虑精度）
          tx.object(CLOCK_ID), // Clock对象
        ],
      });

      // 使用回调处理结果
      signAndExecuteTransaction(
        { transaction: tx.serialize() },
        {
          onSuccess: (result) => {
            console.log('解质押交易执行结果:', result);
            setSuccessOperation('解质押');
            if (result && typeof result === 'object' && 'digest' in result) {
              setTransactionId(result.digest);
            } else {
              setTransactionId('交易已提交，但未返回交易ID');
            }
            setShowSuccessDialog(true);
            setIsLoading(false);
          },
          onError: (err) => {
            console.error('执行解质押交易失败:', err);
            setError('执行解质押交易失败: ' + (err instanceof Error ? err.message : String(err)));
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error('准备解质押交易失败:', error);
      setError('准备解质押交易失败: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <Container style={styles.container}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={styles.card}>
          <h1 style={styles.heading}>流动性管理</h1>
          
          {!currentAccount && (
            <div style={styles.alertError}>
              <Text style={styles.alertText}>请先连接钱包</Text>
            </div>
          )}

          {error && (
            <div style={styles.alertError}>
              <Text style={styles.alertText}>{error}</Text>
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            {/* 铸造操作 */}
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#1E1E1E', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '18px', color: '#E2E8F0', marginBottom: '16px' }}>铸造 gUSDT</h3>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>数量:</label>
                <input
                  type="number" 
                  value={displayMintAmount}
                  onChange={handleMintAmountChange}
                  placeholder="输入铸造数量"
                  step="0.000001"
                  style={styles.inputField}
                />
              </div>
              <Button 
                onClick={handleMint}
                disabled={isLoading || !currentAccount}
                style={{
                  ...styles.button,
                  ...(isLoading || !currentAccount ? styles.buttonDisabled : {})
                }}
              >
                {isLoading ? '处理中...' : 'Mint'}
              </Button>
            </div>

            {/* 质押操作 */}
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#1E1E1E', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '18px', color: '#E2E8F0', marginBottom: '16px' }}>质押 gUSDT</h3>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>数量:</label>
                <input
                  type="number" 
                  value={displayStakeAmount}
                  onChange={handleStakeAmountChange}
                  placeholder="输入质押数量"
                  step="0.000001"
                  style={styles.inputField}
                />
              </div>
              <Button 
                onClick={handleStake}
                disabled={isLoading || !currentAccount}
                style={{
                  ...styles.button,
                  ...(isLoading || !currentAccount ? styles.buttonDisabled : {})
                }}
              >
                {isLoading ? '处理中...' : 'Stake'}
              </Button>
            </div>

            {/* 解质押操作 */}
            <div style={{ padding: '16px', backgroundColor: '#1E1E1E', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '18px', color: '#E2E8F0', marginBottom: '16px' }}>解质押 gUSDT</h3>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>数量:</label>
                <input
                  type="number" 
                  value={displayUnstakeAmount}
                  onChange={handleUnstakeAmountChange}
                  placeholder="输入解质押数量"
                  step="0.000001"
                  style={styles.inputField}
                />
              </div>
              <Button 
                onClick={handleUnstake}
                disabled={isLoading || !currentAccount}
                style={{
                  ...styles.button,
                  ...(isLoading || !currentAccount ? styles.buttonDisabled : {})
                }}
              >
                {isLoading ? '处理中...' : 'Unstake'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 成功对话框 */}
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
              {successOperation}操作执行成功
            </Dialog.Title>
            <Dialog.Description style={{ marginTop: '16px', fontSize: '14px', color: '#94A3B8' }}>
              您的{successOperation}操作已成功执行并记录在区块链上
            </Dialog.Description>
            
            <div style={{ margin: '20px 0', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>交易ID:</div>
              <div style={styles.monospaceText}>
                {transactionId}
              </div>
            </div>
            
            <div style={{ display: 'flex', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowSuccessDialog(false)}
                style={styles.buttonPrimary}
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
    </Container>
  );
}
