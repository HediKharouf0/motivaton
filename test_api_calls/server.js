const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// --------------- .env helpers ---------------
const ENV_PATH = path.join(__dirname, ".env");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const vars = {};
  fs.readFileSync(ENV_PATH, "utf-8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2];
  });
  return vars;
}

function saveEnv(vars) {
  const content = Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";
  fs.writeFileSync(ENV_PATH, content, "utf-8");
}

// Load env vars on startup
const initialEnv = loadEnv();
Object.assign(process.env, initialEnv);

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- in-memory session store ---------------
const sessions = {};

function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// --------------- middleware ---------------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --------------- helpers ---------------
async function ghFetch(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  return match ? sessions[match[1]] : null;
}

function getEnvConfig() {
  const env = loadEnv();
  return {
    configured: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    hasClientId: !!env.GITHUB_CLIENT_ID,
    hasClientSecret: !!env.GITHUB_CLIENT_SECRET,
    clientIdPreview: env.GITHUB_CLIENT_ID
      ? env.GITHUB_CLIENT_ID.substring(0, 6) + "…"
      : null,
    port: env.PORT || "3000",
  };
}

// --------------- admin config routes ---------------

app.get("/api/config/status", (req, res) => {
  res.json(getEnvConfig());
});

app.post("/api/config", (req, res) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: "clientId and clientSecret are required" });
  }
  const env = loadEnv();
  env.GITHUB_CLIENT_ID = clientId.trim();
  env.GITHUB_CLIENT_SECRET = clientSecret.trim();
  if (!env.PORT) env.PORT = String(PORT);
  if (!env.SESSION_SECRET) env.SESSION_SECRET = crypto.randomBytes(16).toString("hex");
  saveEnv(env);

  process.env.GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID;
  process.env.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;

  res.json({ ok: true, config: getEnvConfig() });
});

// --------------- OAuth routes ---------------

app.get("/auth/github", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(400).send("GitHub OAuth not configured. Ask the admin to set it up.");
  }
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `http://localhost:${PORT}/auth/github/callback`,
    scope: "read:user read:org repo",
    state,
  });
  res.setHeader("Set-Cookie", `gh_state=${state}; HttpOnly; Path=/; Max-Age=300`);
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get("/auth/github/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookie = req.headers.cookie || "";
    const savedState = (cookie.match(/gh_state=([^;]+)/) || [])[1];
    if (!state || state !== savedState) {
      return res.status(403).send("State mismatch — possible CSRF.");
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `http://localhost:${PORT}/auth/github/callback`,
        state,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).send(`GitHub error: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;
    const user = await ghFetch("https://api.github.com/user", accessToken);

    const sessionToken = makeSessionToken();
    sessions[sessionToken] = {
      githubToken: accessToken,
      username: user.login,
      name: user.name,
      avatar: user.avatar_url,
      profileUrl: user.html_url,
      publicRepos: user.public_repos,
      followers: user.followers,
    };

    res.setHeader("Set-Cookie", [
      `session=${sessionToken}; HttpOnly; Path=/; Max-Age=86400`,
      `gh_state=; HttpOnly; Path=/; Max-Age=0`,
    ]);
    res.redirect("/");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth failed: " + err.message);
  }
});

app.get("/api/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ loggedIn: false });
  res.json({
    loggedIn: true,
    username: session.username,
    name: session.name,
    avatar: session.avatar,
    profileUrl: session.profileUrl,
    publicRepos: session.publicRepos,
    followers: session.followers,
  });
});

// --------------- repo routes ---------------

app.get("/api/repos", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not logged in" });

  try {
    const repos = await ghFetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      session.githubToken
    );
    res.json(
      repos.map((r) => ({
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        url: r.html_url,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        updated_at: r.updated_at,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------- commit routes ---------------

// Get all commits from all repos in chronological order
app.get("/api/commits/all/feed", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not logged in" });

  try {
    const repos = await ghFetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      session.githubToken
    );

    // Fetch commits from each repo in parallel
    const allCommits = [];
    await Promise.all(
      repos.map(async (repo) => {
        try {
          const commits = await ghFetch(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?per_page=100`,
            session.githubToken
          );
          allCommits.push(
            ...commits.map((c) => ({
              sha: c.sha,
              authorDate: c.commit.author.date,
              authorLogin: c.author ? c.author.login : null,
              authorName: c.commit.author.name,
              repoName: repo.full_name,
              additions: 0,
              deletions: 0,
            }))
          );
        } catch (err) {
          console.error(`Failed to fetch commits for ${repo.full_name}:`, err.message);
        }
      })
    );

    // Sort by date descending (most recent first)
    allCommits.sort((a, b) => new Date(b.authorDate) - new Date(a.authorDate));

    // Fetch stats for all commits in parallel (no batching - full parallel)
    const statsPromises = allCommits.map(async (commit) => {
      try {
        const [owner, repo] = commit.repoName.split("/");
        const c = await ghFetch(
          `https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`,
          session.githubToken
        );
        return {
          sha: commit.sha,
          additions: c.stats.additions,
          deletions: c.stats.deletions,
        };
      } catch {
        return { sha: commit.sha, additions: 0, deletions: 0 };
      }
    });

    const statsResults = await Promise.all(statsPromises);
    const statsMap = {};
    statsResults.forEach((s) => (statsMap[s.sha] = s));

    // Merge stats back into commits
    const withStats = allCommits.map((c) => ({
      authorDate: c.authorDate,
      authorLogin: c.authorLogin || c.authorName,
      repoName: c.repoName,
      additions: statsMap[c.sha]?.additions || 0,
      deletions: statsMap[c.sha]?.deletions || 0,
    }));

    res.json(withStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List commits — basic info (fast, single API call)
app.get("/api/commits/:owner/:repo", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not logged in" });

  try {
    const { owner, repo } = req.params;
    const commits = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`,
      session.githubToken
    );
    res.json(
      commits.map((c) => ({
        sha: c.sha,
        shaShort: c.sha.substring(0, 7),
        message: c.commit.message,
        authorName: c.commit.author.name,
        authorEmail: c.commit.author.email,
        authorDate: c.commit.author.date,
        committerName: c.commit.committer.name,
        committerDate: c.commit.committer.date,
        url: c.html_url,
        authorAvatar: c.author ? c.author.avatar_url : null,
        authorLogin: c.author ? c.author.login : null,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single commit detail — includes stats + files (requires 1 API call per commit)
app.get("/api/commit/:owner/:repo/:sha", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not logged in" });

  try {
    const { owner, repo, sha } = req.params;
    const c = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      session.githubToken
    );
    res.json({
      sha: c.sha,
      shaShort: c.sha.substring(0, 7),
      message: c.commit.message,
      authorName: c.commit.author.name,
      authorEmail: c.commit.author.email,
      authorDate: c.commit.author.date,
      committerName: c.commit.committer.name,
      committerDate: c.commit.committer.date,
      url: c.html_url,
      authorAvatar: c.author ? c.author.avatar_url : null,
      authorLogin: c.author ? c.author.login : null,
      stats: {
        additions: c.stats.additions,
        deletions: c.stats.deletions,
        total: c.stats.total,
      },
      files: c.files.map((f) => ({
        filename: f.filename,
        status: f.status,          // added | removed | modified | renamed
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch || null,    // the actual diff (can be large)
      })),
      filesChanged: c.files.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch stats — fetch stats for multiple commits at once (parallel)
app.post("/api/commits/:owner/:repo/stats", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not logged in" });

  try {
    const { owner, repo } = req.params;
    const { shas } = req.body; // array of sha strings
    if (!Array.isArray(shas) || shas.length === 0) {
      return res.status(400).json({ error: "shas array required" });
    }

    // Limit to 30 to avoid rate-limiting
    const limited = shas.slice(0, 30);
    const results = await Promise.all(
      limited.map(async (sha) => {
        try {
          const c = await ghFetch(
            `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
            session.githubToken
          );
          return {
            sha,
            additions: c.stats.additions,
            deletions: c.stats.deletions,
            total: c.stats.total,
            filesChanged: c.files.length,
          };
        } catch {
          return { sha, additions: null, deletions: null, total: null, filesChanged: null };
        }
      })
    );

    const statsMap = {};
    results.forEach((r) => (statsMap[r.sha] = r));
    res.json(statsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== LEETCODE ROUTES ===============

// Helper: send a GraphQL query to LeetCode
async function lcGraphQL(query, variables, sessionCookie, csrfToken) {
  const headers = { "Content-Type": "application/json" };
  if (sessionCookie) {
    headers["Cookie"] = `LEETCODE_SESSION=${sessionCookie}${csrfToken ? `; csrftoken=${csrfToken}` : ""}`;
    if (csrfToken) headers["x-csrftoken"] = csrfToken;
  }
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LeetCode API ${res.status}: ${text}`);
  }
  return res.json();
}

// Ensure a session exists (create one if user hasn't logged in via GitHub)
function ensureSession(req, res) {
  let session = getSession(req);
  if (!session) {
    const sessionToken = makeSessionToken();
    sessions[sessionToken] = {};
    res.setHeader("Set-Cookie", `session=${sessionToken}; HttpOnly; Path=/; Max-Age=86400`);
    session = sessions[sessionToken];
  }
  return session;
}

// Connect LeetCode account — store username + optional session cookie
app.post("/api/leetcode/connect", (req, res) => {
  const { username, sessionCookie, csrfToken } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  const session = ensureSession(req, res);
  session.leetcode = {
    username: username.trim(),
    sessionCookie: sessionCookie ? sessionCookie.trim() : null,
    csrfToken: csrfToken ? csrfToken.trim() : null,
  };

  res.json({ ok: true, username: session.leetcode.username, hasSession: !!session.leetcode.sessionCookie });
});

// Disconnect LeetCode
app.post("/api/leetcode/disconnect", (req, res) => {
  const session = getSession(req);
  if (session) delete session.leetcode;
  res.json({ ok: true });
});

// Get LeetCode connection status
app.get("/api/leetcode/status", (req, res) => {
  const session = getSession(req);
  if (!session || !session.leetcode) {
    return res.json({ connected: false });
  }
  res.json({
    connected: true,
    username: session.leetcode.username,
    hasSession: !!session.leetcode.sessionCookie,
  });
});

// Recent accepted submissions (PUBLIC — no auth needed, just username)
// Enriched with difficulty by querying each problem in parallel
app.get("/api/leetcode/recent/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const data = await lcGraphQL(
      `query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id title titleSlug timestamp
        }
      }`,
      { username, limit },
      null, null
    );
    const rawSubmissions = data.data.recentAcSubmissionList || [];

    // Fetch difficulty for each unique problem in parallel
    const uniqueSlugs = [...new Set(rawSubmissions.map(s => s.titleSlug))];
    const difficultyMap = {};
    await Promise.all(
      uniqueSlugs.map(async (slug) => {
        try {
          const d = await lcGraphQL(
            `query questionDifficulty($titleSlug: String!) {
              question(titleSlug: $titleSlug) { difficulty }
            }`,
            { titleSlug: slug },
            null, null
          );
          difficultyMap[slug] = d.data.question ? d.data.question.difficulty : null;
        } catch {
          difficultyMap[slug] = null;
        }
      })
    );

    const submissions = rawSubmissions.map((s) => ({
      id: s.id,
      title: s.title,
      titleSlug: s.titleSlug,
      difficulty: difficultyMap[s.titleSlug] || null,
      timestamp: parseInt(s.timestamp),
      date: new Date(parseInt(s.timestamp) * 1000).toISOString(),
    }));
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Solved stats by difficulty (needs auth via session cookie)
app.get("/api/leetcode/stats/:username", async (req, res) => {
  const session = getSession(req);
  const lc = session ? session.leetcode : null;

  try {
    const { username } = req.params;
    const data = await lcGraphQL(
      `query userSolvedProblems($username: String!) {
        allQuestionsCount { difficulty count }
        matchedUser(username: $username) {
          submitStatsGlobal {
            acSubmissionNum { difficulty count }
          }
          problemsSolvedBeatsStats { difficulty percentage }
        }
      }`,
      { username },
      lc ? lc.sessionCookie : null,
      lc ? lc.csrfToken : null
    );
    res.json(data.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full submission list with difficulty + pagination (needs auth)
app.get("/api/leetcode/submissions", async (req, res) => {
  const session = getSession(req);
  const lc = session ? session.leetcode : null;
  if (!lc || !lc.sessionCookie) {
    return res.status(401).json({ error: "LeetCode session cookie required. Connect with session cookie first." });
  }

  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const lastKey = req.query.lastKey || null;

    const data = await lcGraphQL(
      `query submissionList($offset: Int!, $limit: Int!, $lastKey: String) {
        submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
          lastKey hasNext
          submissions {
            id title status timestamp lang
            question { difficulty }
          }
        }
      }`,
      { offset, limit, lastKey },
      lc.sessionCookie,
      lc.csrfToken
    );

    const result = data.data.submissionList;
    res.json({
      lastKey: result.lastKey,
      hasNext: result.hasNext,
      submissions: (result.submissions || []).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,        // "Accepted", "Wrong Answer", etc.
        language: s.lang,
        difficulty: s.question ? s.question.difficulty : null,
        timestamp: parseInt(s.timestamp),
        date: new Date(parseInt(s.timestamp) * 1000).toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------- logout ---------------
app.get("/auth/logout", (req, res) => {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (match) delete sessions[match[1]];
  res.setHeader("Set-Cookie", `session=; HttpOnly; Path=/; Max-Age=0`);
  res.redirect("/");
});

// --------------- start ---------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!process.env.GITHUB_CLIENT_ID) {
    console.log("⚠  No GITHUB_CLIENT_ID — go to http://localhost:" + PORT + "/admin to configure");
  }
});
