import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export function createDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000
  });

  return drizzle(pool, { schema });
}

export async function ensureCoreSchema(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30_000
  });

  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(512) NOT NULL,
        description text,
        content text,
        summary text,
        source varchar(128) NOT NULL,
        url varchar(1024) NOT NULL UNIQUE,
        image_url varchar(1024),
        category varchar(64) NOT NULL,
        entities jsonb NOT NULL DEFAULT '[]'::jsonb,
        keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
        ranking_score integer NOT NULL DEFAULT 0,
        published_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS articles_category_published_idx ON articles (category, published_at DESC)"
    );
    await pool.query("CREATE INDEX IF NOT EXISTS articles_ranking_idx ON articles (ranking_score DESC)");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(256) NOT NULL UNIQUE,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, article_id)
      )
    `);
  } finally {
    await pool.end();
  }
}

export * from "./schema.js";
