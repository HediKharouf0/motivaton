import Database from "better-sqlite3";
import { mkdirSync, existsSync, statSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { Address } from "@ton/core";

export interface EventEntry {
  id: string;
  count: number;
}

function getContractAddress(): string {
  return process.env.CONTRACT_ADDRESS || "";
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
      chesscom_username TEXT,
      strava_access_token TEXT,
      strava_refresh_token TEXT,
      strava_expires_at INTEGER,
      strava_athlete_id INTEGER,
      telegram_chat_id TEXT
    );

    CREATE TABLE IF NOT EXISTS challenge_events (
      contract_address TEXT NOT NULL,
      challenge_idx INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (contract_address, challenge_idx, event_id)
    );

    CREATE TABLE IF NOT EXISTS challenge_claims (
      contract_address TEXT NOT NULL,
      challenge_idx INTEGER NOT NULL,
      claimed_at INTEGER NOT NULL,
      PRIMARY KEY (contract_address, challenge_idx)
    );

    CREATE TABLE IF NOT EXISTS challenge_groups (
      contract_address TEXT NOT NULL,
      challenge_idx INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      PRIMARY KEY (contract_address, challenge_idx, chat_id)
    );

    CREATE TABLE IF NOT EXISTS challenge_notifications (
      contract_address TEXT NOT NULL,
      challenge_idx INTEGER NOT NULL,
      notification_type TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      PRIMARY KEY (contract_address, challenge_idx, notification_type)
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
  if (!accountCols.some((c) => c.name === "telegram_chat_id")) {
    db.exec("ALTER TABLE accounts ADD COLUMN telegram_chat_id TEXT");
  }
  if (!accountCols.some((c) => c.name === "strava_access_token")) {
    db.exec("ALTER TABLE accounts ADD COLUMN strava_access_token TEXT");
    db.exec("ALTER TABLE accounts ADD COLUMN strava_refresh_token TEXT");
    db.exec("ALTER TABLE accounts ADD COLUMN strava_expires_at INTEGER");
    db.exec("ALTER TABLE accounts ADD COLUMN strava_athlete_id INTEGER");
  }

  // Migration: add contract_address to challenge tables (stale data from old contracts is dropped)
  if (!eventCols.some((c) => c.name === "contract_address")) {
    console.log("[store] Migrating challenge tables to include contract_address — dropping stale data");
    db.exec(`
      DROP TABLE IF EXISTS challenge_events;
      CREATE TABLE challenge_events (
        contract_address TEXT NOT NULL,
        challenge_idx INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (contract_address, challenge_idx, event_id)
      );
      DROP TABLE IF EXISTS challenge_claims;
      CREATE TABLE challenge_claims (
        contract_address TEXT NOT NULL,
        challenge_idx INTEGER NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (contract_address, challenge_idx)
      );
      DROP TABLE IF EXISTS challenge_groups;
      CREATE TABLE challenge_groups (
        contract_address TEXT NOT NULL,
        challenge_idx INTEGER NOT NULL,
        chat_id TEXT NOT NULL,
        PRIMARY KEY (contract_address, challenge_idx, chat_id)
      );
      DROP TABLE IF EXISTS challenge_notifications;
      CREATE TABLE challenge_notifications (
        contract_address TEXT NOT NULL,
        challenge_idx INTEGER NOT NULL,
        notification_type TEXT NOT NULL,
        sent_at INTEGER NOT NULL,
        PRIMARY KEY (contract_address, challenge_idx, notification_type)
      );
    `);
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

export interface StravaCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId: number;
}

export interface AppCredentials {
  github?: GitHubCredentials;
  leetcode?: LeetCodeCredentials;
  chesscom?: ChessComCredentials;
  strava?: StravaCredentials;
}

interface AccountRow {
  github_access_token: string | null;
  github_username: string | null;
  leetcode_username: string | null;
  chesscom_username: string | null;
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  strava_expires_at: number | null;
  strava_athlete_id: number | null;
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
  if (row.strava_access_token && row.strava_refresh_token && row.strava_athlete_id) {
    creds.strava = {
      accessToken: row.strava_access_token,
      refreshToken: row.strava_refresh_token,
      expiresAt: row.strava_expires_at ?? 0,
      athleteId: row.strava_athlete_id,
    };
  }
  return creds;
}

export function getAccount(walletAddress: string): AppCredentials | null {
  const row = db().prepare("SELECT github_access_token, github_username, leetcode_username, chesscom_username, strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete_id FROM accounts WHERE wallet_address = ?").get(walletAddress) as AccountRow | undefined;
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
  if (creds.strava) {
    db().prepare(`
      INSERT INTO accounts (wallet_address, strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        strava_access_token = excluded.strava_access_token,
        strava_refresh_token = excluded.strava_refresh_token,
        strava_expires_at = excluded.strava_expires_at,
        strava_athlete_id = excluded.strava_athlete_id
    `).run(walletAddress, creds.strava.accessToken, creds.strava.refreshToken, creds.strava.expiresAt, creds.strava.athleteId);
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
  if (app === "strava") {
    db().prepare("UPDATE accounts SET strava_access_token = NULL, strava_refresh_token = NULL, strava_expires_at = NULL, strava_athlete_id = NULL WHERE wallet_address = ?").run(walletAddress);
  }
}

export function getAllAccounts(): Record<string, AppCredentials> {
  const rows = db().prepare("SELECT wallet_address, github_access_token, github_username, leetcode_username, chesscom_username, strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete_id FROM accounts").all() as (AccountRow & { wallet_address: string })[];
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
  const addr = getContractAddress();

  const txn = db().transaction(() => {
    const ids = entries.map((e) => e.id);
    const placeholders = ids.map(() => "?").join(",");
    const existingRows = db().prepare(
      `SELECT event_id FROM challenge_events WHERE contract_address = ? AND challenge_idx = ? AND event_id IN (${placeholders})`,
    ).all(addr, challengeIdx, ...ids) as { event_id: string }[];

    const existingSet = new Set(existingRows.map((r) => r.event_id));
    const newEntries = entries.filter((e) => !existingSet.has(e.id));
    if (newEntries.length === 0) return [];

    const insert = db().prepare(
      "INSERT OR IGNORE INTO challenge_events (contract_address, challenge_idx, event_id, count) VALUES (?, ?, ?, ?)",
    );
    for (const e of newEntries) {
      insert.run(addr, challengeIdx, e.id, e.count);
    }

    return newEntries;
  });

  return txn();
}

export function getChallengeProgress(challengeIdx: number): number {
  const addr = getContractAddress();
  const row = db().prepare("SELECT COALESCE(SUM(count), 0) as total FROM challenge_events WHERE contract_address = ? AND challenge_idx = ?").get(addr, challengeIdx) as { total: number | bigint };
  return Number(row.total);
}

export function getChallengeEvents(challengeIdx: number): EventEntry[] {
  const addr = getContractAddress();
  return db().prepare("SELECT event_id as id, count FROM challenge_events WHERE contract_address = ? AND challenge_idx = ?").all(addr, challengeIdx) as EventEntry[];
}

export function getAllProgress(): Record<string, number> {
  const addr = getContractAddress();
  const rows = db().prepare("SELECT challenge_idx, COALESCE(SUM(count), 0) as total FROM challenge_events WHERE contract_address = ? GROUP BY challenge_idx").all(addr) as { challenge_idx: number; total: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[String(row.challenge_idx)] = row.total;
  }
  return result;
}

// -- Challenge claims --

export function markChallengeClaimed(challengeIdx: number) {
  const addr = getContractAddress();
  db().prepare("INSERT OR IGNORE INTO challenge_claims (contract_address, challenge_idx, claimed_at) VALUES (?, ?, ?)").run(addr, challengeIdx, Date.now());
}

export function clearChallengeClaimed(challengeIdx: number) {
  const addr = getContractAddress();
  db().prepare("DELETE FROM challenge_claims WHERE contract_address = ? AND challenge_idx = ?").run(addr, challengeIdx);
}

export function isChallengeClaimed(challengeIdx: number): boolean {
  const addr = getContractAddress();
  const row = db().prepare("SELECT 1 FROM challenge_claims WHERE contract_address = ? AND challenge_idx = ?").get(addr, challengeIdx);
  return row != null;
}

export function getAllClaimed(): Record<string, boolean> {
  const addr = getContractAddress();
  const rows = db().prepare("SELECT challenge_idx FROM challenge_claims WHERE contract_address = ?").all(addr) as { challenge_idx: number }[];
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    result[String(row.challenge_idx)] = true;
  }
  return result;
}

// -- Telegram chat ID --

export function setTelegramChatId(walletAddress: string, chatId: string) {
  db().prepare(`
    INSERT INTO accounts (wallet_address, telegram_chat_id)
    VALUES (?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      telegram_chat_id = excluded.telegram_chat_id
  `).run(walletAddress, chatId);
}

export function getTelegramChatId(walletAddress: string): string | null {
  const row = db().prepare("SELECT telegram_chat_id FROM accounts WHERE wallet_address = ?").get(walletAddress) as { telegram_chat_id: string | null } | undefined;
  return row?.telegram_chat_id ?? null;
}

export function getTelegramChatIdByBeneficiary(beneficiaryRaw: string): string | null {
  const rows = db().prepare("SELECT wallet_address, telegram_chat_id FROM accounts WHERE telegram_chat_id IS NOT NULL").all() as { wallet_address: string; telegram_chat_id: string }[];
  for (const row of rows) {
    try {
      if (Address.parse(row.wallet_address).toRawString() === beneficiaryRaw) {
        return row.telegram_chat_id;
      }
    } catch {}
  }
  return null;
}

// -- Challenge group chats --

export function addChallengeGroup(challengeIdx: number, chatId: string) {
  const addr = getContractAddress();
  db().prepare("INSERT OR IGNORE INTO challenge_groups (contract_address, challenge_idx, chat_id) VALUES (?, ?, ?)").run(addr, challengeIdx, chatId);
}

export function getChallengeGroups(challengeIdx: number): string[] {
  const addr = getContractAddress();
  const rows = db().prepare("SELECT chat_id FROM challenge_groups WHERE contract_address = ? AND challenge_idx = ?").all(addr, challengeIdx) as { chat_id: string }[];
  return rows.map((r) => r.chat_id);
}

// -- Challenge notification tracking --

export function hasNotificationBeenSent(challengeIdx: number, type: string): boolean {
  const addr = getContractAddress();
  const row = db().prepare("SELECT 1 FROM challenge_notifications WHERE contract_address = ? AND challenge_idx = ? AND notification_type = ?").get(addr, challengeIdx, type);
  return row != null;
}

export function markNotificationSent(challengeIdx: number, type: string) {
  const addr = getContractAddress();
  db().prepare("INSERT OR IGNORE INTO challenge_notifications (contract_address, challenge_idx, notification_type, sent_at) VALUES (?, ?, ?, ?)").run(addr, challengeIdx, type, Date.now());
}
