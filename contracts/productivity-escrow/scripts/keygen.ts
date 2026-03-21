import { keyPairFromSeed } from "@ton/crypto";
import { randomBytes } from "crypto";

const seed = randomBytes(32);
const kp = keyPairFromSeed(seed);

console.log(`VERIFIER_SECRET_KEY=${kp.secretKey.toString("hex")}`);
console.log(`VERIFIER_PUBLIC_KEY=${kp.publicKey.toString("hex")}`);
