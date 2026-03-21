import express, { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { Address } from "@ton/core";
import { getAllChallenges } from "../chain.js";
import { getAllAccounts, addChallengeEvents, type EventEntry } from "../store.js";

export const webhookRouter = Router();

function getWebhookSecret(): string {
  return process.env.GITHUB_WEBHOOK_SECRET || "";
}

function normalizeAddress(addr: string): string {
  try {
    return Address.parse(addr).toRawString();
  } catch {
    return addr.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
  }
}

function verifySignature(payload: Buffer, signature: string): boolean {
  if (!getWebhookSecret()) return false;
  const expected = `sha256=${createHmac("sha256", getWebhookSecret()).update(payload).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

webhookRouter.post("/github", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-hub-signature-256"] as string;

  if (getWebhookSecret() && (!signature || !verifySignature(req.body as Buffer, signature))) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = JSON.parse((req.body as Buffer).toString());
  const eventType = req.headers["x-github-event"] as string;
  const sender: string | undefined = event.sender?.login;

  if (!sender) {
    res.json({ ok: true, skipped: "no sender" });
    return;
  }

  let action: string | null = null;
  let entries: EventEntry[] = [];

  switch (eventType) {
    case "push": {
      action = "COMMIT";
      const commits = event.commits as { id: string }[] | undefined;
      const count = commits?.length || 1;
      const id = event.head_commit?.id || event.after || String(Date.now());
      entries = [{ id, count }];
      break;
    }
    case "issues":
      if (event.action === "opened") {
        action = "OPEN_ISSUE";
        entries = [{ id: String(event.issue?.id), count: 1 }];
      }
      break;
    case "pull_request":
      if (event.action === "opened") {
        action = "CREATE_PR";
        entries = [{ id: String(event.pull_request?.id), count: 1 }];
      } else if (event.action === "closed" && event.pull_request?.merged) {
        action = "MERGE_PR";
        entries = [{ id: String(event.pull_request?.id), count: 1 }];
      }
      break;
    case "pull_request_review":
      action = "REVIEW";
      entries = [{ id: String(event.review?.id), count: 1 }];
      break;
  }

  if (!action || entries.length === 0) {
    res.json({ ok: true, skipped: "irrelevant event" });
    return;
  }

  const accounts = getAllAccounts();
  const walletEntry = Object.entries(accounts).find(
    ([, creds]) => creds.github?.username.toLowerCase() === sender.toLowerCase(),
  );

  if (!walletEntry) {
    res.json({ ok: true, skipped: "unknown user" });
    return;
  }

  const [wallet] = walletEntry;
  const normWallet = normalizeAddress(wallet);

  let challenges;
  try {
    challenges = await getAllChallenges();
  } catch (err) {
    console.error("[webhook] Failed to fetch challenges:", err);
    res.status(500).json({ error: "Failed to fetch challenges" });
    return;
  }

  const now = Date.now() / 1000;
  let updated = 0;

  for (const c of challenges) {
    if (!c.active || c.endDate <= now) continue;
    const parts = c.challengeId.split(":");
    if (parts.length < 3 || parts[0] !== "GITHUB" || parts[1] !== action) continue;
    if (normalizeAddress(c.beneficiary) !== normWallet) continue;

    const newEntries = addChallengeEvents(c.index, entries);
    const totalNew = newEntries.reduce((sum, e) => sum + e.count, 0);
    if (totalNew > 0) {
      updated++;
      console.log(`[webhook] Challenge #${c.index}: +${totalNew} ${action} by @${sender}`);
    }
  }

  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
  res.json({ ok: true, processed: totalCount, challengesUpdated: updated });
});
