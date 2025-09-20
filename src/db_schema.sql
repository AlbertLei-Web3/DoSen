-- PostgreSQL schema for DoSen (aligned with systemDesign/4.数据库)

create extension if not exists "uuid-ossp";

-- 1. Users
create table if not exists users (
  user_id uuid primary key default uuid_generate_v4(),
  username text not null,
  platform text not null check (platform in ('Discord','X','Telegram')),
  subscription_plan text not null default 'Default' check (subscription_plan in ('Default','Custom')),
  current_strategy_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. UserFilterHistory
create table if not exists user_filter_history (
  strategy_id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(user_id) on delete cascade,
  filters_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. DefaultPushPlan
create table if not exists default_push_plan (
  plan_id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text null,
  filters_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. DomainEvents
create table if not exists domain_events (
  event_id uuid primary key default uuid_generate_v4(),
  domain_name text not null,
  event_type text not null check (event_type in ('Expired','Sale','Trend')),
  price numeric null,
  timestamp timestamptz not null default now(),
  source text not null,
  api_request_payload jsonb null,
  api_response_payload jsonb null,
  status text not null default 'Success' check (status in ('Success','Failed')),
  retried_times int not null default 0
);

-- 5. Notifications
create table if not exists notifications (
  notification_id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(user_id) on delete cascade,
  event_id uuid not null references domain_events(event_id) on delete cascade,
  channel text not null check (channel in ('Discord','X','Telegram')),
  sent_at timestamptz null,
  status text not null check (status in ('Sent','Failed','Queued'))
);

-- 6. Transactions
create table if not exists transactions (
  transaction_id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(user_id) on delete cascade,
  domain_name text not null,
  transaction_type text not null check (transaction_type in ('Purchase','List','Trade')),
  amount numeric null,
  status text not null default 'Pending' check (status in ('Success','Failed','Pending')),
  timestamp timestamptz not null default now()
);

-- 7. AnalysisResults
create table if not exists analysis_results (
  analysis_id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references domain_events(event_id) on delete cascade,
  user_id uuid null references users(user_id) on delete set null,
  score numeric null,
  trend text null,
  created_at timestamptz not null default now()
);

-- 8. OperationLogs (optional)
create table if not exists operation_logs (
  log_id uuid primary key default uuid_generate_v4(),
  actor text null,
  action text not null,
  user_id uuid null references users(user_id) on delete set null,
  target_id uuid null,
  details jsonb null,
  timestamp timestamptz not null default now()
);

-- indices
create index if not exists idx_domain_events_type_time on domain_events(event_type, timestamp desc);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_event on notifications(event_id);
create index if not exists idx_transactions_user_time on transactions(user_id, timestamp desc);
create index if not exists idx_analysis_event on analysis_results(event_id);
create index if not exists idx_logs_time on operation_logs(timestamp desc);


