import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(import.meta.dirname, "../data");
const ACCOUNTS_FILE = resolve(DATA_DIR, "accounts.json");
const PROGRESS_FILE = resolve(DATA_DIR, "progress.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(path: string, data: unknown) {
  ensureDir();
  writeFileSync(path, JSON.stringify(data, null, 2));
}

// -- Account linking: walletAddress -> app credentials --

export interface GitHubCredentials {
  accessToken: string;
  username: string;
}

export interface AppCredentials {
  github?: GitHubCredentials;
}

export function getAccount(walletAddress: string): AppCredentials | null {
  const accounts = readJson<Record<string, AppCredentials>>(ACCOUNTS_FILE, {});
  return accounts[walletAddress] || null;
}

export function setAccount(walletAddress: string, creds: Partial<AppCredentials>) {
  const accounts = readJson<Record<string, AppCredentials>>(ACCOUNTS_FILE, {});
  accounts[walletAddress] = { ...accounts[walletAddress], ...creds };
  writeJson(ACCOUNTS_FILE, accounts);
}

export function removeAccountApp(walletAddress: string, app: keyof AppCredentials) {
  const accounts = readJson<Record<string, AppCredentials>>(ACCOUNTS_FILE, {});
  if (accounts[walletAddress]) {
    delete accounts[walletAddress][app];
    writeJson(ACCOUNTS_FILE, accounts);
  }
}

export function getAllAccounts(): Record<string, AppCredentials> {
  return readJson<Record<string, AppCredentials>>(ACCOUNTS_FILE, {});
}

// -- Challenge progress: challengeIdx -> cumulative count --

export function getProgress(challengeIdx: number): number {
  const progress = readJson<Record<string, number>>(PROGRESS_FILE, {});
  return progress[String(challengeIdx)] || 0;
}

export function addProgress(challengeIdx: number, increment: number) {
  const progress = readJson<Record<string, number>>(PROGRESS_FILE, {});
  const key = String(challengeIdx);
  progress[key] = (progress[key] || 0) + increment;
  writeJson(PROGRESS_FILE, progress);
}

export function getAllProgress(): Record<string, number> {
  return readJson<Record<string, number>>(PROGRESS_FILE, {});
}
