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

export * from "./schema.js";

