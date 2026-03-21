import { Router } from "express";
import { getChallengeProgress, getChallengeEvents, getAllProgress } from "../store.js";
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
    const progress = getChallengeProgress(idx);
    const events = getChallengeEvents(idx);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ challenge, progress, events }, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.get("/progress/:challengeIdx", (req, res) => {
  const challengeIdx = parseInt(req.params.challengeIdx, 10);
  if (isNaN(challengeIdx)) {
    res.status(400).json({ error: "Invalid challengeIdx" });
    return;
  }
  const progress = getChallengeProgress(challengeIdx);
  const events = getChallengeEvents(challengeIdx);
  res.json({ challengeIdx, progress, events });
});

debugRouter.get("/progress", (_req, res) => {
  res.json(getAllProgress());
});

debugRouter.get("/cron/trigger", async (_req, res) => {
  try {
    await progressJob();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

debugRouter.post("/claim-log", (req, res) => {
  const { userAddress, contractAddress, challengeIdx, earnedCount, signature, boc } = req.body;
  console.log(`[claim-debug] userAddress: ${userAddress}`);
  console.log(`[claim-debug] contractAddress: ${contractAddress}`);
  console.log(`[claim-debug] challengeIdx: ${challengeIdx}, earnedCount: ${earnedCount}`);
  console.log(`[claim-debug] signature: ${signature}`);
  console.log(`[claim-debug] boc: ${boc}`);
  console.log(`[claim-debug] expected boc: te6cckEBAgEAUQABGPnkPrYAAAAAAAAAAQEAgMqTDoAQ3t0ltw0e8x77ajEbQBB0mjbiau3DKsZzZnVEt6jQrVMo48+gtdpPJdsGy28vflBZGjf19pqC1E7siwzvekO6`);
  res.json({ ok: true });
});

debugRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
