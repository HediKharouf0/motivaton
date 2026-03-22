import { beginCell, Address, toNano, internal, SendMode } from "@ton/core";
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
  if (!mnemonic) {
    console.log("[autoclaim] No WALLET_MNEMONIC set, skipping");
    return null;
  }

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
  if (!contractAddress) {
    console.log("[autoclaim] No CONTRACT_ADDRESS set, skipping");
    return;
  }

  let challenges;
  try {
    challenges = await getAllChallenges();
  } catch (err) {
    console.error("[autoclaim] Failed to fetch challenges:", err);
    return;
  }

  console.log(`[autoclaim] Checking ${challenges.length} challenges`);

  const now = Date.now() / 1000;
  const claimable = challenges.filter((c) => {
    const progress = getChallengeProgress(c.index);
    const claimed = isChallengeClaimed(c.index);

    if (!c.active) {
      console.log(`[autoclaim]   #${c.index}: skip (inactive on-chain)`);
      return false;
    }
    if (claimed) {
      console.log(`[autoclaim]   #${c.index}: skip (already claimed in db)`);
      return false;
    }
    if (progress < c.totalCheckpoints && c.endDate > now) {
      console.log(`[autoclaim]   #${c.index}: skip (progress ${progress}/${c.totalCheckpoints}, not expired)`);
      return false;
    }
    if (progress <= 0) {
      console.log(`[autoclaim]   #${c.index}: skip (no progress)`);
      return false;
    }
    if (progress <= c.claimedCount) {
      console.log(`[autoclaim]   #${c.index}: skip (progress ${progress} <= claimedCount ${c.claimedCount})`);
      return false;
    }

    console.log(`[autoclaim]   #${c.index}: CLAIMABLE (progress ${progress}/${c.totalCheckpoints}, on-chain claimed ${c.claimedCount})`);
    return true;
  });

  if (claimable.length === 0) {
    console.log("[autoclaim] No claimable challenges");
    return;
  }

  console.log(`[autoclaim] ${claimable.length} challenges to claim`);

  const client = getClient();
  const { wallet, kp } = walletData;
  const walletContract = client.open(wallet);
  console.log(`[autoclaim] Operator wallet: ${wallet.address.toString()}`);

  for (const c of claimable) {
    const progress = getChallengeProgress(c.index);
    const earnedCount = Math.min(progress, c.totalCheckpoints);

    if (earnedCount <= c.claimedCount) continue;

    try {
      const beneficiary = Address.parse(c.beneficiary);
      console.log(`[autoclaim] #${c.index}: signing proof for earnedCount=${earnedCount}, beneficiary=${c.beneficiary}`);

      const signature = signClaimAllProof(c.index, earnedCount, beneficiary);
      const body = buildClaimAllBody(c.index, earnedCount, signature);

      const seqno = await walletContract.getSeqno();
      console.log(`[autoclaim] #${c.index}: sending tx, seqno=${seqno}, contract=${contractAddress}`);

      await walletContract.sendTransfer({
        secretKey: kp.secretKey,
        seqno,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [
          internal({
            to: Address.parse(contractAddress),
            value: toNano("0.05"),
            bounce: true,
            body,
          }),
        ],
      });

      console.log(`[autoclaim] #${c.index}: tx sent, waiting for confirmation...`);

      let confirmed = false;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const newSeqno = await walletContract.getSeqno();
        if (newSeqno > seqno) {
          confirmed = true;
          break;
        }
      }

      if (confirmed) {
        markChallengeClaimed(c.index);
        console.log(`[autoclaim] #${c.index}: CLAIMED ${earnedCount}/${c.totalCheckpoints} checkpoints for ${c.beneficiary}`);
      } else {
        console.warn(`[autoclaim] #${c.index}: tx sent but confirmation timed out`);
      }
    } catch (err) {
      console.error(`[autoclaim] #${c.index}: FAILED:`, err);
    }
  }
}
