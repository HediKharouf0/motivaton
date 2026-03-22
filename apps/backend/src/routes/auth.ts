import { Router } from "express";
import { randomBytes } from "crypto";
import { setAccount, getAccount, removeAccountApp } from "../store.js";
import { verifyGitHubToken } from "../github.js";
import { verifyLeetCodeUsername } from "../leetcode.js";
import { verifyChessComUsername } from "../chesscom.js";

export const authRouter = Router();

function getGitHubClientId(): string {
  return process.env.GITHUB_CLIENT_ID || "";
}
function getGitHubClientSecret(): string {
  return process.env.GITHUB_CLIENT_SECRET || "";
}

// Pending OAuth flows: state -> { wallet, returnPath, expiry }
const pendingOAuth = new Map<string, { wallet: string; returnPath: string; expiry: number }>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingOAuth) {
    if (val.expiry < now) pendingOAuth.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * POST /api/auth/github/start
 * Body: { walletAddress }
 * Returns: { url } — the GitHub OAuth URL to redirect the user to.
 */
authRouter.post("/github/start", (req, res) => {
  const { walletAddress, returnPath } = req.body;

  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress is required." });
    return;
  }

  if (!getGitHubClientId()) {
    res.status(500).json({ error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID." });
    return;
  }

  const state = randomBytes(16).toString("hex");
  pendingOAuth.set(state, { wallet: walletAddress, returnPath: returnPath || "/", expiry: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: getGitHubClientId(),
    redirect_uri: `${process.env.PUBLIC_URL || ""}/api/auth/github/callback`,
    scope: "read:user",
    state,
  });

  res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
});

/**
 * GET /api/auth/github/callback
 * GitHub redirects here after authorization.
 */
authRouter.get("/github/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== "string" || typeof state !== "string") {
    res.status(400).send("Missing code or state.");
    return;
  }

  const pending = pendingOAuth.get(state);
  if (!pending || pending.expiry < Date.now()) {
    res.status(400).send("Invalid or expired OAuth state.");
    return;
  }
  pendingOAuth.delete(state);

  // Exchange code for access token
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getGitHubClientId(),
      client_secret: getGitHubClientSecret(),
      code,
    }),
  });
  const tokenData = await tokenResp.json();

  if (tokenData.error || !tokenData.access_token) {
    res.status(400).send(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    return;
  }

  // Verify token and get username
  const { valid, username } = await verifyGitHubToken(tokenData.access_token);
  if (!valid || !username) {
    res.status(400).send("Failed to verify GitHub token.");
    return;
  }

  // Store credentials linked to wallet address
  setAccount(pending.wallet, {
    github: { accessToken: tokenData.access_token, username },
  });

  console.log(`[auth] Linked GitHub @${username} to wallet ${pending.wallet.slice(0, 12)}...`);

  // Redirect back to the miniapp page the user came from
  const returnUrl = `${process.env.PUBLIC_URL || ""}${pending.returnPath}`;
  res.redirect(returnUrl);
});

/**
 * GET /api/auth/status?wallet=EQ...
 * Returns connected apps for the given wallet.
 */
authRouter.get("/status", (req, res) => {
  const wallet = req.query.wallet as string;
  if (!wallet) {
    res.status(400).json({ error: "wallet query param required." });
    return;
  }
  const account = getAccount(wallet);
  res.json({
    github: account?.github ? { connected: true, username: account.github.username } : { connected: false },
    leetcode: account?.leetcode ? { connected: true, username: account.leetcode.username } : { connected: false },
    chesscom: account?.chesscom ? { connected: true, username: account.chesscom.username } : { connected: false },
  });
});

/**
 * POST /api/auth/github/disconnect
 * Body: { walletAddress }
 */
authRouter.post("/github/disconnect", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress is required." });
    return;
  }
  removeAccountApp(walletAddress, "github");
  res.json({ ok: true });
});

/**
 * POST /api/auth/leetcode/connect
 * Body: { walletAddress, username }
 */
authRouter.post("/leetcode/connect", async (req, res) => {
  const { walletAddress, username } = req.body;
  if (!walletAddress || !username) {
    res.status(400).json({ error: "walletAddress and username are required." });
    return;
  }

  const valid = await verifyLeetCodeUsername(username);
  if (!valid) {
    res.status(400).json({ error: `LeetCode user "${username}" not found.` });
    return;
  }

  setAccount(walletAddress, { leetcode: { username } });
  console.log(`[auth] Linked LeetCode @${username} to wallet ${walletAddress.slice(0, 12)}...`);
  res.json({ ok: true, username });
});

/**
 * POST /api/auth/leetcode/disconnect
 * Body: { walletAddress }
 */
authRouter.post("/leetcode/disconnect", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress is required." });
    return;
  }
  removeAccountApp(walletAddress, "leetcode");
  res.json({ ok: true });
});

/**
 * POST /api/auth/chesscom/connect
 * Body: { walletAddress, username }
 */
authRouter.post("/chesscom/connect", async (req, res) => {
  const { walletAddress, username } = req.body;
  if (!walletAddress || !username) {
    res.status(400).json({ error: "walletAddress and username are required." });
    return;
  }

  const valid = await verifyChessComUsername(username);
  if (!valid) {
    res.status(400).json({ error: `Chess.com user "${username}" not found.` });
    return;
  }

  setAccount(walletAddress, { chesscom: { username } });
  console.log(`[auth] Linked Chess.com @${username} to wallet ${walletAddress.slice(0, 12)}...`);
  res.json({ ok: true, username });
});

/**
 * POST /api/auth/chesscom/disconnect
 * Body: { walletAddress }
 */
authRouter.post("/chesscom/disconnect", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress is required." });
    return;
  }
  removeAccountApp(walletAddress, "chesscom");
  res.json({ ok: true });
});
