import { Address } from "@ton/core";
import type { OnChainChallenge } from "./chain.js";
import { fetchUserEvents, type GitHubEvent } from "./events.js";
import { fetchStravaActivities, refreshStravaTokens } from "./strava.js";
import { getAllAccounts, setAccount, type AppCredentials } from "./store.js";

type InspectionProvider = "OPENAI" | "ANTHROPIC" | "DEEPSEEK" | "COCOON" | "HEURISTIC";
type RemoteInspectionProvider = Exclude<InspectionProvider, "HEURISTIC">;

export interface AchievementInspection {
  provider: string;
  blocked: true;
  shortReason: string;
  summary: string;
}

interface GitHubCommitDetail {
  sha: string;
  message?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  files?: string[];
  patchSnippets?: string[];
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
  commitDetails?: GitHubCommitDetail[];
}

interface StravaEvidenceItem {
  name: string;
  type: string;
  startDate: string;
  distanceKm: number;
  movingMinutes: number;
}

type Decision = {
  blocked: boolean;
  shortReason: string;
  summary: string;
};

interface RemoteInspectorConfig {
  provider: RemoteInspectionProvider;
  model: string;
  apiKey?: string;
  requestUrl: string;
  anthropicVersion?: string;
}

const GITHUB_API = "https://api.github.com";
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
  "empty",
  "minor",
  "quick fix",
]);

function normalizeEnv(value: string | undefined): string {
  return (value || "").trim();
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return normalizeEnv(value) || fallback;
}

function appendApiPath(baseUrl: string, path: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  if (normalized.endsWith(path)) return normalized;
  if (normalized.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${normalized}${path.slice(3)}`;
  }
  return `${normalized}${path}`;
}

function getRequestedInspectorProvider(): string {
  return normalizeEnv(process.env.AI_INSPECTOR_PROVIDER).toUpperCase();
}

function getCocoonApiUrl(): string {
  return normalizeEnv(process.env.COCOON_API_URL).replace(/\/$/, "");
}

function getCocoonRequestUrl(): string {
  const url = getCocoonApiUrl();
  if (!url) return "";
  return /\/v1\/chat\/completions$/i.test(url) ? url : `${url}/v1/chat/completions`;
}

function getCocoonModel(): string {
  return normalizeEnv(process.env.COCOON_MODEL);
}

function getCocoonApiKey(): string {
  return normalizeEnv(process.env.COCOON_API_KEY);
}

function isCocoonConfigured() {
  return getCocoonApiUrl() !== "" && getCocoonModel() !== "";
}

function getDefaultModel(provider: RemoteInspectionProvider): string {
  switch (provider) {
    case "OPENAI":
      return "gpt-5.4";
    case "ANTHROPIC":
      return "claude-sonnet-4-20250514";
    case "DEEPSEEK":
      return "deepseek-chat";
    case "COCOON":
      return getCocoonModel();
  }
}

function getConfiguredModel(provider: RemoteInspectionProvider): string {
  const shared = normalizeEnv(process.env.AI_INSPECTOR_MODEL);
  if (provider === "OPENAI") {
    return normalizeEnv(process.env.OPENAI_INSPECTOR_MODEL) || shared || getDefaultModel(provider);
  }
  if (provider === "ANTHROPIC") {
    return normalizeEnv(process.env.ANTHROPIC_INSPECTOR_MODEL) || shared || getDefaultModel(provider);
  }
  if (provider === "DEEPSEEK") {
    return normalizeEnv(process.env.DEEPSEEK_INSPECTOR_MODEL) || shared || getDefaultModel(provider);
  }
  return getDefaultModel(provider);
}

function getPrimaryInspectorConfig(): RemoteInspectorConfig | null {
  const requested = getRequestedInspectorProvider();

  const candidates: RemoteInspectionProvider[] =
    requested === "OPENAI" || requested === "ANTHROPIC" || requested === "DEEPSEEK"
      ? [requested]
      : ["OPENAI", "ANTHROPIC", "DEEPSEEK"];

  for (const provider of candidates) {
    if (provider === "OPENAI") {
      const apiKey = normalizeEnv(process.env.OPENAI_API_KEY);
      if (!apiKey) continue;
      return {
        provider,
        apiKey,
        model: getConfiguredModel(provider),
        requestUrl: appendApiPath(
          normalizeBaseUrl(process.env.OPENAI_BASE_URL, "https://api.openai.com"),
          "/v1/chat/completions",
        ),
      };
    }

    if (provider === "ANTHROPIC") {
      const apiKey = normalizeEnv(process.env.ANTHROPIC_API_KEY);
      if (!apiKey) continue;
      return {
        provider,
        apiKey,
        model: getConfiguredModel(provider),
        requestUrl: appendApiPath(
          normalizeBaseUrl(process.env.ANTHROPIC_BASE_URL, "https://api.anthropic.com"),
          "/v1/messages",
        ),
        anthropicVersion: normalizeEnv(process.env.ANTHROPIC_VERSION) || "2023-06-01",
      };
    }

    if (provider === "DEEPSEEK") {
      const apiKey = normalizeEnv(process.env.DEEPSEEK_API_KEY);
      if (!apiKey) continue;
      return {
        provider,
        apiKey,
        model: getConfiguredModel(provider),
        requestUrl: appendApiPath(
          normalizeBaseUrl(process.env.DEEPSEEK_BASE_URL, "https://api.deepseek.com"),
          "/chat/completions",
        ),
      };
    }
  }

  return null;
}

function getCocoonInspectorConfig(): RemoteInspectorConfig | null {
  if (!isCocoonConfigured()) return null;
  return {
    provider: "COCOON",
    apiKey: getCocoonApiKey() || undefined,
    model: getConfiguredModel("COCOON"),
    requestUrl: getCocoonRequestUrl(),
  };
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
  const [app = "", action = "", rawCount = "0"] = challenge.challengeId.split(":");
  return { app, action, count: Number.parseInt(rawCount, 10) || 0 };
}

async function fetchGitHubCommitDetail(
  repo: string,
  sha: string,
  token: string,
): Promise<GitHubCommitDetail | null> {
  const resp = await fetch(`${GITHUB_API}/repos/${repo}/commits/${sha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!resp.ok) {
    return null;
  }

  const data = (await resp.json()) as {
    sha?: string;
    commit?: { message?: string };
    stats?: { additions?: number; deletions?: number; total?: number };
    files?: Array<{ filename?: string; patch?: string }>;
  };

  return {
    sha: data.sha || sha,
    message: compactText(data.commit?.message, 90),
    additions: typeof data.stats?.additions === "number" ? data.stats.additions : undefined,
    deletions: typeof data.stats?.deletions === "number" ? data.stats.deletions : undefined,
    changedFiles: Array.isArray(data.files) ? data.files.length : undefined,
    files: Array.isArray(data.files)
      ? data.files
          .map((file) => compactText(file.filename, 40))
          .filter((value): value is string => Boolean(value))
          .slice(0, 4)
      : undefined,
    patchSnippets: Array.isArray(data.files)
      ? data.files
          .map((file) => {
            const filename = compactText(file.filename, 40) || "file";
            const patch = compactText(file.patch, 220);
            return patch ? `${filename}: ${patch}` : undefined;
          })
          .filter((value): value is string => Boolean(value))
          .slice(0, 3)
      : undefined,
  };
}

async function extractGitHubEvidence(
  events: GitHubEvent[],
  action: string,
  since: Date,
  token: string,
): Promise<GitHubEvidenceItem[]> {
  const evidence: GitHubEvidenceItem[] = [];
  let commitLookupBudget = 4;

  for (const rawEvent of events) {
    const event = rawEvent as GitHubEvent & {
      repo?: { name?: string };
      payload: Record<string, unknown> & {
        action?: string;
        commits?: Array<{ sha?: string; message?: string }>;
        issue?: { title?: string; body?: string };
        pull_request?: { title?: string; body?: string; merged?: boolean };
        review?: { body?: string; state?: string };
        merged?: boolean;
        size?: number;
      };
    };

    if (new Date(event.created_at) < since) continue;

    if (action === "COMMIT" && event.type === "PushEvent") {
      const repo = event.repo?.name || "Unknown repo";
      const commitMessages = Array.isArray(event.payload.commits)
        ? event.payload.commits
            .map((commit) => compactText(commit.message, 90))
            .filter((value): value is string => Boolean(value))
        : [];

      const commitRefs = Array.isArray(event.payload.commits)
        ? event.payload.commits
            .flatMap((commit) => {
              const sha = compactText(commit.sha, 40);
              if (!sha) return [];
              return [
                {
                  sha,
                  message: compactText(commit.message, 90),
                },
              ];
            })
        : [];

      let commitDetails: GitHubCommitDetail[] = [];
      if (commitLookupBudget > 0 && commitRefs.length > 0 && repo !== "Unknown repo") {
        const refs = commitRefs.slice(0, commitLookupBudget);
        commitLookupBudget -= refs.length;
        const lookedUp = await Promise.all(
          refs.map(async (commit) => {
            const detail = await fetchGitHubCommitDetail(repo, commit.sha, token).catch(() => null);
            return detail ?? { sha: commit.sha, message: commit.message };
          }),
        );
        commitDetails = lookedUp.filter((item): item is GitHubCommitDetail => Boolean(item));
      }

      evidence.push({
        kind: "commit",
        repo,
        createdAt: event.created_at,
        commitCount:
          typeof event.payload.size === "number"
            ? event.payload.size
            : commitMessages.length > 0
              ? commitMessages.length
              : 1,
        commitMessages,
        commitDetails,
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
  const commitDetails = evidence.flatMap((item) => item.commitDetails || []);
  const titles = evidence.map((item) => item.title).filter((value): value is string => Boolean(value));

  if (commitDetails.length > 0) {
    const allZeroDiff = commitDetails.every(
      (detail) => (detail.additions ?? 0) + (detail.deletions ?? 0) === 0 && (detail.changedFiles ?? 0) === 0,
    );
    if (allZeroDiff) {
      return block("HEURISTIC", "No real code changes", "Recent GitHub commits show no file changes.");
    }

    const allTinyDiff = commitDetails.every((detail) => {
      const totalDiff = (detail.additions ?? 0) + (detail.deletions ?? 0);
      return totalDiff <= 2 && (detail.changedFiles ?? 0) <= 1;
    });

    if (allTinyDiff && commitDetails.every((detail) => isLowSignalText(detail.message))) {
      return block("HEURISTIC", "Commits look empty", "Recent GitHub commits look tiny and low-signal.");
    }

    const noVisibleContent = commitDetails.every(
      (detail) =>
        (!detail.files || detail.files.length === 0) &&
        (!detail.patchSnippets || detail.patchSnippets.length === 0),
    );
    if (noVisibleContent && commitDetails.every((detail) => isLowSignalText(detail.message))) {
      return block("HEURISTIC", "No useful commit content", "Recent GitHub commits expose no useful code change evidence.");
    }
  }

  if (
    commitMessages.length > 0 &&
    commitMessages.every((message) => isLowSignalText(message)) &&
    titles.every((title) => isLowSignalText(title))
  ) {
    return block("HEURISTIC", "Messages too generic", "Recent GitHub text looks too generic to count.");
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
    return block("HEURISTIC", "Activity too small", "Recent Strava activity is too small to count.");
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

function parseDecision(raw: string): Decision | null {
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
            ? "Suspicious activity was flagged."
            : "No suspicious signal found.",
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

function buildSystemPrompt(): string {
  return [
    "You are a last-layer fraud detector for productivity challenges.",
    "You are never allowed to approve or grant a reward.",
    "The ordinary verifier already decides progress.",
    "You only decide whether the evidence is fishy enough to block counting it.",
    "Block only for suspicious, empty, spammy, trivially tiny, or obviously low-signal achievements.",
    "If the work looks real, blocked must be false.",
    "Return JSON only with keys blocked, shortReason, summary.",
    "shortReason must be 2 to 6 words.",
    "summary must stay under 18 words.",
  ].join(" ");
}

function buildInspectionPayload(
  appLabel: string,
  action: string,
  challenge: OnChainChallenge,
  evidence: GitHubEvidenceItem[] | StravaEvidenceItem[],
) {
  return {
    app: appLabel,
    action,
    challengeId: challenge.challengeId,
    totalCheckpoints: challenge.totalCheckpoints,
    claimedCount: challenge.claimedCount,
    createdAt: new Date(challenge.createdAt * 1000).toISOString(),
    evidence,
  };
}

async function askOpenAI(config: RemoteInspectorConfig, payload: Record<string, unknown>): Promise<Decision | null> {
  const resp = await fetch(config.requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI API ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return parseDecision(getMessageContent(data.choices?.[0]?.message?.content));
}

async function askAnthropic(config: RemoteInspectorConfig, payload: Record<string, unknown>): Promise<Decision | null> {
  const resp = await fetch(config.requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey || "",
      "anthropic-version": config.anthropicVersion || "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system: buildSystemPrompt(),
      max_tokens: 180,
      messages: [
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Anthropic API ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    content?: unknown;
  };
  return parseDecision(getMessageContent(data.content));
}

async function askDeepSeek(config: RemoteInspectorConfig, payload: Record<string, unknown>): Promise<Decision | null> {
  const resp = await fetch(config.requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`DeepSeek API ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return parseDecision(getMessageContent(data.choices?.[0]?.message?.content));
}

async function askCocoon(config: RemoteInspectorConfig, payload: Record<string, unknown>): Promise<Decision | null> {
  const resp = await fetch(config.requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
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
  return parseDecision(getMessageContent(data.choices?.[0]?.message?.content));
}

async function askRemoteInspector(
  config: RemoteInspectorConfig,
  payload: Record<string, unknown>,
): Promise<AchievementInspection | null> {
  const decision =
    config.provider === "OPENAI"
      ? await askOpenAI(config, payload)
      : config.provider === "ANTHROPIC"
        ? await askAnthropic(config, payload)
        : config.provider === "DEEPSEEK"
          ? await askDeepSeek(config, payload)
          : await askCocoon(config, payload);

  if (!decision || !decision.blocked) return null;

  return {
    provider: config.provider,
    blocked: true,
    shortReason: decision.shortReason,
    summary: decision.summary,
  };
}

async function runRemoteInspectors(payload: Record<string, unknown>): Promise<AchievementInspection | null> {
  const inspectors = [getPrimaryInspectorConfig(), getCocoonInspectorConfig()].filter(
    (config): config is RemoteInspectorConfig => Boolean(config),
  );

  if (inspectors.length === 0) return null;

  const settled = await Promise.allSettled(
    inspectors.map(async (config) => {
      try {
        return await askRemoteInspector(config, payload);
      } catch (error) {
        console.error(`[ai-inspector] ${config.provider} inspection failed:`, error);
        return null;
      }
    }),
  );

  const blocked = settled
    .flatMap((item) => (item.status === "fulfilled" && item.value ? [item.value] : []));

  if (blocked.length === 0) return null;
  if (blocked.length === 1) return blocked[0];

  const preferred = blocked.find((item) => item.provider !== "COCOON") ?? blocked[0];
  return {
    provider: blocked.map((item) => item.provider).join("+"),
    blocked: true,
    shortReason: preferred.shortReason,
    summary: `${blocked.map((item) => item.provider).join(" + ")} flagged this achievement.`,
  };
}

async function inspectGitHubAchievement(challenge: OnChainChallenge): Promise<AchievementInspection | null> {
  const linked = getLinkedAccount(challenge.beneficiary);
  if (!linked?.creds.github) return null;

  const { action } = getChallengeParts(challenge);
  const events = await fetchUserEvents(linked.creds.github.username, linked.creds.github.accessToken);
  const evidence = await extractGitHubEvidence(
    events,
    action,
    new Date(challenge.createdAt * 1000),
    linked.creds.github.accessToken,
  );

  const heuristicBlock = heuristicGitHubBlock(evidence);
  if (heuristicBlock) return heuristicBlock;

  return runRemoteInspectors(buildInspectionPayload("GitHub", action, challenge, evidence));
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

  return runRemoteInspectors(buildInspectionPayload("Strava", action, challenge, evidence));
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
    console.error("[ai-inspector] Achievement inspection failed:", error);
    return null;
  }
}
