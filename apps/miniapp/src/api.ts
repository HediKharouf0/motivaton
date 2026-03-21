const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export interface VerifyCheckRequest {
  app: string;
  action: string;
  count: number;
  duolingoUsername?: string;
}

export interface VerificationResult {
  verified: boolean;
  currentCount: number;
  targetCount: number;
  message: string;
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
  newCheckpoints: { checkpointIndex: number; signature: string }[];
  challengeIdx: number;
  beneficiaryAddress: string;
}

export interface AuthConnection {
  connected: boolean;
  username?: string;
}

export interface AuthStatus {
  github: AuthConnection;
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
};
