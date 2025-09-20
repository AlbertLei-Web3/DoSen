/**
 * Minimal REST API routes / 最小 REST API 路由
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from './store';
import { AnalysisResult, DomainEvent, Notification, Platform, TransactionRecord, User, OperationLog, UserFilterHistory } from './types';
import { processEventDB } from './pipeline';
import { query } from './db';
import { createEventSchema, createTransactionSchema, createUserSchema, customSubscriptionSchema } from './validators';

export const router = Router();

// Users - create minimal user / 新建用户（最小）
router.post('/users', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { username, platform } = parsed.data;
  const sql = `insert into users (username, platform) values ($1,$2) returning user_id, username, platform, subscription_plan, current_strategy_id, created_at, updated_at`;
  const { rows } = await query(sql, [username, platform]);
  return res.status(201).json(rows[0]);
});

router.get('/users/:id', async (req, res) => {
  const { rows } = await query('select * from users where user_id=$1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'user not found' });
  return res.json(rows[0]);
});

// Subscription management / 订阅管理（最小实现）
router.post('/users/:id/subscriptions/default', async (req, res) => {
  const { rows } = await query('update users set subscription_plan=$1, updated_at=now() where user_id=$2 returning *', ['Default', req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'user not found' });
  await query('insert into operation_logs(action, user_id) values($1,$2)', ['SubscribeDefault', req.params.id]);
  return res.json(rows[0]);
});

router.post('/users/:id/subscriptions/custom', async (req, res) => {
  const parsed = customSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await (await import('pg')).Pool.prototype.connect.call(query);
  try {
    await query('begin');
    const { rows: userRows } = await query('update users set subscription_plan=$1, updated_at=now() where user_id=$2 returning *', ['Custom', req.params.id]);
    if (userRows.length === 0) {
      await query('rollback');
      return res.status(404).json({ error: 'user not found' });
    }
    const { rows: stratRows } = await query('insert into user_filter_history(user_id, filters_json) values($1,$2) returning *', [req.params.id, JSON.stringify(parsed.data.filters)]);
    await query('update users set current_strategy_id=$1 where user_id=$2', [stratRows[0].strategy_id, req.params.id]);
    await query('insert into operation_logs(action, user_id, target_id, details) values ($1,$2,$3,$4)', ['SubscribeCustom', req.params.id, stratRows[0].strategy_id, parsed.data.filters]);
    await query('commit');
    return res.json({ user: userRows[0], strategy: stratRows[0] });
  } catch (e) {
    await query('rollback');
    return res.status(500).json({ error: 'subscription update failed' });
  } finally {
    // no-op
  }
});

// Domain events - ingest & list / 事件上报与查询
router.post('/events', async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = parsed.data;
  const { rows } = await query(
    `insert into domain_events(domain_name, event_type, price, timestamp, source, api_request_payload, api_response_payload, status, retried_times)
     values ($1,$2,$3,coalesce($4, now()),$5,$6,$7,'Success',0)
     returning *`,
    [p.domainName, p.eventType, p.price ?? null, p.timestamp ?? null, p.source ?? 'manual', p.apiRequestPayload ?? null, p.apiResponsePayload ?? null]
  );
  const ev = rows[0];
  await processEventDB(ev.event_id);
  return res.status(201).json(ev);
});

router.get('/events', async (_req, res) => {
  const { rows } = await query('select * from domain_events order by timestamp desc limit 100');
  return res.json(rows);
});

// Get single event / 查询单个事件
router.get('/events/:id', async (req, res) => {
  const { rows } = await query('select * from domain_events where event_id=$1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'event not found' });
  return res.json(rows[0]);
});

// Notifications - list by user / 按用户查询通知
router.get('/users/:id/notifications', async (req, res) => {
  const { rows } = await query('select * from notifications where user_id=$1 order by sent_at desc nulls last', [req.params.id]);
  return res.json(rows);
});

// Transactions - create minimal record / 创建最小交易记录
router.post('/transactions', async (req, res) => {
  const parsed = createTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = parsed.data;
  const { rows } = await query(
    `insert into transactions(user_id, domain_name, transaction_type, amount, status)
     values ($1,$2,$3,$4,'Pending') returning *`,
    [p.userId, p.domainName, p.transactionType, p.amount ?? null]
  );
  const tx = rows[0];
  await query('insert into operation_logs(action, user_id, target_id, details) values ($1,$2,$3,$4)', [`Tx:${tx.transaction_type}`, p.userId, tx.transaction_id, { domainName: p.domainName, amount: p.amount ?? null } as any]);
  return res.status(201).json(tx);
});

// Analysis results - list by event / 按事件查询分析结果
router.get('/events/:id/analysis', async (req, res) => {
  const { rows } = await query('select * from analysis_results where event_id=$1', [req.params.id]);
  return res.json(rows);
});

// Logs - list recent / 最近操作日志
router.get('/logs', async (_req, res) => {
  const { rows } = await query('select * from operation_logs order by timestamp desc limit 100');
  return res.json(rows);
});


