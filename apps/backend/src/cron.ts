import cron from "node-cron";
import { getAllChallenges, type OnChainChallenge } from "./chain.js";
import { getAllAccounts, addProgress, getProgress, filterAndMarkProcessed, cleanupProcessedEvents } from "./store.js";
import { fetchUserEvents, extractEvents } from "./events.js";

function normalizeAddress(addr: string): string {
  return addr.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
}

interface UserInfo {
  wallet: string;
  username: string;
  token: string;
}

function collectGitHubUsers(
  activeChallenges: (OnChainChallenge & { index: number })[],
  accounts: Record<string, { github?: { accessToken: string; username: string } }>,
): Map<string, UserInfo> {
  const users = new Map<string, UserInfo>();

  for (const c of activeChallenges) {
    const parts = c.challengeId.split(":");
    if (parts.length < 3 || parts[0] !== "GITHUB") continue;

    const normBeneficiary = normalizeAddress(c.beneficiary);
    if (users.has(normBeneficiary)) continue;

    const entry = Object.entries(accounts).find(
      ([w]) => normalizeAddress(w) === normBeneficiary,
    );

    if (entry?.[1].github) {
      users.set(normBeneficiary, {
        wallet: entry[0],
        username: entry[1].github.username,
        token: entry[1].github.accessToken,
      });
    }
  }

  return users;
}

/**
 * Core progress job: fetches GitHub Events API for each user with linked
 * credentials, deduplicates against already-processed events, and increments
 * challenge progress for any new activity.
 *
 * @param lookbackMs How far back to look for events (dedup prevents double-counting)
 */
async function eventsProgressJob(lookbackMs: number) {
  let challenges;
  try {
    challenges = await getAllChallenges();
  } catch (err) {
    console.error("[cron] Failed to fetch challenges:", err);
    return;
  }

  const now = Date.now() / 1000;
  const activeChallenges = challenges.filter((c) => c.active && c.endDate > now);
  if (activeChallenges.length === 0) return;

  const accounts = getAllAccounts();
  const users = collectGitHubUsers(activeChallenges, accounts);
  const since = new Date(Date.now() - lookbackMs);

  console.log(`[cron] ${activeChallenges.length} active challenges, ${users.size} linked users, lookback=${Math.round(lookbackMs / 60_000)}min`);

  for (const c of activeChallenges) {
    const [app, action, ...rest] = c.challengeId.split(":");
    console.log(`[cron]   Challenge #${c.index}: app=${app} action=${action} target=${c.totalCheckpoints} progress=${getProgress(c.index)} beneficiary=${c.beneficiary}`);
  }

  for (const [normAddr, { wallet, username, token }] of users) {
    try {
      const events = await fetchUserEvents(username, token);
      const eventsByAction = extractEvents(events, since);

      const actionSummary = Object.entries(eventsByAction)
        .map(([action, ids]) => `${action}=${ids.length}`)
        .join(", ");
      console.log(`[cron] @${username}: fetched ${events.length} events, matched: ${actionSummary || "none"}`);

      for (const [action, ids] of Object.entries(eventsByAction)) {
        const newIds = filterAndMarkProcessed(wallet, ids, action);

        const matching = activeChallenges.filter((c) => {
          const parts = c.challengeId.split(":");
          return parts[0] === "GITHUB" && parts[1] === action && normalizeAddress(c.beneficiary) === normAddr;
        });

        for (const c of matching) {
          const prevProgress = getProgress(c.index);
          if (newIds.length > 0) {
            addProgress(c.index, newIds.length);
          }
          const newProgress = getProgress(c.index);
          console.log(
            `[cron]   Challenge #${c.index} (${c.challengeId}): ` +
            `found ${ids.length} ${action}s, ${newIds.length} new → ` +
            `progress ${prevProgress} -> ${newProgress}/${c.totalCheckpoints}` +
            (newIds.length > 0 ? ` [${newIds.join(", ")}]` : ""),
          );
        }
      }
    } catch (err) {
      console.error(`[cron] Failed for @${username}:`, err);
    }
  }
}

/** Primary job: every minute, 5-minute lookback. */
async function minuteJob() {
  console.log("[cron] Starting minute job");
  await eventsProgressJob(5 * 60_000);
  console.log("[cron] Minute job done");
}

/** Catchup job: every 15 minutes, 1-hour lookback. */
async function catchupJob() {
  console.log("[cron] Starting catchup sweep (1-hour lookback)");
  await eventsProgressJob(60 * 60_000);
  console.log("[cron] Catchup sweep done");
}

export function startCronJobs() {
  // Primary: every minute
  cron.schedule("* * * * *", () => {
    minuteJob().catch((err) => console.error("[cron] Minute job failed:", err));
  });

  // Catchup: every 15 minutes with wider lookback for missed events
  cron.schedule("*/15 * * * *", () => {
    catchupJob().catch((err) => console.error("[cron] Catchup job failed:", err));
  });

  // Cleanup: every hour, remove processed events older than 2 hours
  cron.schedule("0 * * * *", () => {
    cleanupProcessedEvents(2 * 3600_000);
    console.log("[cron] Cleaned up old processed events");
  });

  console.log("[cron] Scheduled: minute poll, 15-min catchup, hourly cleanup");
}

// Export for manual trigger
export { minuteJob as progressJob };
