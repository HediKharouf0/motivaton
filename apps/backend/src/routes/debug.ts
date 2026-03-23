import { Router } from "express";
import { getChallengeProgress, getChallengeEvents, getAllProgress, isChallengeClaimed, getAllClaimed, clearChallengeClaimed } from "../store.js";
import { getAllChallenges, getChallenge } from "../chain.js";
import { progressJob } from "../cron.js";
import { getLiveChallengeProgress } from "../live-verification.js";
import { autoClaimJob } from "../autoclaim.js";

export const debugRouter = Router();

debugRouter.get("/challenge/:idx", async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  if (isNaN(idx)) {
    res.status(400).json({ error: "Invalid idx" });
    return;
  }
  try {
    const challenge = await getChallenge(idx);
    const progress = challenge ? await getLiveChallengeProgress(challenge) : 0;
    const events = getChallengeEvents(idx);
    const claimed = isChallengeClaimed(idx);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ challenge, progress, events, claimed }, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/progress/:challengeIdx", async (req, res) => {
  const challengeIdx = parseInt(req.params.challengeIdx, 10);
  if (isNaN(challengeIdx)) {
    res.status(400).json({ error: "Invalid challengeIdx" });
    return;
  }
  try {
    const challenge = await getChallenge(challengeIdx);
    const progress = challenge ? await getLiveChallengeProgress(challenge) : 0;
    const events = getChallengeEvents(challengeIdx);
    const claimed = isChallengeClaimed(challengeIdx);
    res.json({ challengeIdx, progress, events, claimed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/progress", async (_req, res) => {
  try {
    const challenges = await getAllChallenges();
    const progressEntries = await Promise.all(
      challenges.map(async (challenge) => [String(challenge.index), await getLiveChallengeProgress(challenge)] as const),
    );
    res.json({ progress: Object.fromEntries(progressEntries), claimed: getAllClaimed() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/cron/trigger", async (_req, res) => {
  try {
    await progressJob();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/unclaim/:challengeIdx", (req, res) => {
  const challengeIdx = parseInt(req.params.challengeIdx, 10);
  if (isNaN(challengeIdx)) {
    res.status(400).json({ error: "Invalid challengeIdx" });
    return;
  }
  clearChallengeClaimed(challengeIdx);
  console.log(`[debug] Cleared claim for challenge #${challengeIdx}`);
  res.json({ ok: true, challengeIdx });
});

debugRouter.get("/autoclaim", async (_req, res) => {
  try {
    const challenges = await getAllChallenges();
    await autoClaimJob(challenges);
    res.json({ ok: true, challengeCount: challenges.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
