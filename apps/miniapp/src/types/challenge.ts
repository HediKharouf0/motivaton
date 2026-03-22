/** Supported productivity apps */
export enum App {
  Github = "GITHUB",
}

/** Actions available per app */
export enum GithubAction {
  Commit = "COMMIT",
  CreatePR = "CREATE_PR",
  MergePR = "MERGE_PR",
  OpenIssue = "OPEN_ISSUE",
  Review = "REVIEW",
}

export type AppAction = GithubAction;

/** Map from App to its available actions */
export const APP_ACTIONS: Record<App, { value: AppAction; label: string }[]> = {
  [App.Github]: [
    { value: GithubAction.Commit, label: "Commit" },
    { value: GithubAction.CreatePR, label: "Create Pull Request" },
    { value: GithubAction.MergePR, label: "Merge Pull Request" },
    { value: GithubAction.OpenIssue, label: "Open Issue" },
    { value: GithubAction.Review, label: "Code Review" },
  ],
};

export const APP_LABELS: Record<App, string> = {
  [App.Github]: "GitHub",
};

/** Challenge as submitted from the form */
export interface ChallengeFormData {
  /** TON address of the person who pays */
  whoPays: string;
  /** TON address of the person who gets paid */
  whoIsPaid: string;
  /** Amount in TON (nanotons) */
  amount: number;
  /** Selected app */
  app: App;
  /** Selected action within the app */
  action: AppAction;
  /** How many times the action must be completed */
  count: number;
  /** Unix timestamp for the challenge deadline */
  endDate: number;
}

/**
 * On-chain challenge representation.
 * challengeId format: {APP_NAME}:{ACTION}:{COUNT}
 */
export interface Challenge extends ChallengeFormData {
  challengeId: string;
}

/** Builds the challengeId string from its parts */
export function buildChallengeId(app: App, action: AppAction, count: number): string {
  return `${app}:${action}:${count}`;
}

export function parseChallengeId(challengeId: string) {
  const [app = "", action = "", rawCount = "0"] = challengeId.split(":");
  const count = Number.parseInt(rawCount, 10) || 0;
  return { app, action, count };
}

export function formatActionLabel(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
