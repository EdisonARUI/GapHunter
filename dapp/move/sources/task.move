module gaphunter::task {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;

    /// 错误码
    const EINVALID_THRESHOLD: u64 = 1;
    const EINVALID_COOLDOWN: u64 = 2;
    const EINVALID_CHAIN_PAIRS: u64 = 3;
    const EMAX_CHAIN_PAIRS: u64 = 4;

    /// 常量配置
    const MIN_THRESHOLD: u64 = 1; // 0.01%
    const MAX_THRESHOLD: u64 = 10000; // 100%
    const MIN_COOLDOWN: u64 = 60; // 1分钟
    const MAX_COOLDOWN: u64 = 86400; // 24小时
    const MAX_CHAIN_PAIRS: u64 = 10;

    /// 任务配置结构
    struct TaskConfig has key, store {
        id: UID,
        chain_pairs: vector<String>,
        threshold: u64,
        cooldown: u64,
        last_alert: u64,
        owner: address
    }

    /// 任务创建事件
    struct TaskCreatedEvent has copy, drop {
        task_id: ID,
        owner: address,
        chain_pairs: vector<String>,
        threshold: u64
    }

    /// 创建新任务
    public fun create_task(
        chain_pairs: vector<String>,
        threshold: u64,
        cooldown: u64,
        ctx: &mut TxContext
    ): TaskConfig {
        // 验证阈值
        assert!(threshold >= MIN_THRESHOLD && threshold <= MAX_THRESHOLD, EINVALID_THRESHOLD);
        
        // 验证冷却时间
        assert!(cooldown >= MIN_COOLDOWN && cooldown <= MAX_COOLDOWN, EINVALID_COOLDOWN);
        
        // 验证链对数量
        assert!(vector::length(&chain_pairs) > 0 && vector::length(&chain_pairs) <= MAX_CHAIN_PAIRS, EINVALID_CHAIN_PAIRS);

        let task_config = TaskConfig {
            id: object::new(ctx),
            chain_pairs,
            threshold,
            cooldown,
            last_alert: 0,
            owner: tx_context::sender(ctx)
        };

        // 发出任务创建事件
        event::emit(TaskCreatedEvent {
            task_id: object::id(&task_config),
            owner: tx_context::sender(ctx),
            chain_pairs: chain_pairs,
            threshold: threshold
        });

        task_config
    }

    /// 获取任务配置
    public fun get_task(task: &TaskConfig): &TaskConfig {
        task
    }

    /// 更新任务配置
    public fun update_task(
        task: &mut TaskConfig,
        new_threshold: u64,
        new_cooldown: u64
    ) {
        // 验证阈值
        assert!(new_threshold >= MIN_THRESHOLD && new_threshold <= MAX_THRESHOLD, EINVALID_THRESHOLD);
        
        // 验证冷却时间
        assert!(new_cooldown >= MIN_COOLDOWN && new_cooldown <= MAX_COOLDOWN, EINVALID_COOLDOWN);

        task.threshold = new_threshold;
        task.cooldown = new_cooldown;
    }

    /// 转移任务所有权
    public fun transfer_task(
        task: TaskConfig,
        new_owner: address,
        ctx: &mut TxContext
    ) {
        transfer::transfer(task, new_owner);
    }

    /// 获取任务阈值
    public fun get_threshold(task: &TaskConfig): u64 {
        task.threshold
    }

    /// 获取任务冷却时间
    public fun get_cooldown(task: &TaskConfig): u64 {
        task.cooldown
    }

    /// 获取最后警报时间
    public fun get_last_alert(task: &TaskConfig): u64 {
        task.last_alert
    }

    /// 更新最后警报时间
    public fun update_last_alert(task: &mut TaskConfig, timestamp: u64) {
        task.last_alert = timestamp;
    }
} 