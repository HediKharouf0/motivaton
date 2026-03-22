import type { Verifier } from "./types.js";
import { duolingoVerifier } from "./duolingo.js";
import { githubVerifier } from "./github.js";
import { leetcodeVerifier } from "./leetcode.js";
import { chesscomVerifier } from "./chesscom.js";

const verifiers: Record<string, Verifier> = {
  DUOLINGO: duolingoVerifier,
  GITHUB: githubVerifier,
  LEETCODE: leetcodeVerifier,
  CHESSCOM: chesscomVerifier,
};

export function getVerifier(app: string): Verifier | undefined {
  return verifiers[app];
}

export type { VerifyRequest, VerificationResult, Verifier } from "./types.js";
