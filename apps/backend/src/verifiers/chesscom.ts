import type { Verifier, VerifyRequest, VerificationResult } from "./types.js";
import { getChallengeProgress } from "../store.js";

export const chesscomVerifier: Verifier = {
  async verify(req: VerifyRequest): Promise<VerificationResult> {
    const challengeIdx = (req as VerifyRequest & { challengeIdx?: number }).challengeIdx;
    if (challengeIdx == null) {
      return {
        verified: false,
        currentCount: 0,
        targetCount: req.count,
        message: "Chess.com verification requires challengeIdx context.",
      };
    }

    const currentCount = getChallengeProgress(challengeIdx);
    const verified = currentCount >= req.count;

    return {
      verified,
      currentCount,
      targetCount: req.count,
      message: verified
        ? `Progress ${currentCount}/${req.count} — all checkpoints earned.`
        : `Progress ${currentCount}/${req.count} — ${req.count - currentCount} more needed.`,
    };
  },
};
