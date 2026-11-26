/**
 * Universal Database Client (Neon Serverless Postgres / In-Memory Fallback)
 */
import { neon } from "@neondatabase/serverless";

export interface DbQueryResult {
  simulated: boolean;
  rows: Record<string, unknown>[];
}

export function getDbClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL not set. Running in demo memory mode.");
    return null;
  }
  return neon(url);
}

export async function runQuery(
  sqlText: string,
  params: unknown[] = []
): Promise<DbQueryResult> {
  const sql = getDbClient();
  if (!sql) {
    return { simulated: true, rows: [] };
  }
  const rows = (await sql(sqlText, params)) as Record<string, unknown>[];
  return { simulated: false, rows };
}
