/**
 * Minimal pipeline & state machine stubs / 最小处理管线与状态机桩
 *
 * 目标：
 * - 模拟 Filter → Queue → Send 的核心流转，不做真实外部推送。
 */
import { v4 as uuid } from 'uuid';
import { db } from './store';
import { AnalysisResult, DomainEvent, Notification } from './types';

// Simple filter function / 简单过滤（示例：价格>0 或有趋势）
export function matchesDefaultFilters(event: DomainEvent): boolean {
  if (event.eventType === 'Expired') return true;
  if (event.eventType === 'Sale' && (event.price ?? 0) > 0) return true;
  if (event.eventType === 'Trend') return true;
  return false;
}

// Message builder / 消息构建
export function buildMessage(event: DomainEvent): string {
  const priceInfo = event.price ? ` | price: ${event.price}` : '';
  return `[${event.eventType}] ${event.domainName}${priceInfo}`;
}

// Enqueue and simulate sending to all users / 入队并模拟向所有用户发送
export function processEvent(event: DomainEvent): void {
  if (!matchesDefaultFilters(event)) return;

  // Simple analysis stub / 简单分析桩
  const analysis: AnalysisResult = {
    analysisId: uuid(),
    eventId: event.eventId,
    score: event.price ? Math.min(100, Math.max(0, Math.round(event.price))) : undefined,
    createdAt: new Date().toISOString(),
  };
  db.analysisResults.set(analysis.analysisId, analysis);

  const message = buildMessage(event);
  // Broadcast to all users for MVP / MVP 阶段广播给所有用户
  for (const user of db.users.values()) {
    const n: Notification = {
      notificationId: uuid(),
      userId: user.userId,
      eventId: event.eventId,
      channel: user.platform,
      status: 'Queued',
    };
    db.notifications.set(n.notificationId, n);
    // Simulate sending success / 模拟发送成功
    n.status = 'Sent';
    n.sentAt = new Date().toISOString();
  }
}


