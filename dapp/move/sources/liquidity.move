// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module gaphunter::liquidity {
    use sui::object::{Self, UID};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use gaphunter::mycoin::MYCOIN;
    use sui::event;

    /// 错误码
    const E_INSUFFICIENT_BALANCE: u64 = 0;
    const E_NO_STAKE_FOUND: u64 = 1;

    /// 年化收益率 (5% = 500)
    const ANNUAL_RATE: u64 = 500;
    /// 基数
    const BASIS_POINTS: u64 = 10000;
    
    /// 质押信息结构
    struct StakeInfo has store, drop {
        amount: u64,
        stake_time: u64,
        last_reward_time: u64
    }

    /// 流动性池结构
    struct LiquidityPool has key {
        id: UID,
        /// 总流动性
        total_liquidity: Balance<MYCOIN>,
        /// 总收益池
        reward_pool: Balance<MYCOIN>,
        /// 用户质押信息
        stakes: Table<address, StakeInfo>
    }

    /// 管理员权限结构
    struct AdminCap has key {
        id: UID
    }

    // 定义质押事件结构
    struct StakeEvent has copy, drop {
        user: address,
        amount: u64,
        total_staked: u64,
        timestamp: u64
    }
    
    // 定义解质押事件结构
    struct UnstakeEvent has copy, drop {
        user: address,
        amount: u64,
        remaining: u64,
        timestamp: u64
    }

    // 初始化函数
    fun init(ctx: &mut TxContext) {
        // 创建管理员权限
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        
        // 创建流动性池
        let pool = LiquidityPool {
            id: object::new(ctx),
            total_liquidity: balance::zero(),
            reward_pool: balance::zero(),
            stakes: table::new(ctx)
        };

        // 转移管理员权限给部署者
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        // 将流动性池设置为共享对象
        transfer::share_object(pool);
    }

    /// 质押代币
    public entry fun stake(
        pool: &mut LiquidityPool,
        coin_in: Coin<MYCOIN>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let amount = coin::value(&coin_in);
        let current_time = clock::timestamp_ms(clock);
        
        // 将代币添加到流动性池
        let balance_in = coin::into_balance(coin_in);
        balance::join(&mut pool.total_liquidity, balance_in);

        if (table::contains(&pool.stakes, sender)) {
            // 获取并更新现有质押信息
            let info = table::borrow_mut(&mut pool.stakes, sender);
            let reward = calculate_reward(info.amount, info.last_reward_time, current_time);
            let new_amount = info.amount + reward + amount;
            
            // 更新质押信息
            *info = StakeInfo {
                amount: new_amount,
                stake_time: info.stake_time,
                last_reward_time: current_time
            };
        } else {
            // 创建新的质押记录
            let new_stake = StakeInfo {
                amount,
                stake_time: current_time,
                last_reward_time: current_time
            };
            table::add(&mut pool.stakes, sender, new_stake);
        };

        // 最后发送质押事件
        let total_staked = if (table::contains(&pool.stakes, sender)) {
            let info = table::borrow(&pool.stakes, sender);
            info.amount
        } else {
            amount
        };
        
        event::emit(StakeEvent {
            user: sender,
            amount: amount,
            total_staked: total_staked,
            timestamp: current_time
        });
    }

    /// 提取代币（包括收益）
    public entry fun unstake(
        pool: &mut LiquidityPool,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&pool.stakes, sender), E_NO_STAKE_FOUND);
        
        let current_time = clock::timestamp_ms(clock);
        
        // 首先获取质押信息进行计算
        let stake_info = table::borrow(&pool.stakes, sender);
        let current_amount = stake_info.amount;
        let stake_time = stake_info.stake_time;
        
        let reward = calculate_reward(current_amount, stake_info.last_reward_time, current_time);
        let total_available = current_amount + reward;
        
        // 确保有足够的余额可提取
        assert!(amount <= total_available, E_INSUFFICIENT_BALANCE);
        
        // 计算提取后剩余金额
        let remaining = total_available - amount;
        
        // 处理质押记录 - 先删除旧记录
        let should_remove = remaining == 0;
        table::remove(&mut pool.stakes, sender);
        
        // 如果有剩余金额，添加新记录
        if (!should_remove) {
            let new_stake_info = StakeInfo {
                amount: remaining,
                stake_time: stake_time,
                last_reward_time: current_time
            };
            table::add(&mut pool.stakes, sender, new_stake_info);
        };
        
        // 从流动性池中提取代币
        let out_balance = balance::split(&mut pool.total_liquidity, amount);
        let out_coin = coin::from_balance(out_balance, ctx);
        transfer::public_transfer(out_coin, sender);

        // 发送解质押事件
        event::emit(UnstakeEvent {
            user: sender,
            amount,
            remaining,
            timestamp: current_time
        });
    }

    /// 查询质押信息
    public fun get_stake_info(pool: &LiquidityPool, user: address, clock: &Clock): (u64, u64) {
        if (!table::contains(&pool.stakes, user)) {
            return (0, 0)
        };
        
        let stake_info = table::borrow(&pool.stakes, user);
        let current_time = clock::timestamp_ms(clock);
        let reward = calculate_reward(stake_info.amount, stake_info.last_reward_time, current_time);
        
        (stake_info.amount, reward)
    }

    /// 计算收益
    fun calculate_reward(amount: u64, last_reward_time: u64, current_time: u64): u64 {
        if (amount == 0 || current_time <= last_reward_time) {
            return 0
        };
        
        let time_elapsed = current_time - last_reward_time;
        // 将毫秒转换为年
        let years = (time_elapsed as u128) * (BASIS_POINTS as u128) / (365 * 24 * 60 * 60 * 1000 as u128);
        // 计算收益
        let reward = (amount as u128) * years * (ANNUAL_RATE as u128) / (BASIS_POINTS as u128) / (BASIS_POINTS as u128);
        
        (reward as u64)
    }

    /// 查询总流动性
    public fun total_liquidity(pool: &LiquidityPool): u64 {
        balance::value(&pool.total_liquidity)
    }

    /// 管理员添加奖励
    public entry fun add_rewards(
        _admin: &AdminCap,
        pool: &mut LiquidityPool,
        reward: Coin<MYCOIN>,
        _ctx: &mut TxContext
    ) {
        let reward_balance = coin::into_balance(reward);
        balance::join(&mut pool.reward_pool, reward_balance);
    }
}