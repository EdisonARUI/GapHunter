import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useSuiClient } from "@mysten/dapp-kit";
import { Text, Button, Card, Flex, Heading, Separator, Box, TextField, Badge } from "@radix-ui/themes";
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
import { ReloadIcon, ArrowRightIcon, PlusIcon, MinusIcon } from "@radix-ui/react-icons";

// 设计系统常量
const COLORS = {
  background: "#121212",
  cardBg: "#1A1A1A",
  cardBgAlt: "#262626",
  accentBlue: "#3B82F6",
  error: "#DC2626",
  warning: "#CA8A04",
  success: "#22C55E",
  text: {
    primary: "#FFFFFF",
    secondary: "#E2E8F0",
    tertiary: "#94A3B8",
    muted: "#CBD5E1"
  },
  border: "#333333"
};

// 设计系统间距
const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px"
};

// 设计系统布局样式
const styles = {
  container: {
    backgroundColor: COLORS.background,
    minHeight: "calc(100vh - 60px)",
    padding: SPACING.lg,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center"
  },
  mainCard: {
    backgroundColor: COLORS.cardBg,
    maxWidth: "800px",
    width: "100%",
    borderRadius: "8px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    padding: SPACING.lg
  },
  sectionCard: {
    backgroundColor: COLORS.cardBgAlt,
    padding: SPACING.md,
    borderRadius: "6px",
    marginBottom: SPACING.md
  },
  formGroup: {
    display: "flex",
    gap: SPACING.md,
    alignItems: "center",
    marginBottom: SPACING.md
  },
  input: {
    backgroundColor: "#2D2D2D",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.text.primary,
    borderRadius: "4px",
    padding: `${SPACING.sm} ${SPACING.md}`,
    width: "100%"
  },
  actionButton: {
    backgroundColor: COLORS.accentBlue,
    color: COLORS.text.primary,
    border: "none",
    borderRadius: "6px",
    padding: `${SPACING.sm} ${SPACING.md}`,
    cursor: "pointer",
    transition: "background-color 0.2s",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    fontSize: "14px",
    fontWeight: 500
  },
  button: {
    minWidth: "120px",
    height: "36px",
    padding: `${SPACING.xs} ${SPACING.md}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs
  },
  sectionHeading: {
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    fontSize: "18px",
    fontWeight: 500
  },
  pageHeading: {
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
    fontSize: "24px",
    fontWeight: 700
  },
  labelText: {
    color: COLORS.text.secondary,
    fontWeight: 500,
    fontSize: "14px",
    marginBottom: SPACING.xs
  },
  valueText: {
    color: COLORS.text.primary,
    fontSize: "16px"
  },
  infoGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: SPACING.xs
  },
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: `2px solid rgba(255, 255, 255, 0.2)`,
    borderRadius: "50%",
    borderTop: `2px solid ${COLORS.text.primary}`,
    animation: "spin 1s linear infinite"
  },
  walletIndicator: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    marginRight: SPACING.sm
  },
  divider: {
    height: "1px",
    backgroundColor: COLORS.border,
    width: "100%",
    margin: `${SPACING.md} 0`
  },
  errorText: {
    color: COLORS.error,
    marginTop: SPACING.md,
    fontSize: "14px",
    padding: SPACING.sm,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderRadius: "4px",
    borderLeft: `4px solid ${COLORS.error}`
  },
  infoCard: {
    backgroundColor: "#262626",
    borderRadius: "6px",
    padding: SPACING.md,
    marginBottom: SPACING.md
  },
  amountDisplay: {
    fontFamily: "monospace",
    fontSize: "16px",
    fontWeight: 500,
    color: COLORS.text.primary
  },
  statusBadge: {
    padding: `${SPACING.xs} ${SPACING.sm}`,
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center"
  }
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
      return;
    }

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
      setError(`Failed to fetch data: ${err.message || JSON.stringify(err)}`);
    }
  };

  // 当钱包连接或改变时获取数据
  useEffect(() => {
    if (currentAccount) {
      fetchData();
    } else {
      // 清除数据
      setWalletBalance(null);
      setStakeInfo(null);
    }
  }, [currentAccount, suiClient]);

  // 处理Mint操作
  const handleMint = async () => {
    if (!currentAccount || !suiClient) {
      setError("Please connect wallet first");
      return;
    }

    const mintAmountValue = parseFloat(mintAmount);
    if (isNaN(mintAmountValue) || mintAmountValue <= 0) {
      setError("Please enter a valid mint amount");
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
        // 延迟执行fetchData以确保区块链状态更新
        setTimeout(() => {
          fetchData();
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
      setError("Please connect wallet first");
      return;
    }

    const stakeAmountValue = parseFloat(stakeAmount);
    if (isNaN(stakeAmountValue) || stakeAmountValue <= 0) {
      setError("Please enter a valid stake amount");
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
        // 延迟执行fetchData以确保区块链状态更新
        setTimeout(async () => {
          await fetchData();
          // 再次延迟检查，确保区块链状态已更新
          setTimeout(async () => {
            if (!stakeInfo && currentAccount && suiClient) {
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
      setError("Please connect wallet first");
      return;
    }

    const unstakeAmountValue = parseFloat(unstakeAmount);
    if (isNaN(unstakeAmountValue) || unstakeAmountValue <= 0) {
      setError("Please enter a valid unstake amount");
      return;
    }

    // 计算真实的解质押数量（考虑精度）
    const actualUnstakeAmount = Math.floor(unstakeAmountValue * DECIMAL_MULTIPLIER);

    // 如果没有质押信息，提示用户但继续尝试
    if (!stakeInfo) {
      // 创建一个临时的stakeInfo对象
      const tempStakeInfo: StakeInfo = {
        amount: actualUnstakeAmount,  // 设置为要解质押的金额
        reward: 0,
        object_id: "unknown"  // 实际上应由后端查找
      };
      
      // 提示用户我们没有质押信息
      setError("No stake information detected, but will attempt to unstake. If it fails, please refresh stake data and try again.");
      
      // 准备回调函数
      const callbacks = {
        setIsLoading,
        setError,
        setSuccessOperation,
        setTransactionId,
        setShowSuccessDialog,
        onSuccess: () => {
          // 延迟执行fetchData以确保区块链状态更新
          setTimeout(() => {
            fetchData();
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
              if (err) console.error("Failed to get stake info:", err);
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
        setError(`Unstake preprocessing failed: ${error instanceof Error ? error.message : String(error)}`);
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
        // 延迟执行fetchData以确保区块链状态更新
        setTimeout(() => {
          fetchData();
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

  // 渲染钱包状态
  const renderWalletStatus = () => {
    return (
      <Flex 
        justify="between" 
        align="center" 
        style={{ 
          backgroundColor: COLORS.cardBgAlt, 
          padding: SPACING.md, 
          borderRadius: "6px", 
          marginBottom: SPACING.md 
        }}
      >
        <Flex align="center" gap="2">
          <div 
            style={{ 
              ...styles.walletIndicator, 
              backgroundColor: currentAccount ? COLORS.success : COLORS.error 
            }} 
          />
          <Text size="2" style={{ color: COLORS.text.secondary }}>
            {currentAccount 
              ? `Connected: ${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}` 
              : "Wallet Not Connected"}
          </Text>
        </Flex>
        
        <Button 
          size="2" 
          color="blue"
          onClick={fetchData} 
          disabled={!currentAccount || isLoading}
          style={styles.button}
        >
          <ReloadIcon />
          Refresh Data
        </Button>
      </Flex>
    );
  };

  // 渲染账户信息
  const renderAccountInfo = () => {
    // 钱包余额显示
    const renderBalance = () => {
      if (!currentAccount) {
        return <Badge color="yellow">Please connect wallet</Badge>;
      }
      
      if (isBalanceLoading) {
        return <span style={{ display: "inline-block", width: "16px", height: "16px" }} className="spinner" />;
      }
      
      if (balanceError) {
        return <Badge color="red">{balanceError}</Badge>;
      }
      
      if (walletBalance === null) {
        return <Badge color="gray">Unknown</Badge>;
      }
      
      return (
        <Text style={styles.amountDisplay}>
          {(walletBalance / DECIMAL_MULTIPLIER).toFixed(2)} gUSDT
        </Text>
      );
    };

    // 质押信息显示
    const renderStakeInfo = () => {
      if (isStakeLoading) {
        return <span style={{ display: "inline-block", width: "16px", height: "16px" }} className="spinner" />;
      }
      
      if (error && error.includes("stake info")) {
        return <Badge color="red">Failed to fetch</Badge>;
      }
      
      if (!stakeInfo) {
        return <Badge color="gray">No Stake</Badge>;
      }

      const stakedAmount = stakeInfo.amount / DECIMAL_MULTIPLIER;
      const rewardAmount = stakeInfo.reward / DECIMAL_MULTIPLIER;
      const totalAmount = (stakeInfo.amount + stakeInfo.reward) / DECIMAL_MULTIPLIER;

      return (
        <Flex direction="column" gap="1">
          <Text style={styles.amountDisplay}>
            {totalAmount.toFixed(2)} gUSDT
          </Text>
          <Flex direction="column" gap="1">
            <Text size="1" style={{ color: COLORS.text.tertiary }}>
              Principal: {stakedAmount.toFixed(2)} gUSDT
            </Text>
            <Text size="1" style={{ color: COLORS.text.tertiary }}>
              Reward: {rewardAmount.toFixed(2)} gUSDT
            </Text>
          </Flex>
        </Flex>
      );
    };

    return (
      <Card style={styles.sectionCard}>
        <Heading size="3" style={{ marginBottom: SPACING.md, color: COLORS.text.secondary }}>
          Account Info
        </Heading>
        <Flex justify="between" wrap="wrap" gap="4">
          <Box style={styles.infoGroup}>
            <Text size="2" style={{ color: COLORS.text.tertiary, marginBottom: SPACING.xs }}>
              Wallet Balance
            </Text>
            {renderBalance()}
          </Box>
          
          <Box style={styles.infoGroup}>
            <Text size="2" style={{ color: COLORS.text.tertiary, marginBottom: SPACING.xs }}>
              Total Staked
            </Text>
            {renderStakeInfo()}
          </Box>
        </Flex>
      </Card>
    );
  };

  // 渲染铸造部分
  const renderMintSection = () => {
    return (
      <Card style={styles.sectionCard}>
        <Heading size="3" style={{ marginBottom: SPACING.md, color: COLORS.text.secondary }}>
          Mint gUSDT
        </Heading>
        <Flex align="end" gap="3">
          <Box style={{ flex: 1 }}>
            <Text size="2" style={{ color: COLORS.text.tertiary, marginBottom: SPACING.xs }}>
              Mint Amount
            </Text>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter amount"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
            />
          </Box>
          <Button 
            size="2"
            color="blue"
            onClick={handleMint} 
            disabled={!currentAccount || isLoading}
            style={styles.button}
          >
            <PlusIcon />
            Mint
          </Button>
        </Flex>
      </Card>
    );
  };

  // 渲染质押部分
  const renderStakeSection = () => {
    return (
      <Card style={styles.sectionCard}>
        <Heading size="3" style={{ marginBottom: SPACING.md, color: COLORS.text.secondary }}>
          Stake gUSDT
        </Heading>
        <Flex align="end" gap="3">
          <Box style={{ flex: 1 }}>
            <Text size="2" style={{ color: COLORS.text.tertiary, marginBottom: SPACING.xs }}>
              Stake Amount
            </Text>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter amount"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />
          </Box>
          <Button 
            size="2"
            color="blue"
            onClick={handleStake} 
            disabled={!currentAccount || isLoading}
            style={styles.button}
          >
            <ArrowRightIcon />
            Stake
          </Button>
        </Flex>
      </Card>
    );
  };

  // 渲染解质押部分
  const renderUnstakeSection = () => {
    return (
      <Card style={styles.sectionCard}>
        <Heading size="3" style={{ marginBottom: SPACING.md, color: COLORS.text.secondary }}>
          Unstake gUSDT
        </Heading>
        <Flex align="end" gap="3">
          <Box style={{ flex: 1 }}>
            <Text size="2" style={{ color: COLORS.text.tertiary, marginBottom: SPACING.xs }}>
              Unstake Amount
            </Text>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter amount"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
            />
          </Box>
          <Button 
            size="2"
            color="blue"
            onClick={handleUnstake} 
            disabled={!currentAccount || isLoading}
            style={styles.button}
          >
            <MinusIcon />
            Unstake
          </Button>
        </Flex>
        
        {!stakeInfo && currentAccount && (
          <Text size="1" style={{ color: COLORS.warning, marginTop: SPACING.sm }}>
            No stake detected, but you can still attempt to unstake
          </Text>
        )}
      </Card>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.mainCard}>
        <Heading size="5" style={styles.pageHeading}>
          Liquidity Management
        </Heading>
        
        {/* 钱包状态显示 */}
        {renderWalletStatus()}
        
        {/* 账户信息显示 */}
        {renderAccountInfo()}
        
        {/* 操作部分 */}
        {renderMintSection()}
        {renderStakeSection()}
        {renderUnstakeSection()}
        
        {/* 错误提示 */}
        {error && !error.includes("stake info") && (
          <div style={styles.errorText}>
            {error}
          </div>
        )}
      </div>
      
      {/* 交易成功对话框 */}
      <TransactionDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        transactionId={transactionId}
        operation={successOperation}
      />
      
      {/* 全局样式 */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .spinner {
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            border-top: 2px solid #3B82F6;
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
}
