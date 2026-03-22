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
      github_username TEXT,
      leetcode_username TEXT,
      chesscom_username TEXT
    );

    CREATE TABLE IF NOT EXISTS challenge_events (
      challenge_idx INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (challenge_idx, event_id)
    );

    CREATE TABLE IF NOT EXISTS challenge_claims (
      challenge_idx INTEGER PRIMARY KEY,
      claimed_at INTEGER NOT NULL
    );
  `);

  // Migrations
  const eventCols = db.prepare("PRAGMA table_info(challenge_events)").all() as { name: string }[];
  if (!eventCols.some((c) => c.name === "count")) {
    db.exec("ALTER TABLE challenge_events ADD COLUMN count INTEGER NOT NULL DEFAULT 1");
  }
  const accountCols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!accountCols.some((c) => c.name === "leetcode_username")) {
    db.exec("ALTER TABLE accounts ADD COLUMN leetcode_username TEXT");
  }
  if (!accountCols.some((c) => c.name === "chesscom_username")) {
    db.exec("ALTER TABLE accounts ADD COLUMN chesscom_username TEXT");
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

export interface LeetCodeCredentials {
  username: string;
}

export interface ChessComCredentials {
  username: string;
}

export interface AppCredentials {
  github?: GitHubCredentials;
  leetcode?: LeetCodeCredentials;
  chesscom?: ChessComCredentials;
}

interface AccountRow {
  github_access_token: string | null;
  github_username: string | null;
  leetcode_username: string | null;
  chesscom_username: string | null;
}

function rowToCredentials(row: AccountRow): AppCredentials {
  const creds: AppCredentials = {};
  if (row.github_access_token && row.github_username) {
    creds.github = { accessToken: row.github_access_token, username: row.github_username };
  }
  if (row.leetcode_username) {
    creds.leetcode = { username: row.leetcode_username };
  }
  if (row.chesscom_username) {
    creds.chesscom = { username: row.chesscom_username };
  }
  return creds;
}

export function getAccount(walletAddress: string): AppCredentials | null {
  const row = db().prepare("SELECT github_access_token, github_username, leetcode_username, chesscom_username FROM accounts WHERE wallet_address = ?").get(walletAddress) as AccountRow | undefined;
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
  if (creds.leetcode) {
    db().prepare(`
      INSERT INTO accounts (wallet_address, leetcode_username)
      VALUES (?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        leetcode_username = excluded.leetcode_username
    `).run(walletAddress, creds.leetcode.username);
  }
  if (creds.chesscom) {
    db().prepare(`
      INSERT INTO accounts (wallet_address, chesscom_username)
      VALUES (?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        chesscom_username = excluded.chesscom_username
    `).run(walletAddress, creds.chesscom.username);
  }
}

export function removeAccountApp(walletAddress: string, app: keyof AppCredentials) {
  if (app === "github") {
    db().prepare("UPDATE accounts SET github_access_token = NULL, github_username = NULL WHERE wallet_address = ?").run(walletAddress);
  }
  if (app === "leetcode") {
    db().prepare("UPDATE accounts SET leetcode_username = NULL WHERE wallet_address = ?").run(walletAddress);
  }
  if (app === "chesscom") {
    db().prepare("UPDATE accounts SET chesscom_username = NULL WHERE wallet_address = ?").run(walletAddress);
  }
}

export function getAllAccounts(): Record<string, AppCredentials> {
  const rows = db().prepare("SELECT wallet_address, github_access_token, github_username, leetcode_username, chesscom_username FROM accounts").all() as (AccountRow & { wallet_address: string })[];
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
  const row = db().prepare("SELECT COALESCE(SUM(count), 0) as total FROM challenge_events WHERE challenge_idx = ?").get(challengeIdx) as { total: number | bigint };
  return Number(row.total);
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

// -- Challenge claims --

export function markChallengeClaimed(challengeIdx: number) {
  db().prepare("INSERT OR IGNORE INTO challenge_claims (challenge_idx, claimed_at) VALUES (?, ?)").run(challengeIdx, Date.now());
}

export function isChallengeClaimed(challengeIdx: number): boolean {
  const row = db().prepare("SELECT 1 FROM challenge_claims WHERE challenge_idx = ?").get(challengeIdx);
  return row != null;
}

export function getAllClaimed(): Record<string, boolean> {
  const rows = db().prepare("SELECT challenge_idx FROM challenge_claims").all() as { challenge_idx: number }[];
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    result[String(row.challenge_idx)] = true;
  }
  return result;
}
