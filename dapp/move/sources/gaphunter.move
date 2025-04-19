module gaphunter::gaphunter {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;

    use gaphunter::task;
    use gaphunter::price;

    /// 创建新任务
    public fun create_task(
        chain_pairs: vector<String>,
        threshold: u64,
        cooldown: u64,
        ctx: &mut TxContext
    ): task::TaskConfig {
        task::create_task(chain_pairs, threshold, cooldown, ctx)
    }

    /// 获取任务配置
    public fun get_task(task: &task::TaskConfig): &task::TaskConfig {
        task::get_task(task)
    }

    /// 更新任务配置
    public fun update_task(
        task: &mut task::TaskConfig,
        new_threshold: u64,
        new_cooldown: u64
    ) {
        task::update_task(task, new_threshold, new_cooldown)
    }

    /// 触发价格警报
    public fun trigger_price_alert(
        task: &mut task::TaskConfig,
        price: u64,
        ctx: &TxContext
    ) {
        price::trigger_price_alert(task, price, ctx)
    }

    /// 转移任务所有权
    public fun transfer_task(
        task: task::TaskConfig,
        new_owner: address,
        ctx: &mut TxContext
    ) {
        task::transfer_task(task, new_owner, ctx)
    }
} 