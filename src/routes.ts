/**
 * Minimal REST API routes / 最小 REST API 路由
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from './store';
import { AnalysisResult, DomainEvent, Notification, Platform, TransactionRecord, User, OperationLog, UserFilterHistory } from './types';
import { processEvent } from './pipeline';

export const router = Router();

// Users - create minimal user / 新建用户（最小）
router.post('/users', (req, res) => {
  const { username, platform } = req.body as { username?: string; platform?: Platform };
  if (!username || !platform) {
    return res.status(400).json({ error: 'username and platform are required' });
  }
  const now = new Date().toISOString();
  const user: User = {
    userId: uuid(),
    username,
    platform,
    subscriptionPlan: 'Default',
    createdAt: now,
    updatedAt: now,
  };
  db.users.set(user.userId, user);
  return res.status(201).json(user);
});

router.get('/users/:id', (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  return res.json(user);
});

// Subscription management / 订阅管理（最小实现）
router.post('/users/:id/subscriptions/default', (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  user.subscriptionPlan = 'Default';
  user.updatedAt = new Date().toISOString();
  const log: OperationLog = { logId: uuid(), userId: user.userId, action: 'SubscribeDefault', timestamp: user.updatedAt };
  db.logs.set(log.logId, log);
  return res.json(user);
});

router.post('/users/:id/subscriptions/custom', (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'user not found' });
  const now = new Date().toISOString();
  user.subscriptionPlan = 'Custom';
  user.updatedAt = now;
  const strategy: UserFilterHistory = {
    strategyId: uuid(),
    userId: user.userId,
    filtersJson: req.body?.filters ?? {},
    createdAt: now,
    updatedAt: now,
  };
  user.currentStrategyId = strategy.strategyId;
  db.strategies.set(strategy.strategyId, strategy);
  const log: OperationLog = { logId: uuid(), userId: user.userId, action: 'SubscribeCustom', targetId: strategy.strategyId, details: strategy.filtersJson, timestamp: now };
  db.logs.set(log.logId, log);
  return res.json({ user, strategy });
});

// Domain events - ingest & list / 事件上报与查询
router.post('/events', (req, res) => {
  const payload = req.body as Partial<DomainEvent> & { domainName?: string; eventType?: string };
  if (!payload.domainName || !payload.eventType) {
    return res.status(400).json({ error: 'domainName and eventType are required' });
  }
  const event: DomainEvent = {
    eventId: uuid(),
    domainName: payload.domainName,
    eventType: payload.eventType as DomainEvent['eventType'],
    price: payload.price,
    timestamp: payload.timestamp || new Date().toISOString(),
    source: payload.source || 'manual',
    apiRequestPayload: payload.apiRequestPayload,
    apiResponsePayload: payload.apiResponsePayload,
    status: 'Success',
    retriedTimes: 0,
  };
  db.events.set(event.eventId, event);
  // Immediately process event through pipeline / 立刻进入管线
  processEvent(event);
  return res.status(201).json(event);
});

router.get('/events', (_req, res) => {
  return res.json(Array.from(db.events.values()));
});

// Get single event / 查询单个事件
router.get('/events/:id', (req, res) => {
  const ev = db.events.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'event not found' });
  return res.json(ev);
});

// Notifications - list by user / 按用户查询通知
router.get('/users/:id/notifications', (req, res) => {
  const list = Array.from(db.notifications.values()).filter(n => n.userId === req.params.id);
  return res.json(list);
});

// Transactions - create minimal record / 创建最小交易记录
router.post('/transactions', (req, res) => {
  const { userId, domainName, transactionType, amount } = req.body as Partial<TransactionRecord> & { userId?: string; domainName?: string; transactionType?: string };
  if (!userId || !domainName || !transactionType) {
    return res.status(400).json({ error: 'userId, domainName, transactionType are required' });
  }
  const tx: TransactionRecord = {
    transactionId: uuid(),
    userId,
    domainName,
    transactionType: transactionType as TransactionRecord['transactionType'],
    amount,
    status: 'Pending',
    timestamp: new Date().toISOString(),
  };
  db.transactions.set(tx.transactionId, tx);
  const log: OperationLog = { logId: uuid(), userId, action: `Tx:${tx.transactionType}`, targetId: tx.transactionId, details: { domainName, amount }, timestamp: tx.timestamp };
  db.logs.set(log.logId, log);
  return res.status(201).json(tx);
});

// Analysis results - list by event / 按事件查询分析结果
router.get('/events/:id/analysis', (req, res) => {
  const list: AnalysisResult[] = Array.from(db.analysisResults.values()).filter(a => a.eventId === req.params.id);
  return res.json(list);
});

// Logs - list recent / 最近操作日志
router.get('/logs', (_req, res) => {
  return res.json(Array.from(db.logs.values()));
});


