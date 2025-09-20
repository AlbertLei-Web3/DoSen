/**
 * Minimal pipeline & state machine stubs / 最小处理管线与状态机桩
 *
 * 目标：
 * - 模拟 Filter → Queue → Send 的核心流转，不做真实外部推送。
 */
import { v4 as uuid } from 'uuid';
import { db } from './store';
import { AnalysisResult, DomainEvent, Notification } from './types';
import { query } from './db';

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
export async function processEventDB(eventId: string): Promise<void> {
  // Load event
  const { rows: evRows } = await query<DomainEvent>('select * from domain_events where event_id=$1', [eventId]);
  if (evRows.length === 0) return;
  const ev = evRows[0] as any as DomainEvent;
  if (!matchesDefaultFilters(ev)) return;

  // analysis
  const score = ev.price ? Math.min(100, Math.max(0, Math.round(Number(ev.price)))) : null;
  await query('insert into analysis_results(event_id, score) values ($1,$2)', [eventId, score]);

  // notifications: broadcast MVP
  const { rows: users } = await query('select user_id, platform from users');
  for (const u of users) {
    await query('insert into notifications(user_id, event_id, channel, status, sent_at) values ($1,$2,$3,$4, now())', [u.user_id, eventId, u.platform, 'Sent']);
  }
}


