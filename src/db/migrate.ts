/**
 * Database migrator (PostgreSQL) / 数据库迁移器（PostgreSQL）
 *
 * 中文：读取同目录下的 schema.sql 并在当前连接上执行，用于初始化/升级最小表结构。
 * English: Reads schema.sql in the same folder and executes it on the connected database.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { pool } from './index';

async function main(): Promise<void> {
  // Resolve schema.sql under src/db/
  // 中文：定位到 src/db/schema.sql
  const sqlPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('Schema applied.');
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


