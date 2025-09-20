# DoSen
这是一个面向多社交平台的“域名情报推送与交易转化系统”，以策略化筛选驱动高质量推送，并串联落地页与交易动作，实现从发现到成交的闭环。

## 快速启动（Windows）
- 安装 Node.js 18+
- 在仓库根目录运行：
  - 安装依赖：`npm install`
  - 开发启动：`npm run dev`
  - 生产构建：`npm run build`
  - 生产启动：`npm run start`

默认地址：`http://localhost:3000`，主页提供最小落地页和“示例数据”一键生成。

## 最小 API（MVP）
- `POST /api/users` 创建用户：`{ username, platform }`
- `GET /api/users/:id` 查询用户
- `POST /api/users/:id/subscriptions/default` 订阅默认方案
- `POST /api/users/:id/subscriptions/custom` 订阅自定义方案：`{ filters: {...} }`
- `POST /api/events` 上报事件：`{ domainName, eventType, price? }`
- `GET /api/events` / `GET /api/events/:id` 查询事件
- `GET /api/users/:id/notifications` 用户通知列表
- `POST /api/transactions` 创建交易
- `GET /api/events/:id/analysis` 事件分析结果
- `GET /api/logs` 最近操作日志

事件入库后会同步进入最小处理管线（过滤→消息构建→模拟推送），可在落地页或 `GET /api/debug/notifications` 查看结果。

## 环境变量
- `PORT`（可选，默认 3000）

## 设计范围
严格按照 `systemDesign/` 文档实现最小闭环：采集→筛选分析→消息构建→多渠道推送桩→落地页→交易记录与溯源。