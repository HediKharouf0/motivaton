import { createHash } from "crypto";

const GITHUB_API = "https://api.github.com";

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface EventEntry {
  id: string;
  count: number;
}

interface ActionEntries {
  action: string;
  entries: EventEntry[];
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function extractActions(event: GitHubEvent): ActionEntries[] {
  const results: ActionEntries[] = [];
  const payload = event.payload;

  switch (event.type) {
    case "PushEvent": {
      const commits = payload.commits as { sha: string }[] | undefined;
      if (commits?.length) {
        // Public repo: commits array available, use hash + actual count
        results.push({ action: "COMMIT", entries: [{ id: hashPayload(payload), count: commits.length }] });
      } else {
        // Private repo: no commits array, use hash + 1
        results.push({ action: "COMMIT", entries: [{ id: hashPayload(payload), count: 1 }] });
      }
      break;
    }
    case "IssuesEvent":
      if (payload.action === "opened") {
        results.push({ action: "OPEN_ISSUE", entries: [{ id: event.id, count: 1 }] });
      }
      break;
    case "PullRequestEvent":
      if (payload.action === "opened") {
        results.push({ action: "CREATE_PR", entries: [{ id: event.id, count: 1 }] });
      } else if (payload.action === "closed" && (payload.pull_request as { merged?: boolean })?.merged) {
        results.push({ action: "MERGE_PR", entries: [{ id: event.id, count: 1 }] });
      }
      break;
    case "PullRequestReviewEvent":
      results.push({ action: "REVIEW", entries: [{ id: event.id, count: 1 }] });
      break;
  }
  return results;
}

export async function fetchUserEvents(username: string, token: string): Promise<GitHubEvent[]> {
  const resp = await fetch(`${GITHUB_API}/users/${username}/events?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!resp.ok) throw new Error(`GitHub Events API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

/**
 * Groups events by action type, returning only those after `since`.
 * Does not deduplicate — caller should use addChallengeEvents for that.
 */
export function extractEvents(
  events: GitHubEvent[],
  since: Date,
): Record<string, EventEntry[]> {
  const result: Record<string, EventEntry[]> = {};
  for (const event of events) {
    if (new Date(event.created_at) < since) continue;
    for (const { action, entries } of extractActions(event)) {
      if (!result[action]) result[action] = [];
      result[action].push(...entries);
    }
  }
  return result;
}
