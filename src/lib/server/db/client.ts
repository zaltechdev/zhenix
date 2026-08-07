import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { assertServerOnly } from "@/lib/server/server-guard";
import { databaseStatus } from "@/lib/server/config/runtime-config";
import * as schema from "@/lib/server/db/schema";

assertServerOnly("src/lib/server/db/client.ts");

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified integer DEFAULT 0 NOT NULL,
  name text,
  image_url text,
  default_workspace_id text,
  locale text DEFAULT 'en',
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at integer NOT NULL,
  ip_address text,
  user_agent text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at integer,
  refresh_token_expires_at integer,
  scope text,
  password text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS verifications (
  id text PRIMARY KEY NOT NULL,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at integer NOT NULL,
  created_at integer,
  updated_at integer
);
CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY NOT NULL,
  owner_user_id text NOT NULL,
  name text NOT NULL,
  locale text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workspace_members (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  created_at integer NOT NULL,
  removed_at integer,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS accessibility_profiles (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL UNIQUE,
  pointer_sensitivity integer DEFAULT 50 NOT NULL,
  dead_zone integer DEFAULT 20 NOT NULL,
  smoothing integer DEFAULT 40 NOT NULL,
  selection_mode text DEFAULT 'dwell' NOT NULL,
  dwell_duration_ms integer DEFAULT 1200,
  gesture_type text,
  gesture_threshold integer,
  gesture_cooldown_ms integer,
  reduced_motion integer DEFAULT 0 NOT NULL,
  calibrated_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS consent_records (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  consent_type text NOT NULL,
  granted integer NOT NULL,
  policy_version text NOT NULL,
  granted_at integer,
  revoked_at integer,
  created_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS oauth_connections (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  provider text NOT NULL,
  provider_account_id text,
  provider_email text,
  refresh_token_ciphertext text,
  refresh_token_key_version integer DEFAULT 1,
  granted_scopes text,
  status text NOT NULL,
  last_verified_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  input_mode text,
  command_text text NOT NULL,
  intent text,
  state text NOT NULL,
  result_summary text,
  error_category text,
  items_total integer,
  items_completed integer,
  idempotency_key text NOT NULL,
  started_at integer NOT NULL,
  ended_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS task_steps (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  sequence integer NOT NULL,
  label text NOT NULL,
  state text NOT NULL,
  requires_confirmation integer DEFAULT 0,
  started_at integer,
  ended_at integer,
  created_at integer NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tool_calls (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  task_step_id text,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  tool_name text NOT NULL,
  tool_kind text,
  arguments_summary text,
  outcome text,
  error_category text,
  affected_item_count integer,
  verified integer DEFAULT 0,
  duration_ms integer,
  confirmation_id text,
  created_at integer NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (task_step_id) REFERENCES task_steps(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS artifacts (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  kind text,
  title text NOT NULL,
  body text NOT NULL,
  body_format text,
  language text,
  provider text,
  retrieved_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS artifact_sources (
  id text PRIMARY KEY NOT NULL,
  artifact_id text NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  position integer NOT NULL,
  source_type text,
  title text NOT NULL,
  url text,
  domain text,
  snippet text,
  retrieved_at integer NOT NULL,
  created_at integer NOT NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS activity_events (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  label text NOT NULL,
  affected_items text,
  tool_call_id text,
  created_at integer NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_call_id) REFERENCES tool_calls(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS confirmations (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  action_key text NOT NULL,
  action_summary text NOT NULL,
  scope_items text NOT NULL,
  changes_external_data integer DEFAULT 0,
  undo_supported integer DEFAULT 0,
  state text NOT NULL,
  expires_at integer NOT NULL,
  answered_at integer,
  consumed_at integer,
  created_at integer NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS undo_records (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  tool_call_id text NOT NULL,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  undo_kind text NOT NULL,
  reverse_payload text NOT NULL,
  state text NOT NULL,
  items_total integer NOT NULL,
  items_reverted integer,
  expires_at integer NOT NULL,
  applied_at integer,
  created_at integer NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_call_id) REFERENCES tool_calls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS provider_usage (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  workspace_id text,
  task_id text,
  provider text,
  model text,
  operation text,
  input_tokens integer,
  output_tokens integer,
  cost_micros integer,
  latency_ms integer,
  outcome text,
  retry_count integer DEFAULT 0 NOT NULL,
  fallback_used integer DEFAULT 0,
  created_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY NOT NULL,
  user_id text,
  workspace_id text,
  event_type text NOT NULL,
  subject_type text,
  subject_id text,
  detail text,
  ip_hash text,
  created_at integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
`;

let initialized = false;

function isLocalFileSqlite(url: string): boolean {
  return url.startsWith("file:") || url.includes(":memory:");
}

function createDbClient() {
  const url = process.env.TURSO_DATABASE_URL || "file:aksa.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({
    url,
    authToken: authToken && !authToken.startsWith("replace-with") ? authToken : undefined
  });

  // Never run runtime table creation in production or against remote Turso databases.
  // Drizzle migrations are authoritative for production deployments.
  if (!initialized && process.env.NODE_ENV !== "production" && isLocalFileSqlite(url)) {
    initialized = true;
    try {
      client.executeMultiple(INIT_SQL).catch(() => {
        /* Best effort sync for local file SQLite in development/test mode */
      });
    } catch {
      /* Best effort */
    }
  }

  return drizzle(client, { schema });
}

let dbInstance: ReturnType<typeof createDbClient> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDbClient();
  }
  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof createDbClient>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

export function isDatabaseReady(): boolean {
  return databaseStatus().configured || process.env.NODE_ENV === "test" || !process.env.TURSO_DATABASE_URL;
}

export function resetDatabaseAccessCache(): void {
  dbInstance = null;
  initialized = false;
}
