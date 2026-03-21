import { sign, keyPairFromSecretKey } from "@ton/crypto";
import { beginCell, Address } from "@ton/core";

/**
 * The backend holds a private key used to sign claim proofs.
 * The matching public key is stored in the smart contract at deploy time.
 *
 * VERIFIER_SECRET_KEY must be a 64-byte hex ed25519 secret key.
 */
function getKeyPair() {
  const secretHex = process.env.VERIFIER_SECRET_KEY;
  if (!secretHex) {
    throw new Error("VERIFIER_SECRET_KEY env var is not set. Must be a 64-byte hex ed25519 secret key.");
  }
  return keyPairFromSecretKey(Buffer.from(secretHex, "hex"));
}

/**
 * Signs a ClaimAll proof.
 *
 * The signed data matches what the contract verifies:
 *   hash( challengeIdx(uint32) | earnedCount(uint32) | beneficiaryAddress )
 */
export function signClaimAllProof(
  challengeIdx: number,
  earnedCount: number,
  beneficiaryAddress: Address,
): Buffer {
  const kp = getKeyPair();

  const dataCell = beginCell()
    .storeUint(challengeIdx, 32)
    .storeUint(earnedCount, 32)
    .storeAddress(beneficiaryAddress)
    .endCell();

  const dataHash = dataCell.hash();
  return sign(dataHash, kp.secretKey);
}

export function getVerifierPublicKey(): Buffer {
  return getKeyPair().publicKey;
}
