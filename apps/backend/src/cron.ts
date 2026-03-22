import cron from "node-cron";
import { Address } from "@ton/core";
import { getAllChallenges, type OnChainChallenge } from "./chain.js";
import { getAllAccounts, addChallengeEvents, getChallengeProgress, isChallengeClaimed, type AppCredentials } from "./store.js";
import { fetchUserEvents, extractEvents } from "./events.js";
import { fetchRecentAcceptedSubmissions, extractLeetCodeEvents, fetchUserStreak } from "./leetcode.js";
import { fetchRecentGames, extractChessComEvents } from "./chesscom.js";

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
    }
  }

  return users;
}

function processChallengeEntries(
  challenges: ActiveChallenge[],
  normAddr: string,
  app: string,
  eventsByAction: Record<string, { id: string; count: number }[]>,
) {
  const userChallenges = challenges.filter((c) => {
    const parts = c.challengeId.split(":");
    return parts[0] === app && normalizeAddress(c.beneficiary) === normAddr;
  });

  for (const c of userChallenges) {
    const action = c.challengeId.split(":")[1];
    const since = new Date(c.createdAt * 1000);
    // eventsByAction is already filtered by since at the call site for GitHub,
    // but for LeetCode we filter here too
    const entries = eventsByAction[action] ?? [];

    if (entries.length > 0) {
      const newEntries = addChallengeEvents(c.index, entries);
      const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
      if (totalNew > 0) {
        const newProgress = getChallengeProgress(c.index);
        console.log(`[cron] Challenge #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
      }
    }
  }
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
  const activeChallenges = challenges.filter((c) => {
    if (!c.active || c.endDate <= now) return false;
    if (isChallengeClaimed(c.index)) return false;
    const progress = getChallengeProgress(c.index);
    if (progress >= c.totalCheckpoints) return false;
    return true;
  });
  if (activeChallenges.length === 0) return;

  const accounts = getAllAccounts();

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

      // Find earliest challenge createdAt for this user to filter events
      const userChallenges = activeChallenges.filter((c) =>
        c.challengeId.startsWith("GITHUB:") && normalizeAddress(c.beneficiary) === normAddr,
      );
      const earliestSince = new Date(Math.min(...userChallenges.map((c) => c.createdAt * 1000)));
      const eventsByAction = extractEvents(allEvents, earliestSince);

      // Re-filter per challenge since each may have a different createdAt
      for (const c of userChallenges) {
        const action = c.challengeId.split(":")[1];
        const since = new Date(c.createdAt * 1000);
        const filtered = extractEvents(allEvents, since);
        const entries = filtered[action] ?? [];

        if (entries.length > 0) {
          const newEntries = addChallengeEvents(c.index, entries);
          const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
          if (totalNew > 0) {
            const newProgress = getChallengeProgress(c.index);
            console.log(`[cron] Challenge #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] Failed to fetch GitHub events for @${username}:`, err);
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

      // Check if any challenge needs streak data
      const needsStreak = userChallenges.some((c) => c.challengeId.split(":")[1] === "MAINTAIN_STREAK");
      let streak = 0;
      if (needsStreak) {
        streak = await fetchUserStreak(username);
      }

      for (const c of userChallenges) {
        const action = c.challengeId.split(":")[1];
        const since = new Date(c.createdAt * 1000);

        if (action === "MAINTAIN_STREAK") {
          // Streak is a current value, not event-based. Store as a single entry with the streak count.
          // Use a stable ID so we update rather than accumulate.
          const currentProgress = getChallengeProgress(c.index);
          if (streak > currentProgress) {
            // Reset and store the new streak value
            const entries = [{ id: `streak_${username}`, count: streak - currentProgress }];
            const newEntries = addChallengeEvents(c.index, entries);
            if (newEntries.length > 0) {
              const newProgress = getChallengeProgress(c.index);
              console.log(`[cron] Challenge #${c.index}: streak ${newProgress}/${c.totalCheckpoints}`);
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
            console.log(`[cron] Challenge #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] Failed to fetch LeetCode submissions for @${username}:`, err);
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
        const since = new Date(c.createdAt * 1000);
        const eventsByAction = extractChessComEvents(games, username, since);
        const entries = eventsByAction[action] ?? [];

        if (entries.length > 0) {
          const newEntries = addChallengeEvents(c.index, entries);
          const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
          if (totalNew > 0) {
            const newProgress = getChallengeProgress(c.index);
            console.log(`[cron] Challenge #${c.index}: +${totalNew} ${action} → ${newProgress}/${c.totalCheckpoints}`);
          }
        }
      }
    } catch (err) {
      console.error(`[cron] Failed to fetch Chess.com games for @${username}:`, err);
    }
  }
}

async function minuteJob() {
  await eventsProgressJob();
}

export function startCronJobs() {
  cron.schedule("* * * * *", () => {
    minuteJob().catch((err) => console.error("[cron] Minute job failed:", err));
  });

  console.log("[cron] Scheduled: minute poll");
}

// Export for manual trigger
export { minuteJob as progressJob };
