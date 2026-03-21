const GITHUB_API = "https://api.github.com";

async function ghFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

async function searchCount(query: string, token: string, accept?: string): Promise<number> {
  const resp = await fetch(`${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&per_page=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!resp.ok) throw new Error(`GitHub Search API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.total_count;
}

async function searchCommitCount(query: string, token: string): Promise<number> {
  const resp = await fetch(`${GITHUB_API}/search/commits?q=${encodeURIComponent(query)}&per_page=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.cloak-preview+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!resp.ok) throw new Error(`GitHub Search Commits API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.total_count;
}

export type GitHubAction = "COMMIT" | "OPEN_ISSUE" | "CREATE_PR" | "MERGE_PR" | "REVIEW";

export const SUPPORTED_GITHUB_ACTIONS: GitHubAction[] = [
  "COMMIT",
  "OPEN_ISSUE",
  "CREATE_PR",
  "MERGE_PR",
  "REVIEW",
];

/**
 * Returns the count for a specific GitHub action on a given date.
 * @param action - One of the supported GitHub actions
 * @param username - GitHub username
 * @param token - GitHub OAuth access token
 * @param date - YYYY-MM-DD format
 */
export async function getGitHubDailyCount(
  action: string,
  username: string,
  token: string,
  date: string,
): Promise<number> {
  switch (action) {
    case "COMMIT":
      return searchCommitCount(`author:${username} author-date:${date}`, token);
    case "OPEN_ISSUE":
      return searchCount(`author:${username} type:issue created:${date}`, token);
    case "CREATE_PR":
      return searchCount(`author:${username} type:pr created:${date}`, token);
    case "MERGE_PR":
      return searchCount(`author:${username} type:pr is:merged merged:${date}`, token);
    case "REVIEW":
      return searchCount(`reviewed-by:${username} type:pr reviewed:${date}`, token);
    default:
      console.warn(`[github] Unknown action: ${action}`);
      return 0;
  }
}

/**
 * Fetches counts for all supported actions in one batch (parallel).
 * Returns a map of action -> count.
 */
export async function getGitHubDailyCounts(
  username: string,
  token: string,
  date: string,
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    SUPPORTED_GITHUB_ACTIONS.map(async (action) => {
      try {
        const count = await getGitHubDailyCount(action, username, token, date);
        return [action, count] as const;
      } catch (err) {
        console.error(`[github] Failed to get ${action} count for ${username}:`, err);
        return [action, 0] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Verifies the GitHub OAuth token is still valid and returns the username.
 */
export async function verifyGitHubToken(token: string): Promise<{ valid: boolean; username?: string }> {
  const resp = await ghFetch(`${GITHUB_API}/user`, token);
  if (!resp.ok) return { valid: false };
  const user = await resp.json();
  return { valid: true, username: user.login };
}
