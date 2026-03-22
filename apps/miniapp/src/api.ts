const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const apiError = new Error(err.error || res.statusText) as Error & {
      status?: number;
      shortReason?: string;
      details?: unknown;
    };
    Object.assign(apiError, err, { status: res.status });
    throw apiError;
  }
  return res.json();
}

export interface AchievementInspection {
  provider: "COCOON" | "HEURISTIC";
  blocked: true;
  shortReason: string;
  summary: string;
}

export interface VerifyCheckRequest {
  app: string;
  action: string;
  count: number;
  challengeIdx?: number;
  duolingoUsername?: string;
}

export interface VerificationResult {
  verified: boolean;
  currentCount: number;
  targetCount: number;
  message: string;
  blocked?: boolean;
  shortReason?: string;
  inspection?: AchievementInspection | null;
}

export interface SignProofRequest {
  challengeIdx: number;
  beneficiaryAddress: string;
  duolingoUsername?: string;
}

export interface SignProofResponse {
  verified: boolean;
  earnedCount: number;
  alreadyClaimed: number;
  signature: string;
  challengeIdx: number;
  beneficiaryAddress: string;
}

export interface AuthConnection {
  connected: boolean;
  username?: string;
}

export interface AuthStatus {
  github: AuthConnection;
  leetcode: AuthConnection;
  chesscom: AuthConnection;
  strava: AuthConnection;
}

/** Backend API — verification, signing, and auth */
export const backendApi = {
  check(data: VerifyCheckRequest) {
    return request<VerificationResult>("/verify/check", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  signProof(data: SignProofRequest) {
    return request<SignProofResponse>("/verify/sign-proof", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getPublicKey() {
    return request<{ publicKey: string }>("/verify/public-key");
  },

  getAuthStatus(walletAddress: string) {
    return request<AuthStatus>(`/auth/status?wallet=${encodeURIComponent(walletAddress)}`);
  },

  startGitHubOAuth(walletAddress: string, challengeIdx?: number) {
    const returnPath = challengeIdx != null ? `/challenge/${challengeIdx}` : "/";
    return request<{ url: string }>("/auth/github/start", {
      method: "POST",
      body: JSON.stringify({ walletAddress, returnPath }),
    });
  },

  disconnectGitHub(walletAddress: string) {
    return request<{ ok: boolean }>("/auth/github/disconnect", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  },

  connectLeetCode(walletAddress: string, username: string) {
    return request<{ ok: boolean; username: string }>("/auth/leetcode/connect", {
      method: "POST",
      body: JSON.stringify({ walletAddress, username }),
    });
  },

  disconnectLeetCode(walletAddress: string) {
    return request<{ ok: boolean }>("/auth/leetcode/disconnect", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  },

  connectChessCom(walletAddress: string, username: string) {
    return request<{ ok: boolean; username: string }>("/auth/chesscom/connect", {
      method: "POST",
      body: JSON.stringify({ walletAddress, username }),
    });
  },

  disconnectChessCom(walletAddress: string) {
    return request<{ ok: boolean }>("/auth/chesscom/disconnect", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  },

  startStravaOAuth(walletAddress: string, challengeIdx?: number) {
    const returnPath = challengeIdx != null ? `/challenge/${challengeIdx}` : "/";
    return request<{ url: string }>("/auth/strava/start", {
      method: "POST",
      body: JSON.stringify({ walletAddress, returnPath }),
    });
  },

  disconnectStrava(walletAddress: string) {
    return request<{ ok: boolean }>("/auth/strava/disconnect", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  },

  getProgress(challengeIdx: number) {
    return request<{ challengeIdx: number; progress: number; claimed: boolean }>(`/progress/${challengeIdx}`);
  },

  getAllProgress() {
    return request<{ progress: Record<string, number>; claimed: Record<string, boolean> }>("/progress");
  },

  registerTelegramChatId(walletAddress: string, chatId: string | number) {
    return request<{ ok: boolean }>("/auth/telegram/register", {
      method: "POST",
      body: JSON.stringify({ walletAddress, chatId: String(chatId) }),
    });
  },
};
