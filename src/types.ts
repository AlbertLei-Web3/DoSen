/**
 * Core domain types / 核心领域类型定义
 *
 * 说明（中文）：
 * - 这些类型遵循 systemDesign/4.数据库 中的表结构抽象。
 * - 在最小实现阶段使用内存存储，后续可替换为 PostgreSQL。
 * Explanation (English):
 * - Types mirror the DB schema in systemDesign/4.数据库.
 * - In-memory storage first; can be replaced with PostgreSQL later.
 */
export type Platform = 'Discord' | 'X' | 'Telegram';

export interface User {
  userId: string; // 用户唯一标识 / user unique id (UUID)
  username: string; // 用户名 / nickname
  platform: Platform; // 平台类型
  subscriptionPlan: 'Default' | 'Custom'; // 推送方案类型
  currentStrategyId?: string; // 当前策略 ID，可为空
  createdAt: string; // ISO 时间字符串
  updatedAt: string; // ISO 时间字符串
}

export interface UserFilterHistory {
  strategyId: string; // 策略唯一标识
  userId: string; // 用户 ID
  filtersJson: unknown; // 自定义过滤条件（任意 JSON）
  createdAt: string;
  updatedAt: string;
}

export interface DefaultPushPlan {
  planId: string;
  name: string;
  description?: string;
  filtersJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export type DomainEventType = 'Expired' | 'Sale' | 'Trend';

export interface DomainEvent {
  eventId: string;
  domainName: string;
  eventType: DomainEventType;
  price?: number; // 价格可选，部分事件可能没有
  timestamp: string; // 事件发生时间（ISO）
  source: string; // 数据来源
  apiRequestPayload?: unknown; // API 请求参数（用于排查）
  apiResponsePayload?: unknown; // API 返回数据
  status: 'Success' | 'Failed';
  retriedTimes: number;
}

export interface Notification {
  notificationId: string;
  userId: string;
  eventId: string;
  channel: Platform;
  sentAt?: string;
  status: 'Sent' | 'Failed' | 'Queued';
}

export type TransactionType = 'Purchase' | 'List' | 'Trade';

export interface TransactionRecord {
  transactionId: string;
  userId: string;
  domainName: string;
  transactionType: TransactionType;
  amount?: number;
  status: 'Success' | 'Failed' | 'Pending';
  timestamp: string;
}

export interface AnalysisResult {
  analysisId: string;
  eventId: string;
  userId?: string; // 或策略 ID；最小实现使用 userId
  score?: number;
  trend?: string;
  createdAt: string;
}

/**
 * OperationLog / 操作日志
 *
 * 中文：记录用户关键操作，如订阅变更、点击、交易等，便于审计与回溯。
 * English: Record key user actions like subscription change, clicks, and trades for auditing.
 */
export interface OperationLog {
  logId: string; // 日志唯一标识
  userId?: string; // 可选，系统或匿名操作时为空
  action: string; // 行为名称，如 "SubscribeDefault" | "SubscribeCustom" | "Purchase"
  targetId?: string; // 影响对象（如事件ID、策略ID、交易ID）
  details?: unknown; // 详情（任意 JSON）
  timestamp: string; // 发生时间（ISO）
}


