export interface VerifyRequest {
  app: string;
  action: string;
  count: number;
  challengeIdx?: number;
  duolingoUsername?: string;
}

export interface VerificationResult {
  verified: boolean;
  currentCount: number;
  targetCount: number;
  message: string;
}

export interface Verifier {
  verify(req: VerifyRequest): Promise<VerificationResult>;
}
