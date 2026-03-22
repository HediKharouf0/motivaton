import { Address } from "@ton/core";
import type { OnChainChallenge } from "./chain.js";
import { fetchUserEvents, type GitHubEvent } from "./events.js";
import { fetchStravaActivities, refreshStravaTokens } from "./strava.js";
import { getAllAccounts, setAccount, type AppCredentials } from "./store.js";

type InspectionProvider = "COCOON" | "HEURISTIC";

export interface AchievementInspection {
  provider: InspectionProvider;
  blocked: true;
  shortReason: string;
  summary: string;
}

interface GitHubEvidenceItem {
  kind: "commit" | "issue" | "pull_request" | "review";
  repo: string;
  createdAt: string;
  title?: string;
  body?: string;
  state?: string;
  commitCount?: number;
  commitMessages?: string[];
}

interface StravaEvidenceItem {
  name: string;
  type: string;
  startDate: string;
  distanceKm: number;
  movingMinutes: number;
}

type CocoonDecision = {
  blocked: boolean;
  shortReason: string;
  summary: string;
};

const LOW_SIGNAL_TEXTS = new Set([
  "fix",
  "fixes",
  "update",
  "updates",
  "wip",
  "tmp",
  "test",
  "tests",
  "misc",
  "change",
  "changes",
  "work",
  "cleanup",
]);

function getCocoonApiUrl(): string {
  return (process.env.COCOON_API_URL || "").trim().replace(/\/$/, "");
}

function getCocoonRequestUrl(): string {
  const url = getCocoonApiUrl();
  if (!url) return "";
  return /\/v1\/chat\/completions$/i.test(url) ? url : `${url}/v1/chat/completions`;
}

function getCocoonModel(): string {
  return (process.env.COCOON_MODEL || "").trim();
}

function getCocoonApiKey(): string {
  return (process.env.COCOON_API_KEY || "").trim();
}

function isCocoonConfigured() {
  return getCocoonApiUrl() !== "" && getCocoonModel() !== "";
}

function normalizeAddress(addr: string): string {
  try {
    return Address.parse(addr).toRawString();
  } catch {
    return addr.replace(/[-_]/g, (char) => (char === "-" ? "+" : "/"));
  }
}

function compactText(value: unknown, maxLength = 140): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function clampReason(value: string, fallback: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return fallback;
  const words = compact.split(" ").slice(0, 6).join(" ");
  return words || fallback;
}

function block(provider: InspectionProvider, shortReason: string, summary: string): AchievementInspection {
  return {
    provider,
    blocked: true,
    shortReason: clampReason(shortReason, "Achievement blocked"),
    summary,
  };
}

function isLowSignalText(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return true;
  if (normalized.length <= 4) return true;
  return LOW_SIGNAL_TEXTS.has(normalized);
}

function getLinkedAccount(walletAddress: string): { wallet: string; creds: AppCredentials } | null {
  const normalized = normalizeAddress(walletAddress);
  const entry = Object.entries(getAllAccounts()).find(([wallet]) => normalizeAddress(wallet) === normalized);
  if (!entry) return null;
  return { wallet: entry[0], creds: entry[1] };
}

function getChallengeParts(challenge: OnChainChallenge) {
  const [app = "", action = ""] = challenge.challengeId.split(":");
  return { app, action };
}

function extractGitHubEvidence(events: GitHubEvent[], action: string, since: Date): GitHubEvidenceItem[] {
  const evidence: GitHubEvidenceItem[] = [];

  for (const rawEvent of events) {
    const event = rawEvent as GitHubEvent & {
      repo?: { name?: string };
      payload: Record<string, unknown> & {
        action?: string;
        commits?: Array<{ message?: string }>;
        issue?: { title?: string; body?: string };
        pull_request?: { title?: string; body?: string; merged?: boolean };
        review?: { body?: string; state?: string };
        merged?: boolean;
        size?: number;
      };
    };

    if (new Date(event.created_at) < since) continue;

    if (action === "COMMIT" && event.type === "PushEvent") {
      const commitMessages = Array.isArray(event.payload.commits)
        ? event.payload.commits
            .map((commit) => compactText(commit.message, 90))
            .filter((value): value is string => Boolean(value))
        : [];

      evidence.push({
        kind: "commit",
        repo: event.repo?.name || "Unknown repo",
        createdAt: event.created_at,
        commitCount:
          typeof event.payload.size === "number"
            ? event.payload.size
            : commitMessages.length > 0
              ? commitMessages.length
              : 1,
        commitMessages,
      });
    }

    if (action === "OPEN_ISSUE" && event.type === "IssuesEvent" && event.payload.action === "opened") {
      evidence.push({
        kind: "issue",
        repo: event.repo?.name || "Unknown repo",
        createdAt: event.created_at,
        title: compactText(event.payload.issue?.title, 100),
        body: compactText(event.payload.issue?.body, 140),
      });
    }

    if (action === "CREATE_PR" && event.type === "PullRequestEvent" && event.payload.action === "opened") {
      evidence.push({
        kind: "pull_request",
        repo: event.repo?.name || "Unknown repo",
        createdAt: event.created_at,
        title: compactText(event.payload.pull_request?.title, 100),
        body: compactText(event.payload.pull_request?.body, 140),
      });
    }

    if (
      action === "MERGE_PR" &&
      event.type === "PullRequestEvent" &&
      (event.payload.action === "closed" || event.payload.action === "merged") &&
      (event.payload.pull_request?.merged === true || event.payload.merged === true)
    ) {
      evidence.push({
        kind: "pull_request",
        repo: event.repo?.name || "Unknown repo",
        createdAt: event.created_at,
        title: compactText(event.payload.pull_request?.title, 100),
        body: compactText(event.payload.pull_request?.body, 140),
        state: "merged",
      });
    }

    if (action === "REVIEW" && event.type === "PullRequestReviewEvent") {
      evidence.push({
        kind: "review",
        repo: event.repo?.name || "Unknown repo",
        createdAt: event.created_at,
        body: compactText(event.payload.review?.body, 140),
        state: compactText(event.payload.review?.state, 40),
      });
    }
  }

  evidence.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return evidence.slice(0, 5);
}

function extractStravaEvidence(
  activities: Array<{
    name: string;
    type: string;
    sport_type: string;
    start_date: string;
    distance: number;
    moving_time: number;
  }>,
  action: string,
  since: Date,
): StravaEvidenceItem[] {
  const evidence = activities
    .filter((activity) => new Date(activity.start_date) >= since)
    .filter((activity) => {
      const type = (activity.sport_type || activity.type || "").toLowerCase();
      if (action === "LOG_ACTIVITY" || action === "LOG_KM") return true;
      if (action === "RUN") return type === "run";
      if (action === "RIDE") return type === "ride" || type === "virtualride";
      if (action === "SWIM") return type === "swim";
      if (action === "WALK") return type === "walk" || type === "hike";
      return true;
    })
    .map((activity) => ({
      name: compactText(activity.name, 90) || "Untitled activity",
      type: activity.sport_type || activity.type || "Activity",
      startDate: activity.start_date,
      distanceKm: Math.round((activity.distance / 1000) * 100) / 100,
      movingMinutes: Math.round((activity.moving_time / 60) * 10) / 10,
    }))
    .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime());

  return evidence.slice(0, 5);
}

function heuristicGitHubBlock(evidence: GitHubEvidenceItem[]): AchievementInspection | null {
  if (evidence.length === 0) return null;

  const commitMessages = evidence.flatMap((item) => item.commitMessages || []);
  const titles = evidence.map((item) => item.title).filter((value): value is string => Boolean(value));

  if (
    commitMessages.length > 0 &&
    commitMessages.every((message) => isLowSignalText(message)) &&
    titles.every((title) => isLowSignalText(title))
  ) {
    return block(
      "HEURISTIC",
      "Messages too generic",
      "Recent GitHub text looks too low-signal to count.",
    );
  }

  return null;
}

function getStravaMinimums(action: string) {
  switch (action) {
    case "RIDE":
      return { distanceKm: 1.5, movingMinutes: 5 };
    case "RUN":
      return { distanceKm: 0.6, movingMinutes: 5 };
    case "WALK":
      return { distanceKm: 0.5, movingMinutes: 8 };
    case "SWIM":
      return { distanceKm: 0.1, movingMinutes: 5 };
    case "LOG_KM":
      return { distanceKm: 1, movingMinutes: 5 };
    default:
      return { distanceKm: 0.4, movingMinutes: 5 };
  }
}

function heuristicStravaBlock(action: string, evidence: StravaEvidenceItem[]): AchievementInspection | null {
  if (evidence.length === 0) return null;

  const minimums = getStravaMinimums(action);
  const hasMeaningfulActivity = evidence.some(
    (item) => item.distanceKm >= minimums.distanceKm && item.movingMinutes >= minimums.movingMinutes,
  );

  if (!hasMeaningfulActivity) {
    return block(
      "HEURISTIC",
      "Activity too small",
      "Recent Strava activity is too small to count.",
    );
  }

  return null;
}

function extractDecisionJson(raw: string): string {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseCocoonDecision(raw: string): CocoonDecision | null {
  try {
    const parsed = JSON.parse(extractDecisionJson(raw)) as {
      blocked?: unknown;
      shortReason?: unknown;
      summary?: unknown;
    };

    if (typeof parsed.blocked !== "boolean") return null;

    return {
      blocked: parsed.blocked,
      shortReason: clampReason(typeof parsed.shortReason === "string" ? parsed.shortReason : "", "Achievement blocked"),
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : parsed.blocked
            ? "Cocoon flagged the achievement."
            : "No fishy signal found.",
    };
  } catch {
    return null;
  }
}

function getMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const text = (item as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n")
    .trim();
}

async function askCocoon(payload: Record<string, unknown>): Promise<AchievementInspection | null> {
  if (!isCocoonConfigured()) return null;

  const resp = await fetch(getCocoonRequestUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getCocoonApiKey() ? { Authorization: `Bearer ${getCocoonApiKey()}` } : {}),
    },
    body: JSON.stringify({
      model: getCocoonModel(),
      temperature: 0.1,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "You are a last-layer fraud detector for productivity challenges. You are not allowed to approve rewards. You only decide whether the evidence looks fishy enough to block counting it. Return JSON only with keys blocked, shortReason, summary. blocked must be true only for suspicious or clearly low-signal achievements. shortReason must be 2 to 6 words. summary must stay under 18 words.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Cocoon API ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const raw = getMessageContent(data.choices?.[0]?.message?.content);
  const decision = parseCocoonDecision(raw);

  if (!decision || !decision.blocked) return null;

  return {
    provider: "COCOON",
    blocked: true,
    shortReason: decision.shortReason,
    summary: decision.summary,
  };
}

async function inspectGitHubAchievement(challenge: OnChainChallenge): Promise<AchievementInspection | null> {
  const linked = getLinkedAccount(challenge.beneficiary);
  if (!linked?.creds.github) return null;

  const { action } = getChallengeParts(challenge);
  const events = await fetchUserEvents(linked.creds.github.username, linked.creds.github.accessToken);
  const evidence = extractGitHubEvidence(events, action, new Date(challenge.createdAt * 1000));

  const heuristicBlock = heuristicGitHubBlock(evidence);
  if (heuristicBlock) return heuristicBlock;

  return askCocoon({
    app: "GitHub",
    action,
    challengeId: challenge.challengeId,
    evidence,
  }).catch((error) => {
    console.error("[cocoon] GitHub inspection failed:", error);
    return null;
  });
}

async function inspectStravaAchievement(challenge: OnChainChallenge): Promise<AchievementInspection | null> {
  const linked = getLinkedAccount(challenge.beneficiary);
  if (!linked?.creds.strava) return null;

  const { action } = getChallengeParts(challenge);
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
  const evidence = extractStravaEvidence(activities, action, new Date(challenge.createdAt * 1000));

  const heuristicBlock = heuristicStravaBlock(action, evidence);
  if (heuristicBlock) return heuristicBlock;

  return askCocoon({
    app: "Strava",
    action,
    challengeId: challenge.challengeId,
    evidence,
  }).catch((error) => {
    console.error("[cocoon] Strava inspection failed:", error);
    return null;
  });
}

export async function inspectChallengeAchievement(challenge: OnChainChallenge): Promise<AchievementInspection | null> {
  const { app } = getChallengeParts(challenge);

  try {
    if (app === "GITHUB") {
      return await inspectGitHubAchievement(challenge);
    }

    if (app === "STRAVA") {
      return await inspectStravaAchievement(challenge);
    }

    return null;
  } catch (error) {
    console.error("[cocoon] Achievement inspection failed:", error);
    return null;
  }
}
