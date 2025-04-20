// dapp/src/components/PriceAlertListener.tsx
import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { 
  TESTNET_COUNTER_PACKAGE_ID, 
  LIQUIDITY_POOL_ID, 
  CLOCK_ID 
} from '../constants';

export default function PriceAlertListener() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedEventId, setLastProcessedEventId] = useState<string | null>(null);
  
  // Query current stake information
  const fetchCurrentStakeInfo = useCallback(async () => {
    if (!currentAccount || !suiClient) return null;
    
    try {
      // Use get_stake_info function to get stake information
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${TESTNET_COUNTER_PACKAGE_ID}::liquidity::get_stake_info`,
        arguments: [
          tx.object(LIQUIDITY_POOL_ID),
          tx.pure(currentAccount.address),
          tx.object(CLOCK_ID)
        ],
      });
      
      const simulateResult = await suiClient.devInspectTransactionBlock({
        sender: currentAccount.address,
        transactionBlock: tx.serialize()
      });
      
      if (simulateResult && simulateResult.results && simulateResult.results.length > 0) {
        const result = simulateResult.results[0];
        if (result.returnValues && result.returnValues.length >= 2) {
          let amount = 0;
          
          if (Array.isArray(result.returnValues[0]) && result.returnValues[0].length > 0) {
            amount = parseInt(String(result.returnValues[0][0]));
          }
          
          return amount > 0 ? amount : null;
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to get stake info:", error);
      return null;
    }
  }, [currentAccount, suiClient]);

  // Execute unstake operation
  const executeUnstake = useCallback(async (amount: number) => {
    if (!currentAccount || !suiClient || !signAndExecuteTransaction || amount <= 0) return false;
    
    try {
      console.log(`Unstaking ${amount} gUSDT...`);
      
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${TESTNET_COUNTER_PACKAGE_ID}::liquidity::unstake`,
        arguments: [
          tx.object(LIQUIDITY_POOL_ID),
          tx.pure(amount),
          tx.object(CLOCK_ID)
        ],
      });
      
      // Serialize transaction block
      const txJSON = tx.serialize();
      
      return new Promise((resolve) => {
        signAndExecuteTransaction({
          transaction: txJSON as any,
        }, {
          onSuccess: (data: any) => {
            console.log("Unstake transaction result:", data);
            resolve(data.effects?.status.status === "success");
          },
          onError: (error: any) => {
            console.error("Unstake failed:", error);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error("Unstake failed:", error);
      return false;
    }
  }, [currentAccount, suiClient, signAndExecuteTransaction]);

  // Simulate arbitrage operation (via mint)
  const executeArbitrage = useCallback(async () => {
    if (!currentAccount || !suiClient || !signAndExecuteTransaction) return 0;
    
    try {
      console.log("Executing cross-chain arbitrage operation...");
      
      // Using mint to simulate profit from arbitrage
      // In a production environment, this would implement actual cross-chain arbitrage logic
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${TESTNET_COUNTER_PACKAGE_ID}::mycoin::mint`,
        arguments: [
          tx.pure(10000000), // Simulate earning 10 gUSDT from arbitrage
          tx.pure(currentAccount.address)
        ],
      });
      
      // Serialize transaction block
      const txJSON = tx.serialize();
      
      return new Promise<number>((resolve) => {
        signAndExecuteTransaction({
          transaction: txJSON as any,
        }, {
          onSuccess: (data: any) => {
            console.log("Arbitrage operation result:", data);
            resolve(data.effects?.status.status === "success" ? 10000000 : 0);
          },
          onError: (error: any) => {
            console.error("Arbitrage operation failed:", error);
            resolve(0);
          }
        });
      });
    } catch (error) {
      console.error("Arbitrage operation failed:", error);
      return 0;
    }
  }, [currentAccount, suiClient, signAndExecuteTransaction]);

  // Execute stake operation
  const executeStake = useCallback(async () => {
    if (!currentAccount || !suiClient || !signAndExecuteTransaction) return false;
    
    try {
      console.log("Restaking funds...");
      
      // Get all gUSDT tokens owned by the user
      const coins = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: `${TESTNET_COUNTER_PACKAGE_ID}::mycoin::MYCOIN`
      });
      
      if (!coins.data || coins.data.length === 0) {
        console.log("No gUSDT tokens available");
        return false;
      }
      
      // Calculate total amount
      const totalBalance = coins.data.reduce((acc, coin) => acc + BigInt(coin.balance), 0n);
      console.log(`Found ${totalBalance} gUSDT available for staking`);
      
      if (totalBalance === 0n) return false;
      
      // Create stake transaction
      const tx = new TransactionBlock();
      
      // If multiple coins, merge them
      if (coins.data.length > 1) {
        const [mergedCoin] = tx.mergeCoins(
          coins.data[0].coinObjectId,
          coins.data.slice(1).map(c => c.coinObjectId)
        );
        tx.moveCall({
          target: `${TESTNET_COUNTER_PACKAGE_ID}::liquidity::stake`,
          arguments: [
            tx.object(LIQUIDITY_POOL_ID),
            mergedCoin,
            tx.object(CLOCK_ID)
          ],
        });
      } else {
        tx.moveCall({
          target: `${TESTNET_COUNTER_PACKAGE_ID}::liquidity::stake`,
          arguments: [
            tx.object(LIQUIDITY_POOL_ID),
            tx.object(coins.data[0].coinObjectId),
            tx.object(CLOCK_ID)
          ],
        });
      }
      
      // Serialize transaction block
      const txJSON = tx.serialize();
      
      return new Promise<boolean>((resolve) => {
        signAndExecuteTransaction({
          transaction: txJSON as any,
        }, {
          onSuccess: (data: any) => {
            console.log("Stake transaction result:", data);
            resolve(data.effects?.status.status === "success");
          },
          onError: (error: any) => {
            console.error("Stake failed:", error);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error("Stake failed:", error);
      return false;
    }
  }, [currentAccount, suiClient, signAndExecuteTransaction]);

  // Handle price alert events
  const handlePriceAlert = useCallback(async (eventId: string) => {
    if (isProcessing || !currentAccount || !suiClient) return;
    if (eventId === lastProcessedEventId) return;
    
    try {
      setIsProcessing(true);
      console.log(`Processing price alert event: ${eventId}`);
      
      // 1. Get current stake information
      const stakedAmount = await fetchCurrentStakeInfo();
      
      if (!stakedAmount) {
        console.log("No stake information found or stake amount is 0");
        setIsProcessing(false);
        setLastProcessedEventId(eventId);
        return;
      }
      
      // 2. Unstake all funds
      const unstakeSuccess = await executeUnstake(stakedAmount);
      
      if (!unstakeSuccess) {
        console.log("Unstake failed, terminating automated arbitrage");
        setIsProcessing(false);
        setLastProcessedEventId(eventId);
        return;
      }
      
      // 3. Execute arbitrage operation
      await executeArbitrage();
      
      // 4. Restake all funds (including profits from arbitrage)
      await executeStake();
      
      console.log("Automated arbitrage completed");
      setLastProcessedEventId(eventId);
    } catch (error) {
      console.error("Error during automated arbitrage process:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, lastProcessedEventId, currentAccount, suiClient, fetchCurrentStakeInfo, executeUnstake, executeArbitrage, executeStake]);

  // Subscribe to price alert events
  useEffect(() => {
    if (!currentAccount || !suiClient) return;
    
    console.log("Starting to monitor price alert events...");
    
    // Create event subscription
    let unsubscribePromise = suiClient.subscribeEvent({
      filter: {
        MoveEventType: `${TESTNET_COUNTER_PACKAGE_ID}::price::PriceAlertEvent`
      },
      onMessage: (event) => {
        console.log("Received price alert event:", event);
        const eventData = event.parsedJson as any;
        
        // Check if price is abnormal
        if (eventData.is_abnormal) {
          console.log("Abnormal price detected, initiating automatic arbitrage process");
          const eventId = typeof event.id === 'object' ? JSON.stringify(event.id) : String(event.id);
          handlePriceAlert(eventId);
        }
      }
    });
    
    return () => {
      console.log("Stopping price alert event monitoring");
      unsubscribePromise.then(unsubscribe => unsubscribe());
    };
  }, [currentAccount, suiClient, handlePriceAlert]);

  return (
    <div style={{ 
      padding: '12px', 
      borderRadius: '8px', 
      backgroundColor: '#1A1A1A',
      marginBottom: '16px'
    }}>
      <h3 style={{ color: '#E2E8F0', marginBottom: '8px' }}>Alarm Listener</h3>
      <p style={{ color: '#94A3B8', fontSize: '14px' }}>
        Status: {isProcessing ? 
          '⚡ Executing automated arbitrage' : 
          '👁️ Monitoring for price anomalies'}
      </p>
      {lastProcessedEventId && (
        <p style={{ color: '#94A3B8', fontSize: '12px' }}>
          Last processed event ID: {lastProcessedEventId.substring(0, 10)}...
        </p>
      )}
    </div>
  );
}