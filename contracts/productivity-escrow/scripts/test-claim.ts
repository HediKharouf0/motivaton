import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env.local") });

import { beginCell, Address, toNano } from "@ton/core";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { sign, keyPairFromSecretKey, mnemonicToPrivateKey } from "@ton/crypto";

async function main() {
  const TON_ENDPOINT = process.env.TON_ENDPOINT || process.env.TON_RPC_URL || "https://testnet.toncenter.com/api/v2/jsonRPC";
  const TON_API_KEY = process.env.TON_API_KEY || process.env.RPC_API_KEY || "";
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
  const VERIFIER_SECRET_KEY = process.env.VERIFIER_SECRET_KEY!;
  const MNEMONIC = process.env.WALLET_MNEMONIC!;

  const client = new TonClient({ endpoint: TON_ENDPOINT, apiKey: TON_API_KEY || undefined });
  const contractAddr = Address.parse(CONTRACT_ADDRESS);

  // Wallet setup (beneficiary wallet)
  const walletKp = await mnemonicToPrivateKey(MNEMONIC.split(" "));
  const wallet = WalletContractV5R1.create({ publicKey: walletKp.publicKey, workchain: 0 });
  const walletContract = client.open(wallet);
  const beneficiary = wallet.address;

  console.log("Wallet (beneficiary):", beneficiary.toString());
  console.log("Contract:", CONTRACT_ADDRESS);

  // Sign the claim
  const kp = keyPairFromSecretKey(Buffer.from(VERIFIER_SECRET_KEY, "hex"));
  const challengeIdx = 0;
  const earnedCount = 1;

  const dataCell = beginCell()
    .storeUint(challengeIdx, 32)
    .storeUint(earnedCount, 32)
    .storeAddress(beneficiary)
    .endCell();

  const dataHash = dataCell.hash();
  const signature = sign(dataHash, kp.secretKey);

  console.log("Data hash:", dataHash.toString("hex"));
  console.log("Signature:", signature.toString("base64"));

  // Build message
  const sigCell = beginCell().storeBuffer(signature).endCell();
  const body = beginCell()
    .storeUint(0xf9e43eb6, 32)
    .storeUint(challengeIdx, 32)
    .storeUint(earnedCount, 32)
    .storeRef(sigCell)
    .endCell();

  // Send
  const seqno = await walletContract.getSeqno();
  console.log("Sending tx, seqno:", seqno);

  await walletContract.sendTransfer({
    secretKey: walletKp.secretKey,
    seqno,
    messages: [
      {
        info: {
          type: "internal",
          dest: contractAddr,
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

  console.log("Transaction sent! Waiting...");

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const newSeqno = await walletContract.getSeqno();
    if (newSeqno > seqno) {
      console.log("Transaction confirmed!");

      // Check balance
      const balance = await client.getBalance(beneficiary);
      console.log("Wallet balance:", Number(balance) / 1e9, "TON");
      return;
    }
    process.stdout.write(".");
  }

  console.log("\nTimeout waiting for confirmation.");
}

main().catch(console.error);
