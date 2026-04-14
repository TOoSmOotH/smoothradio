import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export async function createDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/music_server',
  });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/music_server',
});

export const db = drizzle(pool, { schema });
