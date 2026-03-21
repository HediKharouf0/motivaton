import type { Verifier, VerifyRequest, VerificationResult } from "./types.js";
import { getProgress } from "../store.js";

/**
 * GitHub verifier — reads cumulative progress from the store.
 * Progress is incremented daily by the cron job based on GitHub API data.
 *
 * The VerifyRequest.count field is the target checkpoint count to verify against.
 * currentCount is the total cumulative progress tracked by the cron job.
 */
export const githubVerifier: Verifier = {
  async verify(req: VerifyRequest): Promise<VerificationResult> {
    // The challengeIdx is passed through via the verify request context.
    // For the sign-proof flow, the backend passes totalCheckpoints as count,
    // and we return the stored progress as currentCount.
    // The caller (sign-proof route) determines how many checkpoints are earned.

    // We need the challengeIdx to look up progress. It's passed as a custom field.
    const challengeIdx = (req as VerifyRequest & { challengeIdx?: number }).challengeIdx;
    if (challengeIdx == null) {
      return {
        verified: false,
        currentCount: 0,
        targetCount: req.count,
        message: "GitHub verification requires challengeIdx context.",
      };
    }

    const currentCount = getProgress(challengeIdx);
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
