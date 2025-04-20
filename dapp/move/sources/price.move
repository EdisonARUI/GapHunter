module gaphunter::price {
    use sui::object::{UID, ID};
    use sui::tx_context;
    use sui::event;
    use gaphunter::task::TaskConfig;
    use gaphunter::task as task_module;

    const EINVALID_PRICE: u64 = 1;
    const EPRICE_TOO_HIGH: u64 = 2;
    const MAX_PRICE_CHANGE: u64 = 2000;
    const MIN_PRICE: u64 = 1;

    struct PriceEvent has copy, drop {
        price: u64,
        threshold: u64,
        timestamp: u64
    }

    struct PriceAlertEvent has copy, drop {
        task_id: ID,
        price: u64,
        threshold: u64,
        timestamp: u64,
        is_abnormal: bool
    }

    public fun trigger_price_alert(
        task: &mut TaskConfig,
        price: u64,
        ctx: &tx_context::TxContext
    ) {
        assert!(price >= MIN_PRICE, EINVALID_PRICE);

        let epoch: u64 = tx_context::epoch(ctx); 
        let last: u64 = task_module::get_last_alert(task);
        let cool: u64 = task_module::get_cooldown(task);
        let thres: u64 = task_module::get_threshold(task);
        
        if  (epoch > last + cool) {
            task_module::update_last_alert(task, epoch);

            let abnormal: bool = price >= thres;

            event::emit(PriceAlertEvent {
                task_id: sui::object::id(task),
                price,
                threshold: thres,
                timestamp: epoch,
                is_abnormal: abnormal
            });
        };
    }
}
