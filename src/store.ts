/**
 * In-memory store for MVP / MVP 内存存储
 *
 * 说明：
 * - 使用简单的 Map/Array 保存数据，便于快速验证流程。
 * - 后续可替换为数据库实现（PostgreSQL/Prisma 等）。
 */
import { AnalysisResult, DefaultPushPlan, DomainEvent, Notification, OperationLog, TransactionRecord, User, UserFilterHistory } from './types';

export const db = {
  users: new Map<string, User>(),
  strategies: new Map<string, UserFilterHistory>(),
  defaultPlans: new Map<string, DefaultPushPlan>(),
  events: new Map<string, DomainEvent>(),
  notifications: new Map<string, Notification>(),
  transactions: new Map<string, TransactionRecord>(),
  analysisResults: new Map<string, AnalysisResult>(),
  logs: new Map<string, OperationLog>(),
};


