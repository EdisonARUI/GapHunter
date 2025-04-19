// 支持的链
export const SUPPORTED_CHAINS = [
  'Sui',
  'Ethereum',
  'BSC',
  'Polygon',
  'Avalanche',
];

// 默认配置
export const DEFAULT_CONFIG = {
  maxTasks: 10,
  minThreshold: 0.01,
  maxThreshold: 100,
  defaultCooldown: 300000, // 5分钟
};

// API 端点
export const API_ENDPOINTS = {
  PRICE: '/api/price',
  TASKS: '/api/tasks',
  ALERTS: '/api/alerts',
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  INVALID_CHAIN: '不支持的链',
  INVALID_THRESHOLD: '无效的阈值',
  TASK_NOT_FOUND: '任务不存在',
  ALREADY_EXISTS: '任务已存在',
} as const;

export const SUPPORTED_TOKENS = [
  'USDT',
  'USDC',
  'DAI',
  'WETH',
  'WBTC',
]; 