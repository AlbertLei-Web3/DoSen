/**
 * Simple migrator to apply schema / 简单迁移器：执行 schema SQL
 */
import { readFileSync } from 'fs';
import path from 'path';
import { pool } from './db';

async function main(){
  const sqlPath = path.join(process.cwd(), 'src', 'db_schema.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('Schema applied.');
  await pool.end();
}

main().catch((err)=>{
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


