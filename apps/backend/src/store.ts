import Database from "better-sqlite3";
import { mkdirSync, existsSync, statSync, rmSync } from "fs";
import { resolve, dirname } from "path";

export interface EventEntry {
  id: string;
  count: number;
}

function getDbPath(): string {
  return process.env.DATABASE_PATH || resolve(import.meta.dirname, "../data/motivaton.db");
}

function getDb(): Database.Database {
  const dbPath = getDbPath();
  console.log(`[store] Opening SQLite at: ${dbPath}`);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Guard: if dbPath is a directory (broken mount artifact), remove it
  if (existsSync(dbPath) && statSync(dbPath).isDirectory()) {
    console.warn(`[store] ${dbPath} is a directory, not a file — removing so SQLite can create the db`);
    rmSync(dbPath, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      wallet_address TEXT PRIMARY KEY,
      github_access_token TEXT,
      github_username TEXT
    );

    CREATE TABLE IF NOT EXISTS challenge_events (
      challenge_idx INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (challenge_idx, event_id)
    );
  `);

  // Migration: add count column if missing (table created before this column existed)
  const cols = db.prepare("PRAGMA table_info(challenge_events)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "count")) {
    db.exec("ALTER TABLE challenge_events ADD COLUMN count INTEGER NOT NULL DEFAULT 1");
  }

  return db;
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

// -- Challenge events: per-challenge event tracking and deduplication --

export function addChallengeEvents(challengeIdx: number, entries: EventEntry[]): EventEntry[] {
  if (entries.length === 0) return [];

  const txn = db().transaction(() => {
    const ids = entries.map((e) => e.id);
    const placeholders = ids.map(() => "?").join(",");
    const existingRows = db().prepare(
      `SELECT event_id FROM challenge_events WHERE challenge_idx = ? AND event_id IN (${placeholders})`,
    ).all(challengeIdx, ...ids) as { event_id: string }[];

    const existingSet = new Set(existingRows.map((r) => r.event_id));
    const newEntries = entries.filter((e) => !existingSet.has(e.id));
    if (newEntries.length === 0) return [];

    const insert = db().prepare(
      "INSERT OR IGNORE INTO challenge_events (challenge_idx, event_id, count) VALUES (?, ?, ?)",
    );
    for (const e of newEntries) {
      insert.run(challengeIdx, e.id, e.count);
    }

    return newEntries;
  });

  return txn();
}

export function getChallengeProgress(challengeIdx: number): number {
  const row = db().prepare("SELECT COALESCE(SUM(count), 0) as total FROM challenge_events WHERE challenge_idx = ?").get(challengeIdx) as { total: number };
  return row.total;
}

export function getChallengeEvents(challengeIdx: number): EventEntry[] {
  return db().prepare("SELECT event_id as id, count FROM challenge_events WHERE challenge_idx = ?").all(challengeIdx) as EventEntry[];
}

export function getAllProgress(): Record<string, number> {
  const rows = db().prepare("SELECT challenge_idx, COALESCE(SUM(count), 0) as total FROM challenge_events GROUP BY challenge_idx").all() as { challenge_idx: number; total: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[String(row.challenge_idx)] = row.total;
  }
  return result;
}
