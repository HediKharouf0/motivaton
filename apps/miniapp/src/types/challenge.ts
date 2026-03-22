/** Supported productivity apps */
export enum App {
  Github = "GITHUB",
  LeetCode = "LEETCODE",
  ChessCom = "CHESSCOM",
  Strava = "STRAVA",
}

/** Actions available per app */
export enum GithubAction {
  Commit = "COMMIT",
  CreatePR = "CREATE_PR",
  MergePR = "MERGE_PR",
  OpenIssue = "OPEN_ISSUE",
  Review = "REVIEW",
}

export enum LeetCodeAction {
  SolveProblem = "SOLVE_PROBLEM",
  SolveEasy = "SOLVE_EASY",
  SolveMedium = "SOLVE_MEDIUM",
  SolveHard = "SOLVE_HARD",
  MaintainStreak = "MAINTAIN_STREAK",
}

export enum ChessComAction {
  PlayGame = "PLAY_GAME",
  WinGame = "WIN_GAME",
  WinRapid = "WIN_RAPID",
  WinBlitz = "WIN_BLITZ",
  WinBullet = "WIN_BULLET",
}

export enum StravaAction {
  LogActivity = "LOG_ACTIVITY",
  Run = "RUN",
  Ride = "RIDE",
  Swim = "SWIM",
  Walk = "WALK",
  LogKm = "LOG_KM",
}

export type AppAction = GithubAction | LeetCodeAction | ChessComAction | StravaAction;

/** Map from App to its available actions */
export const APP_ACTIONS: Record<App, { value: AppAction; label: string }[]> = {
  [App.Github]: [
    { value: GithubAction.Commit, label: "Commit" },
    { value: GithubAction.CreatePR, label: "Create Pull Request" },
    { value: GithubAction.MergePR, label: "Merge Pull Request" },
    { value: GithubAction.OpenIssue, label: "Open Issue" },
    { value: GithubAction.Review, label: "Code Review" },
  ],
  [App.LeetCode]: [
    { value: LeetCodeAction.SolveProblem, label: "Solve Any Problem" },
    { value: LeetCodeAction.SolveEasy, label: "Solve Easy" },
    { value: LeetCodeAction.SolveMedium, label: "Solve Medium" },
    { value: LeetCodeAction.SolveHard, label: "Solve Hard" },
    { value: LeetCodeAction.MaintainStreak, label: "Maintain Streak" },
  ],
  [App.ChessCom]: [
    { value: ChessComAction.PlayGame, label: "Play Game" },
    { value: ChessComAction.WinGame, label: "Win Game" },
    { value: ChessComAction.WinRapid, label: "Win Rapid" },
    { value: ChessComAction.WinBlitz, label: "Win Blitz" },
    { value: ChessComAction.WinBullet, label: "Win Bullet" },
  ],
};

  [App.Strava]: [
    { value: StravaAction.LogActivity, label: "Log Activity" },
    { value: StravaAction.Run, label: "Run" },
    { value: StravaAction.Ride, label: "Ride" },
    { value: StravaAction.Swim, label: "Swim" },
    { value: StravaAction.Walk, label: "Walk / Hike" },
    { value: StravaAction.LogKm, label: "Log Kilometers" },
  ],
};

export const APP_LABELS: Record<App, string> = {
  [App.Github]: "GitHub",
  [App.LeetCode]: "LeetCode",
  [App.ChessCom]: "Chess.com",
  [App.Strava]: "Strava",
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
