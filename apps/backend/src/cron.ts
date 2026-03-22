import cron from "node-cron";
import { Address } from "@ton/core";
import { getAllChallenges, type OnChainChallenge } from "./chain.js";
import { getAllAccounts, addChallengeEvents, getChallengeProgress, isChallengeClaimed, type AppCredentials } from "./store.js";
import { fetchUserEvents, extractEvents } from "./events.js";
import { fetchRecentAcceptedSubmissions, extractLeetCodeEvents, fetchUserStreak } from "./leetcode.js";
import { fetchRecentGames, extractChessComEvents } from "./chesscom.js";
import { fetchStravaActivities, extractStravaEvents, refreshStravaTokens } from "./strava.js";
import { autoClaimJob } from "./autoclaim.js";

function normalizeAddress(addr: string): string {
  try {
    return Address.parse(addr).toRawString();
  } catch {
    return addr.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
  }
}

type ActiveChallenge = OnChainChallenge & { index: number };

function collectAppUsers(
  app: string,
  activeChallenges: ActiveChallenge[],
  accounts: Record<string, AppCredentials>,
): Map<string, { wallet: string; username: string; token?: string }> {
  const users = new Map<string, { wallet: string; username: string; token?: string }>();

  for (const c of activeChallenges) {
    const parts = c.challengeId.split(":");
    if (parts.length < 3 || parts[0] !== app) continue;

    const normBeneficiary = normalizeAddress(c.beneficiary);
    if (users.has(normBeneficiary)) continue;

    const entry = Object.entries(accounts).find(
      ([w]) => normalizeAddress(w) === normBeneficiary,
    );
    if (!entry) continue;

    const creds = entry[1];
    if (app === "GITHUB" && creds.github) {
      users.set(normBeneficiary, { wallet: entry[0], username: creds.github.username, token: creds.github.accessToken });
    } else if (app === "LEETCODE" && creds.leetcode) {
      users.set(normBeneficiary, { wallet: entry[0], username: creds.leetcode.username });
    } else if (app === "CHESSCOM" && creds.chesscom) {
      users.set(normBeneficiary, { wallet: entry[0], username: creds.chesscom.username });
    } else if (app === "STRAVA" && creds.strava) {
      users.set(normBeneficiary, { wallet: entry[0], username: String(creds.strava.athleteId), token: creds.strava.accessToken });
    }
  }

  return users;
}

async function eventsProgressJob(): Promise<(OnChainChallenge & { index: number })[] | null> {
  let challenges;
  try {
    challenges = await getAllChallenges();
  } catch (err) {
    console.error("[cron] Failed to fetch challenges:", err);
    return null;
  }

  const now = Date.now() / 1000;
  const activeChallenges = challenges.filter((c) => {
    if (!c.active || c.endDate <= now) return false;
    if (isChallengeClaimed(c.index)) return false;
    const progress = getChallengeProgress(c.index);
    if (progress >= c.totalCheckpoints) return false;
    return true;
  });
  if (activeChallenges.length === 0) return;

  const accounts = getAllAccounts();

  // Group active challenges by app for logging
  const byApp: Record<string, ActiveChallenge[]> = {};
  for (const c of activeChallenges) {
    const app = c.challengeId.split(":")[0];
    if (!byApp[app]) byApp[app] = [];
    byApp[app].push(c);
  }
  for (const [app, list] of Object.entries(byApp)) {
    for (const c of list) {
      const action = c.challengeId.split(":")[1];
      const progress = getChallengeProgress(c.index);
      console.log(`[cron] [${app}] #${c.index} ${action} ${progress}/${c.totalCheckpoints}`);
    }
  }

  // --- GitHub ---
  const githubUsers = collectAppUsers("GITHUB", activeChallenges, accounts);
  const githubCache = new Map<string, Awaited<ReturnType<typeof fetchUserEvents>>>();

  for (const [normAddr, { username, token }] of githubUsers) {
    try {
      let allEvents;
      if (githubCache.has(username)) {
        allEvents = githubCache.get(username)!;
      } else {
        allEvents = await fetchUserEvents(username, token!);
        githubCache.set(username, allEvents);
      }

      const userChallenges = activeChallenges.filter((c) =>
        c.challengeId.startsWith("GITHUB:") && normalizeAddress(c.beneficiary) === normAddr,
      );

      for (const c of userChallenges) {
        const action = c.challengeId.split(":")[1];
        const since = new Date((c.createdAt + 60) * 1000);
        const filtered = extractEvents(allEvents, since);
        const entries = filtered[action] ?? [];

        if (entries.length > 0) {
          const newEntries = addChallengeEvents(c.index, entries);
          const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
          if (totalNew > 0) {
            const newProgress = getChallengeProgress(c.index);
            // Log with event timestamps
            const newIds = new Set(newEntries.map((e) => e.id));
            const matchedEvents = allEvents.filter((e) => {
              const eventEntries = extractEvents([e], since)[action];
              return eventEntries?.some((entry) => newIds.has(entry.id));
            });
            const timestamps = matchedEvents.map((e) => e.created_at).join(", ");
            console.log(`[cron] [GITHUB] #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints} since=${since.toISOString()} events=[${timestamps}]`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] [GITHUB] Failed for @${username}:`, err);
    }
  }

  // --- LeetCode ---
  const leetcodeUsers = collectAppUsers("LEETCODE", activeChallenges, accounts);

  for (const [normAddr, { username }] of leetcodeUsers) {
    try {
      const submissions = await fetchRecentAcceptedSubmissions(username);

      const userChallenges = activeChallenges.filter((c) =>
        c.challengeId.startsWith("LEETCODE:") && normalizeAddress(c.beneficiary) === normAddr,
      );

      const needsStreak = userChallenges.some((c) => c.challengeId.split(":")[1] === "MAINTAIN_STREAK");
      let streak = 0;
      if (needsStreak) {
        streak = await fetchUserStreak(username);
      }

      for (const c of userChallenges) {
        const action = c.challengeId.split(":")[1];
        const since = new Date((c.createdAt + 60) * 1000);

        if (action === "MAINTAIN_STREAK") {
          const currentProgress = getChallengeProgress(c.index);
          if (streak > currentProgress) {
            const entries = [{ id: `streak_${username}`, count: streak - currentProgress }];
            const newEntries = addChallengeEvents(c.index, entries);
            if (newEntries.length > 0) {
              const newProgress = getChallengeProgress(c.index);
              console.log(`[cron] [LEETCODE] #${c.index}: streak → ${newProgress}/${c.totalCheckpoints}`);
            }
          }
          continue;
        }

        const eventsByAction = await extractLeetCodeEvents(submissions, since);
        const entries = eventsByAction[action] ?? [];

        if (entries.length > 0) {
          const newEntries = addChallengeEvents(c.index, entries);
          const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
          if (totalNew > 0) {
            const newProgress = getChallengeProgress(c.index);
            console.log(`[cron] [LEETCODE] #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] [LEETCODE] Failed for @${username}:`, err);
    }
  }

  // --- Chess.com ---
  const chesscomUsers = collectAppUsers("CHESSCOM", activeChallenges, accounts);

  for (const [normAddr, { username }] of chesscomUsers) {
    try {
      const games = await fetchRecentGames(username);

      const userChallenges = activeChallenges.filter((c) =>
        c.challengeId.startsWith("CHESSCOM:") && normalizeAddress(c.beneficiary) === normAddr,
      );

      for (const c of userChallenges) {
        const action = c.challengeId.split(":")[1];
        const since = new Date((c.createdAt + 60) * 1000);
        const eventsByAction = extractChessComEvents(games, username, since);
        const entries = eventsByAction[action] ?? [];

        if (entries.length > 0) {
          const newEntries = addChallengeEvents(c.index, entries);
          const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
          if (totalNew > 0) {
            const newProgress = getChallengeProgress(c.index);
            console.log(`[cron] [CHESSCOM] #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] [CHESSCOM] Failed for @${username}:`, err);
    }
  }

  // --- Strava ---
  const stravaUsers = collectAppUsers("STRAVA", activeChallenges, accounts);

  for (const [normAddr, { wallet, username, token }] of stravaUsers) {
    try {
      const creds = Object.values(accounts).find((_, i) => {
        const w = Object.keys(accounts)[i];
        return normalizeAddress(w) === normAddr;
      });
      let accessToken = token!;
      if (creds?.strava && creds.strava.expiresAt <= Date.now()) {
        const refreshed = await refreshStravaTokens(creds.strava.refreshToken);
        accessToken = refreshed.accessToken;
        const walletKey = Object.keys(accounts).find((w) => normalizeAddress(w) === normAddr)!;
        const { setAccount } = await import("./store.js");
        setAccount(walletKey, {
          strava: { ...creds.strava, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, expiresAt: refreshed.expiresAt },
        });
      }

      const userChallenges = activeChallenges.filter((c) =>
        c.challengeId.startsWith("STRAVA:") && normalizeAddress(c.beneficiary) === normAddr,
      );
      const earliestSince = Math.min(...userChallenges.map((c) => c.createdAt));
      const activities = await fetchStravaActivities(accessToken, earliestSince);

      for (const c of userChallenges) {
        const action = c.challengeId.split(":")[1];
        const since = new Date((c.createdAt + 60) * 1000);
        const eventsByAction = extractStravaEvents(activities, since);
        const entries = eventsByAction[action] ?? [];

        if (entries.length > 0) {
          const newEntries = addChallengeEvents(c.index, entries);
          const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
          if (totalNew > 0) {
            const newProgress = getChallengeProgress(c.index);
            console.log(`[cron] [STRAVA] #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] [STRAVA] Failed for athlete ${username}:`, err);
    }
  }

  return challenges;
}

async function minuteJob() {
  const challenges = await eventsProgressJob();
  if (challenges) {
    await autoClaimJob(challenges);
  }
}

export function startCronJobs() {
  cron.schedule("* * * * *", () => {
    minuteJob().catch((err) => console.error("[cron] Minute job failed:", err));
  });

  console.log("[cron] Scheduled: minute poll");
}

// Export for manual trigger
export { minuteJob as progressJob };
