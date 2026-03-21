import Database from "better-sqlite3";
import { mkdirSync, existsSync, accessSync, constants, statSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";

function getDbPath(): string {
  return process.env.DATABASE_PATH || resolve(import.meta.dirname, "../data/motivaton.db");
}

function getDb(): Database.Database {
  const dbPath = getDbPath();
  console.log(`[store] Opening SQLite at: ${dbPath} (DATABASE_PATH=${process.env.DATABASE_PATH || "(not set)"})`);
  const dir = dirname(dbPath);

  // Diagnostic: check mount/directory state
  console.log(`[store] dir="${dir}" exists=${existsSync(dir)}`);
  if (existsSync(dir)) {
    try {
      const stat = statSync(dir);
      console.log(`[store] dir isDirectory=${stat.isDirectory()} mode=${stat.mode.toString(8)} uid=${stat.uid} gid=${stat.gid}`);
      const contents = readdirSync(dir);
      console.log(`[store] dir contents: ${JSON.stringify(contents)}`);
      accessSync(dir, constants.W_OK);
      console.log(`[store] dir is writable`);
    } catch (e) {
      console.error(`[store] dir access check failed:`, e);
    }
    // Check the db file itself
    if (existsSync(dbPath)) {
      try {
        const fstat = statSync(dbPath);
        console.log(`[store] db file size=${fstat.size} mode=${fstat.mode.toString(8)} uid=${fstat.uid} gid=${fstat.gid}`);
        const header = readFileSync(dbPath, { encoding: null }).subarray(0, 16);
        console.log(`[store] db file header: ${header.toString("utf8").replace(/[^\x20-\x7E]/g, "?")} (hex: ${header.toString("hex")})`);
      } catch (e) {
        console.error(`[store] db file stat/read failed:`, e);
      }
    } else {
      console.log(`[store] db file does not exist yet, will be created`);
    }

    // Try creating a fresh test SQLite db
    const testDbPath = resolve(dir, "__test__.db");
    try {
      const testDb = new Database(testDbPath);
      testDb.exec("CREATE TABLE t (id INTEGER)");
      testDb.close();
      unlinkSync(testDbPath);
      console.log(`[store] test SQLite db at ${testDbPath} SUCCEEDED`);
    } catch (e) {
      console.error(`[store] test SQLite db at ${testDbPath} FAILED:`, e);
    }
  } else {
    mkdirSync(dir, { recursive: true });
    console.log(`[store] created dir="${dir}"`);
  }

  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = new Database(dbPath);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");

      db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          wallet_address TEXT PRIMARY KEY,
          github_access_token TEXT,
          github_username TEXT
        );

        CREATE TABLE IF NOT EXISTS progress (
          challenge_idx INTEGER PRIMARY KEY,
          count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS processed_events (
          wallet_address TEXT NOT NULL,
          event_id TEXT NOT NULL,
          action TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          PRIMARY KEY (wallet_address, event_id)
        );

        CREATE INDEX IF NOT EXISTS idx_processed_events_timestamp
          ON processed_events (timestamp);
      `);

      return db;
    } catch (err: unknown) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === "SQLITE_CANTOPEN" && attempt < maxRetries) {
        console.warn(`[store] SQLITE_CANTOPEN on attempt ${attempt}/${maxRetries}, retrying in ${attempt}s...`);
        const waitMs = attempt * 1000;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

let _db: Database.Database | null = null;
function db(): Database.Database {
  if (!_db) _db = getDb();
  return _db;
}

// -- Account linking: walletAddress -> app credentials --

export interface GitHubCredentials {
  accessToken: string;
  username: string;
}

export interface AppCredentials {
  github?: GitHubCredentials;
}

function rowToCredentials(row: { github_access_token: string | null; github_username: string | null }): AppCredentials {
  const creds: AppCredentials = {};
  if (row.github_access_token && row.github_username) {
    creds.github = { accessToken: row.github_access_token, username: row.github_username };
  }
  return creds;
}

export function getAccount(walletAddress: string): AppCredentials | null {
  const row = db().prepare("SELECT github_access_token, github_username FROM accounts WHERE wallet_address = ?").get(walletAddress) as { github_access_token: string | null; github_username: string | null } | undefined;
  if (!row) return null;
  const creds = rowToCredentials(row);
  return Object.keys(creds).length > 0 ? creds : null;
}

export function setAccount(walletAddress: string, creds: Partial<AppCredentials>) {
  if (creds.github) {
    db().prepare(`
      INSERT INTO accounts (wallet_address, github_access_token, github_username)
      VALUES (?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        github_access_token = excluded.github_access_token,
        github_username = excluded.github_username
    `).run(walletAddress, creds.github.accessToken, creds.github.username);
  }
}

export function removeAccountApp(walletAddress: string, app: keyof AppCredentials) {
  if (app === "github") {
    db().prepare("UPDATE accounts SET github_access_token = NULL, github_username = NULL WHERE wallet_address = ?").run(walletAddress);
  }
}

export function getAllAccounts(): Record<string, AppCredentials> {
  const rows = db().prepare("SELECT wallet_address, github_access_token, github_username FROM accounts").all() as { wallet_address: string; github_access_token: string | null; github_username: string | null }[];
  const result: Record<string, AppCredentials> = {};
  for (const row of rows) {
    const creds = rowToCredentials(row);
    if (Object.keys(creds).length > 0) {
      result[row.wallet_address] = creds;
    }
  }
  return result;
}

// -- Challenge progress: challengeIdx -> cumulative count --

export function getProgress(challengeIdx: number): number {
  const row = db().prepare("SELECT count FROM progress WHERE challenge_idx = ?").get(challengeIdx) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function addProgress(challengeIdx: number, increment: number) {
  db().prepare(`
    INSERT INTO progress (challenge_idx, count) VALUES (?, ?)
    ON CONFLICT(challenge_idx) DO UPDATE SET count = count + excluded.count
  `).run(challengeIdx, increment);
}

export function getAllProgress(): Record<string, number> {
  const rows = db().prepare("SELECT challenge_idx, count FROM progress").all() as { challenge_idx: number; count: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[String(row.challenge_idx)] = row.count;
  }
  return result;
}

// -- Processed event deduplication --

export function filterAndMarkProcessed(
  walletAddress: string,
  eventIds: string[],
  action: string,
): string[] {
  if (eventIds.length === 0) return [];

  const txn = db().transaction(() => {
    const placeholders = eventIds.map(() => "?").join(",");
    const existingRows = db().prepare(
      `SELECT event_id FROM processed_events WHERE wallet_address = ? AND event_id IN (${placeholders})`,
    ).all(walletAddress, ...eventIds) as { event_id: string }[];

    const existingSet = new Set(existingRows.map((r) => r.event_id));
    const newIds = eventIds.filter((id) => !existingSet.has(id));
    if (newIds.length === 0) return [];

    const insert = db().prepare(
      "INSERT OR IGNORE INTO processed_events (wallet_address, event_id, action, timestamp) VALUES (?, ?, ?, ?)",
    );
    const now = Date.now();
    for (const id of newIds) {
      insert.run(walletAddress, id, action, now);
    }

    return newIds;
  });

  return txn();
}

export function cleanupProcessedEvents(maxAgeMs: number = 3600_000) {
  const cutoff = Date.now() - maxAgeMs;
  db().prepare("DELETE FROM processed_events WHERE timestamp < ?").run(cutoff);
}
