export interface TaskConfig { 
    id: string; 
    chain_pairs: string[]; // 格式: ["chainId:tokenAddress", "chainId:tokenAddress"]
    threshold: number; // 价格差异阈值（百分比）
    cooldown: number; // 冷却时间（秒）
    last_alert?: number; // 上次警报时间戳
}
