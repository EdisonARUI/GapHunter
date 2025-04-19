import { Task, Alert } from '../types';

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private alerts: Map<string, Alert[]> = new Map();
  private readonly MAX_TASKS = 10; // 最大任务数量限制

  constructor() {
    this.loadTasks();
  }

  private async loadTasks() {
    // TODO: 从区块链加载任务
  }

  public createTask(task: Omit<Task, 'id' | 'status'>): Task {
    if (this.tasks.size >= this.MAX_TASKS) {
      throw new Error('已达到最大任务数量限制');
    }

    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      status: 'active',
    };

    this.tasks.set(newTask.id, newTask);
    this.alerts.set(newTask.id, []);
    return newTask;
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  public getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  public updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  public deleteTask(id: string): boolean {
    return this.tasks.delete(id) && this.alerts.delete(id);
  }

  public addAlert(taskId: string, alert: Omit<Alert, 'id' | 'timestamp'>): Alert {
    const taskAlerts = this.alerts.get(taskId) || [];
    const newAlert: Alert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    taskAlerts.push(newAlert);
    this.alerts.set(taskId, taskAlerts);
    return newAlert;
  }

  public getAlerts(taskId: string): Alert[] {
    return this.alerts.get(taskId) || [];
  }
} 