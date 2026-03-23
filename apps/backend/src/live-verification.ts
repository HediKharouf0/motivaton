import { Address } from "@ton/core";
import { type OnChainChallenge } from "./chain.js";
import { getAllAccounts, setAccount, type AppCredentials } from "./store.js";
import { extractEvents, fetchUserEventsSince } from "./events.js";
import { fetchRecentAcceptedSubmissions, extractLeetCodeEvents, fetchUserStreak } from "./leetcode.js";
import { extractChessComEvents, fetchGamesSince } from "./chesscom.js";
import { extractStravaEvents, fetchStravaActivities, refreshStravaTokens } from "./strava.js";

type LiveVerificationResult = {
  verified: boolean;
  currentCount: number;
  targetCount: number;
  message: string;
};

function normalizeAddress(addr: string): string {
  try {
    return Address.parse(addr).toRawString();
  } catch {
    return addr.replace(/[-_]/g, (char) => (char === "-" ? "+" : "/"));
  }
}

function getLinkedAccount(walletAddress: string): { wallet: string; creds: AppCredentials } | null {
  const normalized = normalizeAddress(walletAddress);
  const entry = Object.entries(getAllAccounts()).find(([wallet]) => normalizeAddress(wallet) === normalized);
  if (!entry) return null;
  return { wallet: entry[0], creds: entry[1] };
}

function buildResult(currentCount: number, targetCount: number, noun: string): LiveVerificationResult {
  const verified = currentCount >= targetCount;
  return {
    verified,
    currentCount,
    targetCount,
    message: verified
      ? `Matched ${currentCount}/${targetCount} ${noun} in the challenge window.`
      : `Matched ${currentCount}/${targetCount} ${noun} in the challenge window.`,
  };
}

export async function verifyChallengeFromLiveEvents(
  challenge: OnChainChallenge,
  targetCount: number,
): Promise<LiveVerificationResult> {
  const [app = "", action = ""] = challenge.challengeId.split(":");
  const linked = getLinkedAccount(challenge.beneficiary);
  const since = new Date((challenge.createdAt + 60) * 1000);

  if (!linked) {
    return {
      verified: false,
      currentCount: 0,
      targetCount,
      message: "No linked account found for the challenge beneficiary.",
    };
  }

  switch (app) {
    case "GITHUB": {
      if (!linked.creds.github) {
        return {
          verified: false,
          currentCount: 0,
          targetCount,
          message: "GitHub is not connected for the challenge beneficiary.",
        };
      }
      const events = await fetchUserEventsSince(linked.creds.github.username, linked.creds.github.accessToken, since);
      const entries = extractEvents(events, since)[action] ?? [];
      const currentCount = entries.reduce((sum, entry) => sum + entry.count, 0);
      return buildResult(currentCount, targetCount, "matching GitHub events");
    }
    case "LEETCODE": {
      if (!linked.creds.leetcode) {
        return {
          verified: false,
          currentCount: 0,
          targetCount,
          message: "LeetCode is not connected for the challenge beneficiary.",
        };
      }
      if (action === "MAINTAIN_STREAK") {
        const streak = await fetchUserStreak(linked.creds.leetcode.username);
        return buildResult(streak, targetCount, "streak days");
      }
      const submissions = await fetchRecentAcceptedSubmissions(linked.creds.leetcode.username, 200);
      const entries = (await extractLeetCodeEvents(submissions, since))[action] ?? [];
      const currentCount = entries.reduce((sum, entry) => sum + entry.count, 0);
      return buildResult(currentCount, targetCount, "matching LeetCode submissions");
    }
    case "CHESSCOM": {
      if (!linked.creds.chesscom) {
        return {
          verified: false,
          currentCount: 0,
          targetCount,
          message: "Chess.com is not connected for the challenge beneficiary.",
        };
      }
      const games = await fetchGamesSince(linked.creds.chesscom.username, since);
      const entries = extractChessComEvents(games, linked.creds.chesscom.username, since)[action] ?? [];
      const currentCount = entries.reduce((sum, entry) => sum + entry.count, 0);
      return buildResult(currentCount, targetCount, "matching Chess.com games");
    }
    case "STRAVA": {
      if (!linked.creds.strava) {
        return {
          verified: false,
          currentCount: 0,
          targetCount,
          message: "Strava is not connected for the challenge beneficiary.",
        };
      }

      let accessToken = linked.creds.strava.accessToken;
      if (linked.creds.strava.expiresAt <= Date.now()) {
        const refreshed = await refreshStravaTokens(linked.creds.strava.refreshToken);
        accessToken = refreshed.accessToken;
        setAccount(linked.wallet, {
          strava: {
            ...linked.creds.strava,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt,
          },
        });
      }

      const activities = await fetchStravaActivities(accessToken, challenge.createdAt);
      const entries = extractStravaEvents(activities, since)[action] ?? [];
      const currentCount = entries.reduce((sum, entry) => sum + entry.count, 0);
      return buildResult(currentCount, targetCount, "matching Strava activities");
    }
    default:
      return {
        verified: false,
        currentCount: 0,
        targetCount,
        message: `Live event verification is not supported for ${app}.`,
      };
  }
}

export async function getLiveChallengeProgress(challenge: OnChainChallenge): Promise<number> {
  const result = await verifyChallengeFromLiveEvents(challenge, challenge.totalCheckpoints);
  return result.currentCount;
}
