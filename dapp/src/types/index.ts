import { TaskConfig } from './task';

// 价格数据类型
export interface PriceData {
  chain: string;
  token: string;
  price: number;
  timestamp: number;
}

// 价格差异类型
export interface PriceSpread {
  chainA: string;
  chainB: string;
  spread: number;
  isAbnormal: boolean;
}

// 任务配置类型
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  config: TaskConfig;
  createdAt: number;
  updatedAt: number;
}

// 价格事件类型
export interface PriceEvent {
  price: number;
  threshold: number;
  timestamp: number;
}

// 警报类型
export interface Alert {
  id: string;
  taskId: string;
  type: 'price' | 'error' | 'info';
  message: string;
  timestamp: number;
  data?: Record<string, any>;
} 