/**
 * HTTP server entrypoint / HTTP 服务器入口
 *
 * 中文说明：
 * - 这是最小可运行的 Express 服务器。
 * - 仅提供健康检查与版本接口，后续将逐步补充 API 与状态机。
 * English:
 * - Minimal runnable Express server.
 * - Health check and version endpoints only for now.
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { router } from './routes';
import { db } from './store';
import { query } from './db';

dotenv.config();

const app = express();
app.use(express.json());

// Configuration / 配置
const PORT = parseInt(process.env.PORT || '3000', 10);

// Health / 健康检查
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Version / 版本信息
app.get('/version', (_req, res) => {
  res.json({ name: 'DoSen', version: '0.1.0' });
});

// Static landing / 静态落地页
app.use('/', express.static(path.join(process.cwd(), 'public')));

// API prefix
app.use('/api', router);

// Debug endpoints to observe MVP state / MVP 调试端点
app.get('/api/debug/notifications', async (_req, res) => {
  const { rows } = await query('select * from notifications order by sent_at desc nulls last limit 100');
  res.json(rows);
});

// 事件处理已在路由中触发，这里不再重复钩子

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[DoSen] Server listening on http://localhost:${PORT}`);
});


