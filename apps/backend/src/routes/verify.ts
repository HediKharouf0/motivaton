import { Router } from "express";
import { Address } from "@ton/core";
import { getVerifier } from "../verifiers/index.js";
import { signCheckpointProof, getVerifierPublicKey } from "../signer.js";
import { getChallenge } from "../chain.js";

export const verifyRouter = Router();

/**
 * POST /api/verify/check
 * Stateless verification: checks if the challenge goal is met via the external API.
 *
 * Body: { app, action, count, duolingoUsername? }
 */
verifyRouter.post("/check", async (req, res) => {
  const { app, action, count, duolingoUsername } = req.body;

  if (!app || !action || !count) {
    res.status(400).json({ error: "Missing required fields: app, action, count." });
    return;
  }

  const verifier = getVerifier(app);
  if (!verifier) {
    res.status(400).json({ error: `Unsupported app: ${app}` });
    return;
  }

  const result = await verifier.verify({ app, action, count, duolingoUsername });
  res.json(result);
});

/**
 * POST /api/verify/sign-proof
 * Reads the challenge from the contract to get the real app/action/count,
 * verifies progress, then returns signed proofs for all earned checkpoints.
 *
 * Claims are only valid after the challenge has ended. The number of checkpoints
 * earned equals the verified completion count (capped at totalCheckpoints).
 *
 * Body: {
 *   challengeIdx,        // on-chain challenge index
 *   beneficiaryAddress,  // must match on-chain beneficiary
 *   duolingoUsername?     // for Duolingo verification
 * }
 */
verifyRouter.post("/sign-proof", async (req, res) => {
  const { challengeIdx, beneficiaryAddress, duolingoUsername } = req.body;

  if (challengeIdx == null || !beneficiaryAddress) {
    res.status(400).json({ error: "Missing required fields: challengeIdx, beneficiaryAddress." });
    return;
  }

  // Read the challenge from the contract — source of truth
  let challenge;
  try {
    challenge = await getChallenge(challengeIdx);
  } catch (e: any) {
    res.status(500).json({ error: `Failed to read challenge from chain: ${e.message}` });
    return;
  }

  if (!challenge) {
    res.status(404).json({ error: `Challenge ${challengeIdx} not found on-chain.` });
    return;
  }

  // Verify beneficiary matches
  const beneficiary = Address.parse(beneficiaryAddress);
  if (challenge.beneficiary !== beneficiary.toString()) {
    res.status(403).json({ error: "Beneficiary address does not match on-chain challenge." });
    return;
  }

  if (!challenge.active) {
    res.status(400).json({ error: "Challenge is not active." });
    return;
  }

  if (Date.now() / 1000 <= challenge.endDate) {
    res.status(400).json({ error: "Challenge has not ended yet. Claims are only available after the deadline." });
    return;
  }

  // Parse challengeId to get app/action/count
  const parts = challenge.challengeId.split(":");
  if (parts.length < 3) {
    res.status(400).json({ error: `Invalid challengeId format: ${challenge.challengeId}` });
    return;
  }
  const [app, action] = parts;

  const verifier = getVerifier(app);
  if (!verifier) {
    res.status(400).json({ error: `Unsupported app: ${app}` });
    return;
  }

  // Verify with the full checkpoint count to determine how many were earned
  const result = await verifier.verify({
    app,
    action,
    count: challenge.totalCheckpoints,
    challengeIdx,
    duolingoUsername,
  } as any);

  // Earned checkpoints = min(currentCount, totalCheckpoints)
  const earnedCount = Math.min(result.currentCount, challenge.totalCheckpoints);
  // Only sign for checkpoints not yet claimed
  const unclaimedEarned: number[] = [];
  for (let i = challenge.claimedCount; i < earnedCount; i++) {
    unclaimedEarned.push(i);
  }

  if (unclaimedEarned.length === 0) {
    res.status(403).json({
      error: "No new checkpoints to claim.",
      details: {
        ...result,
        earnedCount,
        alreadyClaimed: challenge.claimedCount,
        message: `Earned ${earnedCount}/${challenge.totalCheckpoints} checkpoints, ${challenge.claimedCount} already claimed.`,
      },
    });
    return;
  }

  const signatures = unclaimedEarned.map((cpIdx) => ({
    checkpointIndex: cpIdx,
    signature: signCheckpointProof(challengeIdx, cpIdx, beneficiary).toString("base64"),
  }));

  res.json({
    verified: true,
    earnedCount,
    alreadyClaimed: challenge.claimedCount,
    newCheckpoints: signatures,
    challengeIdx,
    beneficiaryAddress,
  });
});

/**
 * GET /api/verify/public-key
 * Returns the verifier public key (needed for contract deployment).
 */
verifyRouter.get("/public-key", (_req, res) => {
  try {
    const pubKey = getVerifierPublicKey();
    res.json({ publicKey: pubKey.toString("hex") });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
