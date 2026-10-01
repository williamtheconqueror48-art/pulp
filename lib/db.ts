import { Pool } from "pg";

// Lazy singleton — DATABASE_URL is server-only (never in the client bundle).
let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL is not set");
  pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validDeviceId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Idempotent device registration (v1 anonymous auth).
export async function ensureDevice(deviceId: string): Promise<void> {
  await getPool().query(
    "INSERT INTO devices(id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
    [deviceId]
  );
}

export const DOC_TYPES = ["screenplay", "poem", "song"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export function validDocType(v: unknown): v is DocType {
  return typeof v === "string" && (DOC_TYPES as readonly string[]).includes(v);
}
