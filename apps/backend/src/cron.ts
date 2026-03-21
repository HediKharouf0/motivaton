import cron from "node-cron";
import { getAllChallenges } from "./chain.js";
import { getAllAccounts, addProgress } from "./store.js";
import { getGitHubDailyCount } from "./github.js";

function getPreviousMinuteRange(): string {
  const now = new Date();
  now.setUTCSeconds(0, 0);
  const start = new Date(now.getTime() - 60_000);
  return `${start.toISOString().slice(0, 19)}Z..${new Date(start.getTime() + 59_000).toISOString().slice(0, 19)}Z`;
}

function normalizeAddress(addr: string): string {
  return addr.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
}

async function dailyProgressJob() {
  const date = getPreviousMinuteRange();
  console.log(`[cron] Progress job for ${date}`);

  let challenges;
  try {
    challenges = await getAllChallenges();
  } catch (err) {
    console.error("[cron] Failed to fetch challenges:", err);
    return;
  }

  // Filter: active and not yet expired
  const now = Date.now() / 1000;
  const activeChallenges = challenges.filter((c) => c.active && c.endDate > now);
  console.log(`[cron] ${activeChallenges.length} active challenges out of ${challenges.length} total`);

  if (activeChallenges.length === 0) return;

  // Load all linked accounts
  const accounts = getAllAccounts();

  // Group challenges by (normalized beneficiary, app, action)
  // so we query each GitHub user's action only once
  const grouped = new Map<
    string,
    { beneficiary: string; app: string; action: string; indices: number[] }
  >();

  for (const c of activeChallenges) {
    const parts = c.challengeId.split(":");
    if (parts.length < 3) continue;
    const [app, action] = parts;
    const normBeneficiary = normalizeAddress(c.beneficiary);
    const key = `${normBeneficiary}:${app}:${action}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.indices.push(c.index);
    } else {
      grouped.set(key, { beneficiary: c.beneficiary, app, action, indices: [c.index] });
    }
  }

  for (const [key, group] of grouped) {
    if (group.app !== "GITHUB") continue;

    // Find the GitHub credentials for this beneficiary
    const normBeneficiary = normalizeAddress(group.beneficiary);
    const creds = Object.entries(accounts).find(
      ([wallet]) => normalizeAddress(wallet) === normBeneficiary,
    );

    if (!creds || !creds[1].github) {
      console.log(`[cron] No GitHub credentials for beneficiary ${group.beneficiary.slice(0, 12)}... (${key})`);
      continue;
    }

    const { accessToken, username } = creds[1].github;

    try {
      const count = await getGitHubDailyCount(group.action, username, accessToken, date);
      console.log(`[cron] @${username} ${group.action} on ${date}: ${count}`);

      if (count > 0) {
        for (const idx of group.indices) {
          addProgress(idx, count);
          console.log(`[cron] Challenge #${idx}: +${count}`);
        }
      }
    } catch (err) {
      console.error(`[cron] Failed to query GitHub for @${username} ${group.action}:`, err);
    }
  }

  console.log(`[cron] Daily progress job completed`);
}

export function startCronJobs() {
  // Every minute
  cron.schedule("* * * * *", () => {
    dailyProgressJob().catch((err) => {
      console.error("[cron] Progress job failed:", err);
    });
  });

  console.log("[cron] Scheduled progress job (every minute)");
}

// Export for manual trigger (e.g., testing endpoint)
export { dailyProgressJob };
