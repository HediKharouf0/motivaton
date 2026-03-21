import cron from "node-cron";
import { Address } from "@ton/core";
import { getAllChallenges, type OnChainChallenge } from "./chain.js";
import { getAllAccounts, addChallengeEvents, getChallengeProgress } from "./store.js";
import { fetchUserEvents, extractEvents } from "./events.js";

function normalizeAddress(addr: string): string {
  try {
    return Address.parse(addr).toRawString();
  } catch {
    return addr.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
  }
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

async function eventsProgressJob() {
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

  console.log(`[cron] ${activeChallenges.length} active challenges, ${users.size} linked users`);

  for (const c of activeChallenges) {
    const [app, action] = c.challengeId.split(":");
    console.log(`[cron]   Challenge #${c.index}: app=${app} action=${action} target=${c.totalCheckpoints} progress=${getChallengeProgress(c.index)} beneficiary=${c.beneficiary}`);
  }

  // Cache fetched events per user (avoid duplicate API calls)
  const userEventsCache = new Map<string, Awaited<ReturnType<typeof fetchUserEvents>>>();

  for (const [normAddr, { wallet, username, token }] of users) {
    let allEvents;
    try {
      if (userEventsCache.has(username)) {
        allEvents = userEventsCache.get(username)!;
      } else {
        allEvents = await fetchUserEvents(username, token);
        userEventsCache.set(username, allEvents);
      }
    } catch (err) {
      console.error(`[cron] Failed to fetch events for @${username}:`, err);
      continue;
    }

    console.log(`[cron] @${username}: ${allEvents.length} total events`);

    // Process each challenge for this user
    const userChallenges = activeChallenges.filter((c) => {
      const parts = c.challengeId.split(":");
      return parts[0] === "GITHUB" && normalizeAddress(c.beneficiary) === normAddr;
    });

    for (const c of userChallenges) {
      const action = c.challengeId.split(":")[1];
      const since = new Date(c.createdAt * 1000);
      const eventsByAction = extractEvents(allEvents, since);
      const entries = eventsByAction[action] ?? [];

      const totalFound = entries.reduce((sum, e) => sum + e.count, 0);
      const prevProgress = getChallengeProgress(c.index);
      const newEntries = addChallengeEvents(c.index, entries);
      const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
      const newProgress = getChallengeProgress(c.index);

      console.log(
        `[cron]   Challenge #${c.index} (${c.challengeId}): ` +
        `since=${since.toISOString()} found ${totalFound} ${action}s (${entries.length} events), ${totalNew} new → ` +
        `progress ${prevProgress} -> ${newProgress}/${c.totalCheckpoints}` +
        (newEntries.length > 0 ? ` [${newEntries.map((e) => `${e.id}(${e.count})`).join(", ")}]` : ""),
      );
    }
  }
}

async function minuteJob() {
  console.log("[cron] Starting minute job");
  await eventsProgressJob();
  console.log("[cron] Minute job done");
}

export function startCronJobs() {
  cron.schedule("* * * * *", () => {
    minuteJob().catch((err) => console.error("[cron] Minute job failed:", err));
  });

  console.log("[cron] Scheduled: minute poll");
}

// Export for manual trigger
export { minuteJob as progressJob };
