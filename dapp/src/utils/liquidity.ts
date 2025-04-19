import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { SuiClient } from '@mysten/sui.js/client';
import {
  TESTNET_COUNTER_PACKAGE_ID,
  TREASURY_CAP_ID,
  LIQUIDITY_POOL_ID,
  CLOCK_ID
} from '../constants';

// gUSDT的精度，定义在智能合约中为6位小数
export const TOKEN_DECIMALS = 6;
export const DECIMAL_MULTIPLIER = 10 ** TOKEN_DECIMALS;

// 定义质押信息接口
export interface StakeInfo {
  amount: number;
  reward: number;
  object_id: string;
}

// 回调函数接口
interface Callbacks {
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessOperation: (operation: string) => void;
  setTransactionId: (id: string) => void;
  setShowSuccessDialog: (show: boolean) => void;
  onSuccess?: () => void;
}

// 合约地址和包ID - 使用constants.ts中定义的值
const PACKAGE_ID = TESTNET_COUNTER_PACKAGE_ID;
// Sui上的代币类型需要使用完整路径
const MYCOIN_ID = `${PACKAGE_ID}::mycoin::MYCOIN`;

// 创建错误回调接口
interface ErrorCallback {
  setError: (error: string | null) => void;
}

// 创建钱包余额回调接口
interface WalletBalanceCallbacks extends ErrorCallback {
  setIsLoading: (isLoading: boolean) => void;
  setWalletBalance: (balance: number | null) => void;
}

// 创建质押信息回调接口
interface StakeInfoCallbacks extends ErrorCallback {
  setIsLoading: (isLoading: boolean) => void;
  setStakeInfo: (stakeInfo: StakeInfo | null) => void;
}

// 创建交易回调接口
interface TransactionCallbacks extends ErrorCallback {
  setIsLoading: (isLoading: boolean) => void;
  setSuccessOperation: (operation: string) => void;
  setTransactionId: (id: string) => void;
  setShowSuccessDialog: (show: boolean) => void;
  onSuccess?: () => void;
}

/**
 * 获取钱包余额
 */
export async function fetchWalletBalance(
  suiClient: SuiClient,
  address: string,
  callbacks: WalletBalanceCallbacks
) {
  const { setIsLoading, setWalletBalance, setError } = callbacks;
  
  try {
    setIsLoading(true);
    setError(null);

    // 检查地址是否有效
    if (!address) {
      throw new Error("钱包地址无效");
    }

    // 适配 @mysten/sui 1.26.1 版本的API调用
    try {
      // 兼容1.26.1版本的API
      const coins = await suiClient.getCoins({
        owner: address,
        coinType: MYCOIN_ID
      });
      
      // 计算所有代币的总余额
      let totalBalance = 0;
      if (coins && coins.data && Array.isArray(coins.data)) {
        for (const coin of coins.data) {
          if (coin.balance) {
            totalBalance += parseInt(coin.balance);
          }
        }
      }
      
      setWalletBalance(totalBalance);
    } catch (err: any) {
      // 处理常见错误
      if (typeof err === 'object' && err !== null) {
        if (err.message && typeof err.message === 'string') {
          if (err.message.includes("No coins for owner") || 
              err.message.includes("No coin") || 
              err.message.includes("not found")) {
            setWalletBalance(0);
            return;
          }
        }
      }
      
      // 尝试备用方法获取余额
      try {
        const objects = await suiClient.getOwnedObjects({
          owner: address,
          filter: { StructType: MYCOIN_ID },
          options: { showContent: true }
        });
        
        let balance = 0;
        if (objects && objects.data && Array.isArray(objects.data)) {
          for (const obj of objects.data) {
            // 安全地访问可能的字段
            try {
              if (obj.data?.content) {
                const content = obj.data.content;
                if (content.dataType === 'moveObject' && content.fields) {
                  const fields = content.fields as any;
                  if (fields.balance) {
                    balance += parseInt(String(fields.balance));
                  }
                }
              }
            } catch (e) {
              // 忽略单个对象解析错误
            }
          }
        }
        
        setWalletBalance(balance);
      } catch (backupErr) {
        throw err; // 抛出原始错误
      }
    }
  } catch (error: any) {
    setError(`获取钱包余额失败: ${error.message || JSON.stringify(error)}`);
    setWalletBalance(null);
  } finally {
    setIsLoading(false);
  }
}

/**
 * 获取质押信息
 */
export async function fetchStakeInfo(
  suiClient: SuiClient,
  address: string,
  callbacks: StakeInfoCallbacks
) {
  const { setIsLoading, setStakeInfo, setError } = callbacks;
  
  try {
    setIsLoading(true);
    setError(null);

    // 检查地址是否有效
    if (!address) {
      throw new Error("钱包地址无效");
    }

    try {
      // 直接获取流动性池对象
      const liquidityPoolResponse = await suiClient.getObject({
        id: LIQUIDITY_POOL_ID,
        options: {
          showContent: true,
          showDisplay: true,
          showOwner: true
        }
      });
      
      if (!liquidityPoolResponse.data) {
        setStakeInfo(null);
        return;
      }
      
      // 创建一个交易区块以查看流动性池中的质押信息
      const tx = new TransactionBlock();
      
      // 调用 get_stake_info 函数
      const stakeInfoCall = tx.moveCall({
        target: `${PACKAGE_ID}::liquidity::get_stake_info`,
        arguments: [
          tx.object(LIQUIDITY_POOL_ID),
          tx.pure(address),
          tx.object(CLOCK_ID)
        ],
        typeArguments: []
      });
      
      // 设置交易为只读模式
      tx.setGasBudget(10000000);
      
      try {
        // 使用devInspectTransactionBlock模拟执行查询
        const simulateResult = await suiClient.devInspectTransactionBlock({
          sender: address,
          transactionBlock: tx.serialize()
        });
        
        if (simulateResult && simulateResult.results && simulateResult.results.length > 0) {
          const result = simulateResult.results[0];
          if (result.returnValues && result.returnValues.length >= 2) {
            // 解析返回的质押金额和奖励
            let amount = 0;
            let reward = 0;
            
            try {
              if (Array.isArray(result.returnValues[0]) && result.returnValues[0][0]) {
                amount = parseInt(String(result.returnValues[0][0]));
              }
              
              if (Array.isArray(result.returnValues[1]) && result.returnValues[1][0]) {
                reward = parseInt(String(result.returnValues[1][0]));
              }
              
              // 如果用户没有质押记录，返回null
              if (amount === 0 && reward === 0) {
                setStakeInfo(null);
                return;
              }
              
              // 构建质押信息
              const stakeInfo: StakeInfo = {
                amount: amount,
                reward: reward,
                object_id: "in-pool" // 质押信息存储在流动性池中
              };
              
              setStakeInfo(stakeInfo);
              return;
            } catch (parseError) {
              // 解析返回值出错
              setError("解析质押信息失败");
              setStakeInfo(null);
              return;
            }
          }
        }
        
        // 如果没有返回值，则用户没有质押
        setStakeInfo(null);
      } catch (simulateError: any) {
        // 如果模拟交易失败，尝试另一种方法
        
        // 直接查询流动性池中的质押表
        try {
          // 获取流动性池共享对象的完整内容
          const poolObject = await suiClient.getObject({
            id: LIQUIDITY_POOL_ID,
            options: {
              showContent: true,
              showOwner: true,
              showDisplay: true
            }
          });
          
          if (!poolObject.data || !poolObject.data.content) {
            setStakeInfo(null);
            return;
          }
          
          // 尝试分析流动性池对象的stakes表
          if (poolObject.data.content.dataType === 'moveObject') {
            const poolFields = poolObject.data.content.fields as Record<string, any>;
            
            if (poolFields.stakes && poolFields.stakes.fields && poolFields.stakes.fields.id) {
              const tableId = poolFields.stakes.fields.id.id;
              
              // 查询动态字段，找到用户的质押信息
              const dynamicFields = await suiClient.getDynamicFields({
                parentId: tableId
              });
              
              if (dynamicFields.data && dynamicFields.data.length > 0) {
                // 查找当前用户的质押记录
                const userStakeField = dynamicFields.data.find(field => 
                  field.name && typeof field.name === 'object' && 'value' in field.name && field.name.value === address
                );
                
                if (userStakeField) {
                  // 找到用户记录，获取详细信息
                  const stakeObjectResponse = await suiClient.getObject({
                    id: userStakeField.objectId,
                    options: { showContent: true }
                  });
                  
                  if (stakeObjectResponse.data && stakeObjectResponse.data.content) {
                    const content = stakeObjectResponse.data.content;
                    if (content.dataType === 'moveObject') {
                      const stakeFields = content.fields as Record<string, any>;
                      
                      // 提取质押金额
                      let amount = 0;
                      if (stakeFields.value && stakeFields.value.fields && stakeFields.value.fields.amount) {
                        amount = parseInt(stakeFields.value.fields.amount);
                      }
                      
                      // 创建质押信息对象
                      const stakeInfo: StakeInfo = {
                        amount: amount,
                        reward: 0, // 这里无法准确计算奖励，设为0
                        object_id: userStakeField.objectId
                      };
                      
                      setStakeInfo(stakeInfo);
                      return;
                    }
                  }
                }
              }
            }
          }
          
          // 如果以上都失败，则没有找到质押信息
          setStakeInfo(null);
        } catch (fallbackError) {
          // 如果备用方法也失败，设置为null
          setStakeInfo(null);
        }
      }
    } catch (error: any) {
      setError(`获取质押信息失败: ${error.message || JSON.stringify(error)}`);
      setStakeInfo(null);
    }
  } catch (outerError: any) {
    setError(`获取质押信息失败: ${outerError.message || JSON.stringify(outerError)}`);
    setStakeInfo(null);
  } finally {
    setIsLoading(false);
  }
}

/**
 * 铸造gUSDT代币
 */
export async function mintGusdt(
  suiClient: SuiClient,
  address: string,
  amount: number,
  displayAmount: number,
  signAndExecuteTransaction: any,
  callbacks: TransactionCallbacks
) {
  const { setIsLoading, setError, setSuccessOperation, setTransactionId, setShowSuccessDialog, onSuccess } = callbacks;
  
  try {
    setIsLoading(true);
    setError(null);

    // 创建一个交易区块
    const tx = new TransactionBlock();
    
    // 从constants.ts中引入TreasuryCap对象ID
    const treasuryCapId = TREASURY_CAP_ID;
    
    // 调用铸造函数，正确传入所有必需参数
    // mint(cap: &mut TreasuryCap<MYCOIN>, value: u64, receiver: address, ctx: &mut TxContext)
    tx.moveCall({
      target: `${PACKAGE_ID}::mycoin::mint`,
      arguments: [
        tx.object(treasuryCapId),  // 铸造权限对象
        tx.pure(amount),           // 铸造数量
        tx.pure(address)           // 接收者地址
      ],
    });

    // 序列化交易区块
    const txJSON = tx.serialize();

    // 执行交易
    signAndExecuteTransaction({
      transaction: txJSON as any,
    }, {
      onSuccess: (data: any) => {
        if (data && data.digest) {
          setSuccessOperation(`铸造 ${displayAmount} gUSDT`);
          setTransactionId(data.digest);
          setShowSuccessDialog(true);
          if (onSuccess) onSuccess();
        }
        setIsLoading(false);
      },
      onError: (err: any) => {
        setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    });
  } catch (error: any) {
    setError(`铸造gUSDT失败: ${error.message || JSON.stringify(error)}`);
    setIsLoading(false);
  }
}

/**
 * 质押gUSDT代币
 */
export async function stakeGusdt(
  suiClient: SuiClient,
  address: string,
  amount: number,
  walletBalance: number,
  displayAmount: number,
  displayBalance: number,
  signAndExecuteTransaction: any,
  callbacks: TransactionCallbacks
) {
  const { setIsLoading, setError, setSuccessOperation, setTransactionId, setShowSuccessDialog, onSuccess } = callbacks;
  
  try {
    setIsLoading(true);
    setError(null);

    // 检查余额是否足够
    if (walletBalance < amount) {
      setError(`钱包余额不足。您有 ${displayBalance} gUSDT，但尝试质押 ${displayAmount} gUSDT`);
      setIsLoading(false);
      return;
    }

    // 首先获取用户的MYCOIN代币
    try {
      const coinsResponse = await suiClient.getCoins({
        owner: address,
        coinType: MYCOIN_ID
      });
      
      if (!coinsResponse.data || coinsResponse.data.length === 0) {
        throw new Error("未找到gUSDT代币");
      }
      
      // 创建一个交易区块
      const tx = new TransactionBlock();
      
      // 从constants.ts获取必要的对象ID
      const liquidityPoolId = LIQUIDITY_POOL_ID;
      const clockId = CLOCK_ID;
      
      // 找出足够金额的代币
      let selectedCoins = [];
      let totalAmount = 0;
      
      for (const coin of coinsResponse.data) {
        selectedCoins.push(coin.coinObjectId);
        totalAmount += parseInt(coin.balance);
        
        if (totalAmount >= amount) {
          break;
        }
      }
      
      if (totalAmount < amount) {
        throw new Error(`代币余额不足。需要 ${amount}，但只找到 ${totalAmount}`);
      }
      
      // 处理用户的代币
      let coinToUse;
      
      if (selectedCoins.length === 1) {
        // 只有一个代币对象
        coinToUse = tx.object(selectedCoins[0]);
      } else {
        // 多个代币需要合并
        const primaryCoin = selectedCoins[0];
        const mergeCoins = selectedCoins.slice(1);
        
        // 首先将代币合并成一个
        const primaryCoinObject = tx.object(primaryCoin);
        
        if (mergeCoins.length > 0) {
          tx.mergeCoins(
            primaryCoinObject,
            mergeCoins.map(coinId => tx.object(coinId))
          );
        }
        
        coinToUse = primaryCoinObject;
      }
      
      // 如果需要的金额小于代币总额，需要拆分
      if (amount < totalAmount) {
        const [stakeCoin, remainingCoin] = tx.splitCoins(coinToUse, [tx.pure(amount)]);
        coinToUse = stakeCoin;
      }
      
      // 调用质押函数，正确传入所有必需参数
      // stake(pool: &mut LiquidityPool, coin_in: Coin<MYCOIN>, clock: &Clock, ctx: &mut TxContext)
      tx.moveCall({
        target: `${PACKAGE_ID}::liquidity::stake`,
        arguments: [
          tx.object(liquidityPoolId),  // 流动性池对象
          coinToUse,                   // 输入的代币
          tx.object(clockId)           // 时钟对象
        ],
      });

      // 序列化交易区块
      const txJSON = tx.serialize();

      // 执行交易
      signAndExecuteTransaction({
        transaction: txJSON as any,
      }, {
        onSuccess: (data: any) => {
          if (data && data.digest) {
            setSuccessOperation(`质押 ${displayAmount} gUSDT`);
            setTransactionId(data.digest);
            setShowSuccessDialog(true);
            if (onSuccess) onSuccess();
          }
          setIsLoading(false);
        },
        onError: (err: any) => {
          setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      });
    } catch (coinError: any) {
      setError(`获取或处理代币错误: ${coinError.message || JSON.stringify(coinError)}`);
      setIsLoading(false);
    }
  } catch (error: any) {
    setError(`质押gUSDT失败: ${error.message || JSON.stringify(error)}`);
    setIsLoading(false);
  }
}

/**
 * 解质押gUSDT代币
 */
export async function unstakeGusdt(
  suiClient: SuiClient,
  address: string,
  amount: number,
  stakeInfo: StakeInfo,
  displayAmount: number,
  signAndExecuteTransaction: any,
  callbacks: TransactionCallbacks
) {
  const { setIsLoading, setError, setSuccessOperation, setTransactionId, setShowSuccessDialog, onSuccess } = callbacks;
  
  try {
    setIsLoading(true);
    setError(null);

    // 如果object_id是unknown，尝试查找真实的StakeInfo对象
    if (stakeInfo.object_id === "unknown") {
      try {
        // 查找用户拥有的质押对象
        const { data: objects } = await suiClient.getOwnedObjects({
          owner: address,
          options: {
            showContent: true,
            showType: true
          },
          filter: {
            StructType: `${PACKAGE_ID}::liquidity::StakeInfo`
          }
        });
      } catch (findError: any) {
        // 不影响主流程，继续执行
      }
    }

    // 检查质押金额是否足够
    if (stakeInfo.amount < amount) {
      // 继续尝试解质押，让智能合约进行最终验证
    }

    // 创建一个交易区块
    const tx = new TransactionBlock();
    
    // 从constants.ts获取必要的对象ID
    const liquidityPoolId = LIQUIDITY_POOL_ID;
    const clockId = CLOCK_ID;
    
    // 调用解质押函数，正确传入必要参数
    // unstake(pool: &mut LiquidityPool, amount: u64, clock: &Clock, ctx: &mut TxContext)
    tx.moveCall({
      target: `${PACKAGE_ID}::liquidity::unstake`,
      arguments: [
        tx.object(liquidityPoolId),  // 流动性池对象
        tx.pure(amount),             // 解质押数量
        tx.object(clockId)           // 时钟对象
      ]
    });

    // 序列化交易区块
    const txJSON = tx.serialize();

    // 执行交易
    signAndExecuteTransaction({
      transaction: txJSON as any,
    }, {
      onSuccess: (data: any) => {
        if (data && data.digest) {
          setSuccessOperation(`解质押 ${displayAmount} gUSDT`);
          setTransactionId(data.digest);
          setShowSuccessDialog(true);
          if (onSuccess) onSuccess();
        }
        setIsLoading(false);
      },
      onError: (err: any) => {
        setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    });
  } catch (error: any) {
    setError(`解质押gUSDT失败: ${error.message || JSON.stringify(error)}`);
    setIsLoading(false);
  }
}

/**
 * 查询用户最近的交易以辅助调试
 */
export async function queryRecentTransactions(
  suiClient: SuiClient,
  address: string
) {
  try {
    // 获取用户最近的交易
    const transactions = await suiClient.queryTransactionBlocks({
      filter: {
        FromAddress: address
      },
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true
      },
      limit: 5
    });
    
    return transactions.data;
  } catch (error) {
    return [];
  }
} 