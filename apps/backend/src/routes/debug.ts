import { Router } from "express";
import { addProgress, getProgress, getAllProgress } from "../store.js";
import { getChallenge } from "../chain.js";
import { progressJob } from "../cron.js";

export const debugRouter = Router();

debugRouter.get("/challenge/:idx", async (req, res) => {
  const idx = parseInt(req.params.idx, 10);
  if (isNaN(idx)) {
    res.status(400).json({ error: "Invalid idx" });
    return;
  }
  try {
    const challenge = await getChallenge(idx);
    const progress = getProgress(idx);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ challenge, progress }, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read-only: get progress for a single challenge
debugRouter.get("/progress/:challengeIdx", (req, res) => {
  const challengeIdx = parseInt(req.params.challengeIdx, 10);
  if (isNaN(challengeIdx)) {
    res.status(400).json({ error: "Invalid challengeIdx" });
    return;
  }
  res.json({ challengeIdx, progress: getProgress(challengeIdx) });
});

// Read-only: get all progress
debugRouter.get("/progress", (_req, res) => {
  res.json(getAllProgress());
});

// Debug: increment progress by 1
debugRouter.get("/progress/:challengeIdx/increment", (req, res) => {
  const challengeIdx = parseInt(req.params.challengeIdx, 10);
  if (isNaN(challengeIdx)) {
    res.status(400).json({ error: "Invalid challengeIdx" });
    return;
  }
  addProgress(challengeIdx, 1);
  const current = getProgress(challengeIdx);
  console.log(`[debug] Challenge #${challengeIdx} progress: ${current}`);
  res.json({ challengeIdx, progress: current });
});

debugRouter.get("/cron/trigger", async (_req, res) => {
  try {
    await progressJob();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
