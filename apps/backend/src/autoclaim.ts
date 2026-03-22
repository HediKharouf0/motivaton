import { beginCell, Address, toNano } from "@ton/core";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { getAllChallenges } from "./chain.js";
import { getChallengeProgress, isChallengeClaimed, markChallengeClaimed } from "./store.js";
import { signClaimAllProof } from "./signer.js";

const OP_CLAIM_ALL = 0xf9dddb36;

let _client: TonClient | null = null;
function getClient(): TonClient {
  if (!_client) {
    const endpoint = process.env.TON_RPC_URL || process.env.TON_ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
    const apiKey = process.env.TON_API_KEY || process.env.RPC_API_KEY || "";
    _client = new TonClient({ endpoint, apiKey: apiKey || undefined });
  }
  return _client;
}

async function getWallet() {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) return null;

  const kp = await mnemonicToPrivateKey(mnemonic.split(" "));
  const wallet = WalletContractV5R1.create({ publicKey: kp.publicKey, workchain: 0 });
  return { wallet, kp };
}

function buildClaimAllBody(challengeIdx: number, earnedCount: number, signature: Buffer) {
  const sigCell = beginCell().storeBuffer(signature).endCell();
  return beginCell()
    .storeUint(OP_CLAIM_ALL, 32)
    .storeUint(challengeIdx, 32)
    .storeUint(earnedCount, 32)
    .storeRef(sigCell)
    .endCell();
}

export async function autoClaimJob() {
  const walletData = await getWallet();
  if (!walletData) return;

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) return;

  let challenges;
  try {
    challenges = await getAllChallenges();
  } catch {
    return;
  }

  const now = Date.now() / 1000;
  const claimable = challenges.filter((c) => {
    if (!c.active) return false;
    if (isChallengeClaimed(c.index)) return false;
    const progress = getChallengeProgress(c.index);
    if (progress < c.totalCheckpoints) {
      // Not fully completed — but check if expired with partial progress
      if (c.endDate > now) return false;
    }
    return progress > 0 && progress > c.claimedCount;
  });

  if (claimable.length === 0) return;

  const client = getClient();
  const { wallet, kp } = walletData;
  const walletContract = client.open(wallet);

  for (const c of claimable) {
    const progress = getChallengeProgress(c.index);
    const earnedCount = Math.min(progress, c.totalCheckpoints);

    if (earnedCount <= c.claimedCount) continue;

    try {
      const beneficiary = Address.parse(c.beneficiary);
      const signature = signClaimAllProof(c.index, earnedCount, beneficiary);
      const body = buildClaimAllBody(c.index, earnedCount, signature);

      const seqno = await walletContract.getSeqno();

      await walletContract.sendTransfer({
        secretKey: kp.secretKey,
        seqno,
        messages: [
          {
            info: {
              type: "internal",
              dest: Address.parse(contractAddress),
              value: { coins: toNano("0.05") },
              bounce: true,
              ihrDisabled: true,
              bounced: false,
              ihrFee: 0n,
              forwardFee: 0n,
              createdAt: 0,
              createdLt: 0n,
            },
            body,
          } as any,
        ],
      });

      markChallengeClaimed(c.index);
      console.log(`[autoclaim] Challenge #${c.index}: claimed ${earnedCount}/${c.totalCheckpoints} checkpoints for ${c.beneficiary}`);

      // Wait for seqno to increment before claiming the next one
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const newSeqno = await walletContract.getSeqno();
        if (newSeqno > seqno) break;
      }
    } catch (err) {
      console.error(`[autoclaim] Failed to claim challenge #${c.index}:`, err);
    }
  }
}
