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

    console.log("查询代币类型:", MYCOIN_ID);
    console.log("钱包地址:", address);

    // 适配 @mysten/sui 1.26.1 版本的API调用
    try {
      // 兼容1.26.1版本的API
      const coins = await suiClient.getCoins({
        owner: address,
        coinType: MYCOIN_ID
      });
      
      console.log("获取到的代币:", coins);
      
      // 计算所有代币的总余额
      let totalBalance = 0;
      if (coins && coins.data && Array.isArray(coins.data)) {
        for (const coin of coins.data) {
          if (coin.balance) {
            totalBalance += parseInt(coin.balance);
          }
        }
      }
      
      console.log("总余额:", totalBalance);
      setWalletBalance(totalBalance);
    } catch (err: any) {
      console.error("API调用失败:", err);
      console.error("错误详情:", JSON.stringify(err, null, 2));
      
      // 处理常见错误
      if (typeof err === 'object' && err !== null) {
        if (err.message && typeof err.message === 'string') {
          if (err.message.includes("No coins for owner") || 
              err.message.includes("No coin") || 
              err.message.includes("not found")) {
            console.log("用户没有gUSDT代币");
            setWalletBalance(0);
            return;
          }
        }
      }
      
      // 尝试备用方法获取余额
      try {
        console.log("尝试备用方法获取余额...");
        const objects = await suiClient.getOwnedObjects({
          owner: address,
          filter: { StructType: MYCOIN_ID },
          options: { showContent: true }
        });
        
        console.log("获取到的对象:", objects);
        
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
              console.error("解析对象失败:", e);
            }
          }
        }
        
        console.log("通过对象查询的余额:", balance);
        setWalletBalance(balance);
      } catch (backupErr) {
        console.error("备用方法也失败:", backupErr);
        throw err; // 抛出原始错误
      }
    }
  } catch (error: any) {
    console.error("获取钱包余额失败:", error);
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

    console.log("[DEBUG] 开始查询质押信息，地址:", address);
    console.log("[DEBUG] 当前包ID:", PACKAGE_ID);
    console.log("[DEBUG] 完整的结构类型:", `${PACKAGE_ID}::liquidity::StakeInfo`);

    // 第一种方法：直接查询质押对象
    try {
      console.log("[方法1] 尝试直接使用StructType过滤查询质押对象...");
      const ownedObjectsResponse = await suiClient.getOwnedObjects({
        owner: address,
        options: {
          showContent: true,
          showType: true
        },
        filter: {
          StructType: `${PACKAGE_ID}::liquidity::StakeInfo`
        }
      });

      console.log("[方法1] 查询结果数量:", ownedObjectsResponse.data?.length || 0);
      
      if (ownedObjectsResponse.data && ownedObjectsResponse.data.length > 0) {
        console.log("[方法1] 找到质押对象!");
        return processStakeObject(ownedObjectsResponse.data[0], setStakeInfo);
      } else {
        console.log("[方法1] 未找到质押对象，尝试方法2...");
      }
    } catch (error) {
      console.error("[方法1] 失败:", error);
      console.log("[方法1] 尝试方法2...");
    }
    
    // 第二种方法：获取所有对象并手动过滤StakeInfo类型
    try {
      console.log("[方法2] 尝试获取所有对象并过滤StakeInfo类型...");
      const allObjects = await suiClient.getOwnedObjects({
        owner: address,
        options: {
          showContent: true,
          showType: true
        }
      });
      
      console.log("[方法2] 获取到对象总数:", allObjects.data?.length || 0);
      
      // 打印所有对象的类型，帮助调试
      allObjects.data?.forEach((obj, index) => {
        try {
          // 安全获取类型信息
          let typeInfo = "未知";
          
          if (obj.data?.content?.dataType === 'moveObject') {
            typeInfo = obj.data.content.type || "未知moveObject类型";
          } else if (obj.data?.content?.dataType === 'package') {
            typeInfo = "package类型";
          }
          
          console.log(`[方法2] 对象${index}类型:`, typeInfo);
        } catch (e) {
          console.log(`[方法2] 无法读取对象${index}类型:`, e);
        }
      });
      
      // 过滤可能的StakeInfo对象
      const stakeObjects = allObjects.data?.filter(obj => {
        try {
          // 检查对象内容数据类型
          if (obj.data?.content?.dataType === 'moveObject') {
            // 安全访问类型属性，使用类型断言
            const contentObj = obj.data.content as any;
            const contentType = contentObj.type || "";
            
            if (contentType && (
              contentType.includes('StakeInfo') || 
              contentType.includes('liquidity::StakeInfo') ||
              contentType.includes(`${PACKAGE_ID}::liquidity::StakeInfo`)
            )) {
              console.log("[方法2] 发现可能的StakeInfo内容对象:", obj.data?.objectId);
              console.log("[方法2] 内容类型:", contentType);
              return true;
            }
          }
          
          return false;
        } catch (e) {
          console.error("[方法2] 过滤对象发生错误:", e);
          return false;
        }
      });
      
      console.log("[方法2] 过滤后发现StakeInfo对象数量:", stakeObjects?.length || 0);
      
      if (stakeObjects && stakeObjects.length > 0) {
        return processStakeObject(stakeObjects[0], setStakeInfo);
      } else {
        console.log("[方法2] 未找到StakeInfo对象，尝试方法3...");
      }
    } catch (error) {
      console.error("[方法2] 失败:", error);
      console.log("[方法2] 尝试方法3...");
    }
    
    // 第三种方法：使用字段检查判断
    try {
      console.log("[方法3] 尝试通过检查字段判断StakeInfo对象...");
      const objects = await suiClient.getOwnedObjects({
        owner: address,
        options: {
          showContent: true,
          showType: true,
          showOwner: true
        }
      });
      
      console.log("[方法3] 获取到对象总数:", objects.data?.length || 0);
      
      for (const obj of objects.data || []) {
        try {
          if (obj.data?.content?.dataType === 'moveObject') {
            const fields = obj.data.content.fields;
            // 打印对象字段，帮助调试
            console.log("[方法3] 检查对象ID:", obj.data.objectId);
            console.log("[方法3] 对象字段:", JSON.stringify(fields));
            
            // 检查是否包含amount和reward字段
            if (fields && 
                ((fields as any).amount !== undefined || (fields as any).reward !== undefined)) {
              console.log("[方法3] 找到包含质押相关字段的对象:", obj.data.objectId);
              return processStakeObject(obj, setStakeInfo);
            }
          }
        } catch (e) {
          console.error("[方法3] 处理对象时出错:", e);
        }
      }
      
      console.log("[方法3] 未找到包含质押字段的对象");
      setStakeInfo(null);
    } catch (error) {
      console.error("[方法3] 失败:", error);
      setStakeInfo(null);
    }
  } catch (error: any) {
    console.error("[总错误] 获取质押信息失败:", error);
    setError(`获取质押信息失败: ${error.message || JSON.stringify(error)}`);
    setStakeInfo(null);
  } finally {
    setIsLoading(false);
  }
}

/**
 * 处理质押对象并提取信息
 */
function processStakeObject(obj: any, setStakeInfo: (info: StakeInfo | null) => void): void {
  try {
    if (!obj.data?.content && !obj.data?.type) {
      console.error("[处理] 对象缺少内容和类型:", obj);
      throw new Error("无法解析质押对象数据");
    }
    
    let fields: any;
    
    // 尝试从不同位置获取字段
    if (obj.data?.content?.fields) {
      console.log("[处理] 从content.fields获取字段");
      fields = obj.data.content.fields;
    } else if (obj.data?.fields) {
      console.log("[处理] 从data.fields获取字段");
      fields = obj.data.fields;
    } else {
      console.error("[处理] 无法找到字段:", obj);
      throw new Error("无法找到质押对象字段");
    }
    
    console.log("[处理] 质押对象字段:", JSON.stringify(fields));
    
    // 提取字段
    let amount = 0;
    let reward = 0;
    
    // 检查并安全提取amount字段值
    if (fields.amount !== undefined) {
      console.log("[处理] 找到amount字段:", fields.amount);
      // 安全转换字段值为数值类型
      if (typeof fields.amount === 'string') {
        amount = parseInt(fields.amount);
      } else if (typeof fields.amount === 'number') {
        amount = fields.amount;
      } else if (typeof fields.amount === 'object' && fields.amount !== null) {
        // 处理可能是BigInt或其他复杂类型的情况
        amount = Number(fields.amount.toString());
      }
    }
    
    // 检查并安全提取reward字段值
    if (fields.reward !== undefined) {
      console.log("[处理] 找到reward字段:", fields.reward);
      // 安全转换字段值为数值类型
      if (typeof fields.reward === 'string') {
        reward = parseInt(fields.reward);
      } else if (typeof fields.reward === 'number') {
        reward = fields.reward;
      } else if (typeof fields.reward === 'object' && fields.reward !== null) {
        // 处理可能是BigInt或其他复杂类型的情况
        reward = Number(fields.reward.toString());
      }
    }
    
    const stakeInfo: StakeInfo = {
      amount: amount,
      reward: reward, 
      object_id: obj.data.objectId
    };
    
    console.log("[处理] 解析后的质押信息:", stakeInfo);
    setStakeInfo(stakeInfo);
  } catch (error) {
    console.error("[处理] 解析质押对象失败:", error);
    throw error;
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
    console.log("使用Treasury Cap ID:", treasuryCapId);
    
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
        console.log("铸造交易成功:", data);
        if (data && data.digest) {
          setSuccessOperation(`铸造 ${displayAmount} gUSDT`);
          setTransactionId(data.digest);
          setShowSuccessDialog(true);
          if (onSuccess) onSuccess();
        } else {
          console.warn("交易执行成功但未返回摘要");
        }
        setIsLoading(false);
      },
      onError: (err: any) => {
        console.error("钱包交互失败:", err);
        setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    });
  } catch (error: any) {
    console.error("铸造gUSDT失败:", error);
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
      
      console.log("用户拥有的MYCOIN代币:", coinsResponse);
      
      if (!coinsResponse.data || coinsResponse.data.length === 0) {
        throw new Error("未找到gUSDT代币");
      }
      
      // 创建一个交易区块
      const tx = new TransactionBlock();
      
      // 从constants.ts获取必要的对象ID
      const liquidityPoolId = LIQUIDITY_POOL_ID;
      const clockId = CLOCK_ID;
      
      console.log("使用流动性池ID:", liquidityPoolId);
      console.log("使用时钟ID:", clockId);
      
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
      
      console.log("选择的代币:", selectedCoins);
      
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
          console.log("质押交易成功:", data);
          if (data && data.digest) {
            setSuccessOperation(`质押 ${displayAmount} gUSDT`);
            setTransactionId(data.digest);
            setShowSuccessDialog(true);
            if (onSuccess) onSuccess();
          } else {
            console.warn("交易执行成功但未返回摘要");
          }
          setIsLoading(false);
        },
        onError: (err: any) => {
          console.error("钱包交互失败:", err);
          setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      });
    } catch (coinError: any) {
      console.error("获取或处理代币错误:", coinError);
      setError(`获取或处理代币错误: ${coinError.message || JSON.stringify(coinError)}`);
      setIsLoading(false);
    }
  } catch (error: any) {
    console.error("质押gUSDT失败:", error);
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
      console.log("尝试查找用户的StakeInfo对象...");
      // 这部分代码不再需要了，因为我们不需要质押对象ID作为参数
      // 但我们仍然进行检查和提示，以便用户了解状态
      
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
        
        if (!objects || objects.length === 0) {
          console.log("未找到质押对象，但不影响解质押操作");
        } else {
          console.log("找到质押对象，继续解质押");
        }
      } catch (findError: any) {
        console.warn("查找质押对象时出现警告:", findError);
        // 不影响主流程，继续执行
      }
    }

    // 检查质押金额是否足够
    if (stakeInfo.amount < amount) {
      console.warn(`质押金额不足。您质押了 ${stakeInfo.amount / DECIMAL_MULTIPLIER} gUSDT，但尝试解质押 ${displayAmount} gUSDT`);
      console.log("继续尝试解质押，让智能合约进行最终验证");
    }

    // 创建一个交易区块
    const tx = new TransactionBlock();
    
    // 从constants.ts获取必要的对象ID
    const liquidityPoolId = LIQUIDITY_POOL_ID;
    const clockId = CLOCK_ID;
    
    console.log("使用流动性池ID:", liquidityPoolId);
    console.log("使用时钟ID:", clockId);
    console.log("解质押数量:", amount);
    
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
        console.log("解质押交易成功:", data);
        if (data && data.digest) {
          setSuccessOperation(`解质押 ${displayAmount} gUSDT`);
          setTransactionId(data.digest);
          setShowSuccessDialog(true);
          if (onSuccess) onSuccess();
        } else {
          console.warn("交易执行成功但未返回摘要");
        }
        setIsLoading(false);
      },
      onError: (err: any) => {
        console.error("钱包交互失败:", err);
        setError(`钱包交互失败: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    });
  } catch (error: any) {
    console.error("解质押gUSDT失败:", error);
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
    console.log("[DEBUG] 查询地址最近交易:", address);
    
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
    
    console.log("[DEBUG] 最近交易数量:", transactions.data.length);
    
    // 分析最近交易以查找质押相关操作
    for (const tx of transactions.data) {
      console.log("[DEBUG] 交易ID:", tx.digest);
      console.log("[DEBUG] 交易时间:", tx.timestampMs ? new Date(Number(tx.timestampMs)).toLocaleString() : "未知");
      
      // 检查交易事件
      if (tx.events && tx.events.length > 0) {
        for (const event of tx.events) {
          if (event && typeof event.type === 'string' && 
              (event.type.includes('stake') || event.type.includes('liquidity'))) {
            console.log("[DEBUG] 发现质押相关事件:", event.type);
            console.log("[DEBUG] 事件详情:", JSON.stringify(event, null, 2));
          }
        }
      }
      
      // 检查交易效果
      if (tx.effects) {
        // 只记录创建和修改的对象ID
        if (tx.effects.created && tx.effects.created.length > 0) {
          console.log("[DEBUG] 交易创建的对象数量:", tx.effects.created.length);
          
          const createdObjectIds = tx.effects.created.map(obj => {
            // 使用类型断言和可选链，安全地访问属性
            const objAny = obj as any;
            return objAny?.objectId || objAny?.reference?.objectId || "未知ID";
          });
          
          console.log("[DEBUG] 交易创建的对象:", createdObjectIds);
        }
        
        if (tx.effects.mutated && tx.effects.mutated.length > 0) {
          console.log("[DEBUG] 交易修改的对象数量:", tx.effects.mutated.length);
          
          const mutatedObjectIds = tx.effects.mutated.map(obj => {
            // 使用类型断言和可选链，安全地访问属性
            const objAny = obj as any;
            return objAny?.objectId || objAny?.reference?.objectId || "未知ID";
          });
          
          console.log("[DEBUG] 交易修改的对象:", mutatedObjectIds);
        }

        // 记录交易状态
        console.log("[DEBUG] 交易状态:", tx.effects.status?.status || "未知");
      }
    }
    
    return transactions.data;
  } catch (error) {
    console.error("[DEBUG] 查询交易失败:", error);
    return [];
  }
} 