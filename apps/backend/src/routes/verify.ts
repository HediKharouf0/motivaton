import { Router } from "express";
import { Address } from "@ton/core";
import { getVerifier } from "../verifiers/index.js";
import { signClaimAllProof, getVerifierPublicKey } from "../signer.js";
import { getChallenge } from "../chain.js";
import { inspectChallengeAchievement } from "../cocoon.js";

export const verifyRouter = Router();

/**
 * POST /api/verify/check
 * Stateless verification: checks if the challenge goal is met via the external API.
 *
 * Body: { app, action, count, duolingoUsername? }
 */
verifyRouter.post("/check", async (req, res) => {
  const { app, action, count, challengeIdx, duolingoUsername } = req.body;

  if (!app || !action || !count) {
    res.status(400).json({ error: "Missing required fields: app, action, count." });
    return;
  }

  const verifier = getVerifier(app);
  if (!verifier) {
    res.status(400).json({ error: `Unsupported app: ${app}` });
    return;
  }

  const result = await verifier.verify({ app, action, count, challengeIdx, duolingoUsername });

  let inspection = null;
  if (result.verified && challengeIdx != null) {
    try {
      const challenge = await getChallenge(Number(challengeIdx));
      if (challenge) {
        inspection = await inspectChallengeAchievement(challenge);
      }
    } catch (error) {
      console.error("[verify/check] Achievement inspection failed:", error);
    }
  }

  res.json({
    ...result,
    blocked: Boolean(inspection),
    shortReason: inspection?.shortReason,
    inspection,
  });
});

/**
 * POST /api/verify/sign-proof
 * Reads the challenge from the contract, verifies progress, then returns
 * a single signature for ClaimAll covering all earned checkpoints.
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

  // Parse challengeId to get app/action
  const parts = challenge.challengeId.split(":");
  if (parts.length < 3) {
    res.status(400).json({ error: `Invalid challengeId format: ${challenge.challengeId}` });
    return;
  }
  const [app] = parts;

  const verifier = getVerifier(app);
  if (!verifier) {
    res.status(400).json({ error: `Unsupported app: ${app}` });
    return;
  }

  // Verify with the full checkpoint count to determine how many were earned
  const result = await verifier.verify({
    app,
    action: parts[1],
    count: challenge.totalCheckpoints,
    challengeIdx,
    duolingoUsername,
  });

  // Earned checkpoints = min(currentCount, totalCheckpoints)
  const earnedCount = Math.min(result.currentCount, challenge.totalCheckpoints);
  const expired = Date.now() / 1000 > challenge.endDate;

  if (!expired && earnedCount < challenge.totalCheckpoints) {
    res.status(400).json({
      error: "Challenge is still in progress. Claims unlock after the deadline or once all checkpoints are completed.",
      details: {
        ...result,
        earnedCount,
        alreadyClaimed: challenge.claimedCount,
      },
    });
    return;
  }

  if (earnedCount <= challenge.claimedCount) {
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

  const inspection = await inspectChallengeAchievement(challenge);
  if (inspection) {
    res.status(403).json({
      error: inspection.shortReason,
      shortReason: inspection.shortReason,
      details: {
        ...result,
        earnedCount,
        alreadyClaimed: challenge.claimedCount,
        inspection,
      },
    });
    return;
  }

  // Sign a single proof for ClaimAll: (challengeIdx, earnedCount, beneficiary)
  const signature = signClaimAllProof(challengeIdx, earnedCount, beneficiary).toString("base64");

  res.json({
    verified: true,
    earnedCount,
    alreadyClaimed: challenge.claimedCount,
    signature,
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
