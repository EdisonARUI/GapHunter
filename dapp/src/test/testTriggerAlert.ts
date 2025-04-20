import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/sui.js/utils';

// 替换为你的私钥（仅用于测试）
const PRIVATE_KEY = "1qpkq47hpprytkvlg6nccl037jslkedrqhpylx969hnafh9p6hf4vxphytvq";
// 测试网RPC
const RPC_URL = "https://fullnode.testnet.sui.io";

// 常量定义 - 需要替换成你的实际地址
const PACKAGE_ID = "0x28fba8eacff689870615901a5204b7758ffe71835808f8fbaac494f35d225e38";
// 填入你要测试的TaskConfig对象ID
const TASK_ID = "0xc9b9c4e4ce1f45ace9f8c8eccb92580a0085e0d376c448cf18aa17553cdc9566";

async function main() {
  try {
    // 初始化客户端和密钥对
    const keypair = Ed25519Keypair.fromSecretKey(fromB64(PRIVATE_KEY));
    const client = new SuiClient({
      url: RPC_URL,
    });

    console.log("使用地址:", keypair.toSuiAddress());

    // 创建交易
    const tx = new TransactionBlock();

    // 计算价格差异（以基点表示）
    // 例如：假设你的阈值是0.2%，则传入的值应该至少为20（基点）
    // 这里传入30，表示0.3%的差异，大于0.2%的阈值
    const priceSpread = 30;

    // 调用trigger_price_alert函数 - 你可以在这里调整价格差异值
    tx.moveCall({
      target: `${PACKAGE_ID}::gaphunter::trigger_price_alert`,
      arguments: [
        tx.object(TASK_ID),
        tx.pure(priceSpread),
      ],
    });

    console.log("提交触发价格警报交易...");
    const result = await client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("交易结果:", JSON.stringify(result, null, 2));

    // 检查事件
    if (result.events && result.events.length > 0) {
      console.log("触发的事件:");
      result.events.forEach((event, index) => {
        console.log(`事件 ${index + 1}:`, event);
        if (event.type.includes("PriceAlertEvent")) {
          console.log("触发了价格警报事件!");
          console.log("是否异常价格:", (event.parsedJson as any)?.is_abnormal);
        }
      });
    } else {
      console.log("没有事件被触发");
    }

    console.log("交易状态:", result.effects?.status?.status);
  } catch (error) {
    console.error("执行失败:", error);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
}); 