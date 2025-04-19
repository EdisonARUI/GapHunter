import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useSuiClient } from "@mysten/dapp-kit";
import { Text, Button, Card, Flex, Heading, Separator, Box } from "@radix-ui/themes";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { TransactionDialog } from "../components/TransactionDialog";
import { 
  fetchWalletBalance, 
  fetchStakeInfo, 
  mintGusdt, 
  stakeGusdt, 
  unstakeGusdt,
  queryRecentTransactions,
  StakeInfo, 
  DECIMAL_MULTIPLIER
} from "../utils/liquidity";

// 模拟TextField组件，替代@radix-ui/themes中不存在的TextField.Input
const TextField = {
  Root: ({ children }: { children: React.ReactNode }) => (
    <div style={{ position: 'relative', width: '100%' }}>{children}</div>
  ),
  Input: ({ 
    placeholder, 
    value, 
    onChange 
  }: { 
    placeholder?: string; 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void 
  }) => (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #333',
        backgroundColor: '#222',
        color: 'white',
        fontSize: '14px'
      }}
    />
  )
};

export function Liquidity() {
  // 获取当前钱包账户
  const currentAccount = useCurrentAccount();
  // 获取Sui客户端
  const suiClient = useSuiClient();
  // 获取交易执行器
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // 用户输入状态
  const [mintAmount, setMintAmount] = useState<string>("10000");
  const [stakeAmount, setStakeAmount] = useState<string>("1000");
  const [unstakeAmount, setUnstakeAmount] = useState<string>("100");

  // 应用状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isStakeLoading, setIsStakeLoading] = useState<boolean>(false);
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // 交易成功对话框状态
  const [showSuccessDialog, setShowSuccessDialog] = useState<boolean>(false);
  const [transactionId, setTransactionId] = useState<string>("");
  const [successOperation, setSuccessOperation] = useState<string>("");

  // 获取钱包余额和质押信息的回调函数
  const fetchData = async () => {
    if (!currentAccount || !suiClient) {
      console.error("钱包未连接或Sui客户端未初始化");
      return;
    }

    console.log("当前钱包地址:", currentAccount.address);
    console.log("Sui客户端:", suiClient);

    try {
      // 获取钱包余额
      await fetchWalletBalance(
        suiClient as any, 
        currentAccount.address, 
        {
          setIsLoading: setIsBalanceLoading,
          setWalletBalance,
          setError: setBalanceError
        }
      );

      // 获取质押信息
      await fetchStakeInfo(
        suiClient as any, 
        currentAccount.address, 
        {
          setIsLoading: setIsStakeLoading,
          setStakeInfo,
          setError
        }
      );
      
      // 查询最近交易帮助诊断
      await queryRecentTransactions(
        suiClient as any,
        currentAccount.address
      );
    } catch (err: any) {
      console.error("获取数据失败:", err);
      setError(`获取数据失败: ${err.message || JSON.stringify(err)}`);
    }
  };

  // 当钱包连接或改变时获取数据
  useEffect(() => {
    if (currentAccount) {
      console.log("钱包已连接:", currentAccount);
      fetchData();
    } else {
      console.log("钱包未连接");
      // 清除数据
      setWalletBalance(null);
      setStakeInfo(null);
    }
  }, [currentAccount, suiClient]);

  // 处理Mint操作
  const handleMint = async () => {
    if (!currentAccount || !suiClient) {
      setError("请先连接钱包");
      return;
    }

    const mintAmountValue = parseFloat(mintAmount);
    if (isNaN(mintAmountValue) || mintAmountValue <= 0) {
      setError("请输入有效的铸造数量");
      return;
    }

    // 计算真实的铸造数量（考虑精度）
    const actualMintAmount = Math.floor(mintAmountValue * DECIMAL_MULTIPLIER);

    // 准备回调函数
    const callbacks = {
      setIsLoading,
      setError,
      setSuccessOperation,
      setTransactionId,
      setShowSuccessDialog,
      onSuccess: () => {
        console.log("铸造操作成功，开始刷新数据...");
        // 延迟执行fetchData以确保区块链状态更新
        setTimeout(() => {
          fetchData();
          console.log("数据刷新完成");
        }, 2000);
      }
    };

    // 调用mintGusdt函数
    await mintGusdt(
      suiClient as any,
      currentAccount.address,
      actualMintAmount,
      mintAmountValue,
      signAndExecuteTransaction,
      callbacks
    );
  };

  // 处理质押操作
  const handleStake = async () => {
    if (!currentAccount || !suiClient) {
      setError("请先连接钱包");
      return;
    }

    const stakeAmountValue = parseFloat(stakeAmount);
    if (isNaN(stakeAmountValue) || stakeAmountValue <= 0) {
      setError("请输入有效的质押数量");
      return;
    }

    // 计算真实的质押数量（考虑精度）
    const actualStakeAmount = Math.floor(stakeAmountValue * DECIMAL_MULTIPLIER);

    // 准备回调函数
    const callbacks = {
      setIsLoading,
      setError,
      setSuccessOperation,
      setTransactionId,
      setShowSuccessDialog,
      onSuccess: () => {
        console.log("质押操作成功，开始刷新数据...");
        // 延迟执行fetchData以确保区块链状态更新
        setTimeout(async () => {
          await fetchData();
          console.log("数据刷新完成，再次检查交易...");
          // 再次延迟检查，确保区块链状态已更新
          setTimeout(async () => {
            if (!stakeInfo && currentAccount && suiClient) {
              console.log("仍未发现质押信息，尝试再次检查...");
              await fetchStakeInfo(
                suiClient as any, 
                currentAccount.address, 
                {
                  setIsLoading: setIsStakeLoading,
                  setStakeInfo,
                  setError
                }
              );
            }
          }, 3000);
        }, 2000);
      }
    };

    // 调用stakeGusdt函数
    await stakeGusdt(
      suiClient as any,
      currentAccount.address,
      actualStakeAmount,
      walletBalance || 0,
      stakeAmountValue,
      (walletBalance || 0) / DECIMAL_MULTIPLIER,
      signAndExecuteTransaction,
      callbacks
    );
  };

  // 处理解质押操作
  const handleUnstake = async () => {
    if (!currentAccount || !suiClient) {
      setError("请先连接钱包");
      return;
    }

    const unstakeAmountValue = parseFloat(unstakeAmount);
    if (isNaN(unstakeAmountValue) || unstakeAmountValue <= 0) {
      setError("请输入有效的解质押数量");
      return;
    }

    // 计算真实的解质押数量（考虑精度）
    const actualUnstakeAmount = Math.floor(unstakeAmountValue * DECIMAL_MULTIPLIER);

    // 如果没有质押信息，提示用户但继续尝试
    if (!stakeInfo) {
      console.log("未检测到质押信息，将尝试执行解质押操作");
      // 创建一个临时的stakeInfo对象
      const tempStakeInfo: StakeInfo = {
        amount: actualUnstakeAmount,  // 设置为要解质押的金额
        reward: 0,
        object_id: "unknown"  // 实际上应由后端查找
      };
      
      // 提示用户我们没有质押信息
      setError("未检测到质押信息，但将尝试执行解质押操作。如失败请刷新质押数据后重试。");
      
      // 准备回调函数
      const callbacks = {
        setIsLoading,
        setError,
        setSuccessOperation,
        setTransactionId,
        setShowSuccessDialog,
        onSuccess: () => {
          console.log("解质押操作成功，开始刷新数据...");
          // 延迟执行fetchData以确保区块链状态更新
          setTimeout(() => {
            fetchData();
            console.log("数据刷新完成");
          }, 2000);
        }
      };

      try {
        // 尝试先获取最新的质押信息
        await fetchStakeInfo(
          suiClient as any, 
          currentAccount.address, 
          {
            setIsLoading: setIsStakeLoading,
            setStakeInfo,
            setError: (err) => {
              if (err) console.error("获取质押信息失败:", err);
            }
          }
        );
        
        // 如果刷新后获取到质押信息，使用它；否则使用临时信息
        const stakeInfoToUse = stakeInfo || tempStakeInfo;
        
        // 调用unstakeGusdt函数
        await unstakeGusdt(
          suiClient as any,
          currentAccount.address,
          actualUnstakeAmount,
          stakeInfoToUse,
          unstakeAmountValue,
          signAndExecuteTransaction,
          callbacks
        );
      } catch (error) {
        console.error("解质押预处理失败:", error);
        setError(`解质押预处理失败: ${error instanceof Error ? error.message : String(error)}`);
        setIsLoading(false);
      }
      return;
    }

    // 准备回调函数
    const callbacks = {
      setIsLoading,
      setError,
      setSuccessOperation,
      setTransactionId,
      setShowSuccessDialog,
      onSuccess: () => {
        console.log("解质押操作成功，开始刷新数据...");
        // 延迟执行fetchData以确保区块链状态更新
        setTimeout(() => {
          fetchData();
          console.log("数据刷新完成");
        }, 2000);
      }
    };

    // 调用unstakeGusdt函数
    await unstakeGusdt(
      suiClient as any,
      currentAccount.address,
      actualUnstakeAmount,
      stakeInfo,
      unstakeAmountValue,
      signAndExecuteTransaction,
      callbacks
    );
  };

  // 获取显示余额
  const getDisplayBalance = () => {
    if (!currentAccount) {
      return <Text color="yellow">请先连接钱包</Text>;
    }
    
    if (isBalanceLoading) {
      return <div className="spinner-small" />;
    }
    if (balanceError) {
      return <Text color="red">{balanceError}</Text>;
    }
    if (walletBalance === null) {
      return "未知";
    }
    return `${(walletBalance / DECIMAL_MULTIPLIER).toFixed(2)} gUSDT`;
  };

  // 获取显示质押信息
  const getDisplayStakeInfo = () => {
    if (isStakeLoading) {
      return <div className="spinner-small" />;
    }
    if (error) {
      return <Text color="red">{error}</Text>;
    }
    if (!stakeInfo) {
      return "未质押";
    }

    const stakedAmount = stakeInfo.amount / DECIMAL_MULTIPLIER;
    const rewardAmount = stakeInfo.reward / DECIMAL_MULTIPLIER;
    const totalAmount = (stakeInfo.amount + stakeInfo.reward) / DECIMAL_MULTIPLIER;

    return (
      <>
        <Text>质押: {stakedAmount.toFixed(2)} gUSDT</Text>
        <Text>奖励: {rewardAmount.toFixed(2)} gUSDT</Text>
        <Text>总计: {totalAmount.toFixed(2)} gUSDT</Text>
        {/* 调试信息 */}
        {stakeInfo && (
          <Text size="1" style={{ color: '#888' }}>
            对象ID: {stakeInfo.object_id.slice(0, 8)}...
          </Text>
        )}
        {isStakeLoading && <Text size="1" style={{ color: '#888' }}>正在加载质押数据...</Text>}
      </>
    );
  };

  return (
    <div className="container">
      <main className="main">
        <Card className="mainCard">
          <Flex direction="column" gap="4">
            <Heading size="6">gUSDT流动性</Heading>

            {/* 钱包状态显示 */}
            <Card className="statusCard">
              <Flex gap="2" align="center">
                <div className={`wallet-indicator ${currentAccount ? 'connected' : 'disconnected'}`} />
                <Text>
                  {currentAccount 
                    ? `已连接钱包: ${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}` 
                    : "未连接钱包"}
                </Text>
              </Flex>
            </Card>

            {/* 钱包余额和质押信息显示区域 */}
            <Card className="infoCard">
              <Flex direction="column" gap="2">
                <Heading size="4">账户信息</Heading>
                <Flex gap="4" justify="between">
                  <Box>
                    <Text weight="bold">钱包余额:</Text>
                    <Text>{getDisplayBalance()}</Text>
                  </Box>
                  <Box>
                    <Text weight="bold">质押信息:</Text>
                    {getDisplayStakeInfo()}
                    {/* 调试信息 */}
                    {stakeInfo && (
                      <Text size="1" style={{ color: '#888' }}>
                        对象ID: {stakeInfo.object_id.slice(0, 8)}...
                      </Text>
                    )}
                    {isStakeLoading && <Text size="1" style={{ color: '#888' }}>正在加载质押数据...</Text>}
                  </Box>
                  <Flex direction="column" gap="2">
                    <Button onClick={fetchData} disabled={!currentAccount || isLoading}>
                      {isLoading ? <div className="spinner-small" /> : "刷新数据"}
                    </Button>
                    <Button 
                      onClick={async () => {
                        if (currentAccount && suiClient) {
                          setIsStakeLoading(true);
                          console.log("强制重新查询质押信息...");
                          await fetchStakeInfo(
                            suiClient as any, 
                            currentAccount.address, 
                            {
                              setIsLoading: setIsStakeLoading,
                              setStakeInfo,
                              setError
                            }
                          );
                        }
                      }} 
                      disabled={!currentAccount || isStakeLoading}
                      size="1"
                      color="amber"
                    >
                      强制刷新质押
                    </Button>
                  </Flex>
                </Flex>
              </Flex>
            </Card>

            <Separator size="4" />

            <Flex direction="column" gap="3">
              <Heading size="4">铸造gUSDT</Heading>
              <Flex gap="3" align="center">
                <TextField.Root>
                  <TextField.Input
                    placeholder="输入铸造数量"
                    value={mintAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMintAmount(e.target.value)}
                  />
                </TextField.Root>
                <Button onClick={handleMint} disabled={!currentAccount || isLoading}>
                  {isLoading ? <div className="spinner-small" /> : "铸造gUSDT"}
                </Button>
              </Flex>
            </Flex>

            <Separator size="4" />

            <Flex direction="column" gap="3">
              <Heading size="4">质押gUSDT</Heading>
              <Flex gap="3" align="center">
                <TextField.Root>
                  <TextField.Input
                    placeholder="输入质押数量"
                    value={stakeAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStakeAmount(e.target.value)}
                  />
                </TextField.Root>
                <Button onClick={handleStake} disabled={!currentAccount || isLoading}>
                  {isLoading ? <div className="spinner-small" /> : "质押gUSDT"}
                </Button>
              </Flex>
            </Flex>

            <Separator size="4" />

            <Flex direction="column" gap="3">
              <Heading size="4">解质押gUSDT</Heading>
              <Flex gap="3" align="center">
                <TextField.Root>
                  <TextField.Input
                    placeholder="输入解质押数量"
                    value={unstakeAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUnstakeAmount(e.target.value)}
                  />
                </TextField.Root>
                <Button onClick={handleUnstake} disabled={!currentAccount || isLoading}>
                  {isLoading ? <div className="spinner-small" /> : "解质押gUSDT"}
                </Button>
              </Flex>
              {!stakeInfo && currentAccount && (
                <Text size="1" style={{ color: 'orange' }}>
                  未检测到质押信息，但您仍可尝试解质押操作
                </Text>
              )}
            </Flex>

            {error && <Text color="red">{error}</Text>}
          </Flex>
        </Card>
      </main>
      
      {/* 交易成功对话框 */}
      <TransactionDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        transactionId={transactionId}
        operation={successOperation}
      />

      <style>{`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .main {
          padding: 2rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          width: 100%;
        }
        .mainCard {
          width: 100%;
          max-width: 800px;
          padding: 1.5rem;
        }
        .infoCard, .statusCard {
          padding: 1rem;
          background-color: var(--accent-2);
          margin-bottom: 1rem;
        }
        .wallet-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .connected {
          background-color: #10b981;
        }
        .disconnected {
          background-color: #ef4444;
        }
        .spinner-small {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          border-top-color: #3B82F6;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
