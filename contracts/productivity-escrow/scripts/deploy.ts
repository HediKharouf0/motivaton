import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env.local") });

import { toNano, Address } from "@ton/core";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { ProductivityEscrow } from "../build/ProductivityEscrow_ProductivityEscrow";

async function main() {
  const MNEMONIC = process.env.DEPLOY_MNEMONIC || process.env.WALLET_MNEMONIC;
  const VERIFIER_PUBKEY = process.env.VERIFIER_PUBLIC_KEY;
  const FEE_WALLET_A = process.env.FEE_WALLET_A;
  const FEE_WALLET_B = process.env.FEE_WALLET_B;
  const TON_ENDPOINT = process.env.TON_ENDPOINT || process.env.TON_RPC_URL || "https://testnet.toncenter.com/api/v2/jsonRPC";
  const TON_API_KEY = process.env.TON_API_KEY || process.env.RPC_API_KEY || "";

  if (!MNEMONIC) {
    console.error("DEPLOY_MNEMONIC env var is required (24-word mnemonic).");
    process.exit(1);
  }
  if (!VERIFIER_PUBKEY) {
    console.error("VERIFIER_PUBLIC_KEY env var is required (hex-encoded 32-byte ed25519 public key).");
    process.exit(1);
  }
  if (!FEE_WALLET_A || !FEE_WALLET_B) {
    console.error("FEE_WALLET_A and FEE_WALLET_B env vars are required.");
    process.exit(1);
  }

  const client = new TonClient({ endpoint: TON_ENDPOINT, apiKey: TON_API_KEY || undefined });
  const keypair = await mnemonicToPrivateKey(MNEMONIC.split(" "));

  const wallet = WalletContractV5R1.create({ publicKey: keypair.publicKey, workchain: 0 });
  const walletContract = client.open(wallet);
  const walletAddress = wallet.address;

  console.log("Deployer wallet:", walletAddress.toString());

  const balance = await client.getBalance(walletAddress);
  console.log("Wallet balance:", Number(balance) / 1e9, "TON");

  if (balance < toNano("0.5")) {
    console.error("Insufficient balance. Need at least 0.5 TON for deployment.");
    process.exit(1);
  }

  const verifierPubKeyBigInt = BigInt("0x" + VERIFIER_PUBKEY);

  const feeWalletA = Address.parse(FEE_WALLET_A);
  const feeWalletB = Address.parse(FEE_WALLET_B);

  const contract = client.open(
    await ProductivityEscrow.fromInit(walletAddress, verifierPubKeyBigInt, feeWalletA, feeWalletB),
  );

  const contractAddress = contract.address;
  console.log("Contract address:", contractAddress.toString());

  // Check if already deployed
  const state = await client.getContractState(contractAddress);
  if (state.state === "active") {
    console.log("Contract is already deployed at this address.");
    process.exit(0);
  }

  console.log("Deploying ProductivityEscrow...");

  const seqno = await walletContract.getSeqno();

  await contract.send(
    {
      send: async (args) => {
        await walletContract.sendTransfer({
          secretKey: keypair.secretKey,
          seqno,
          messages: [
            {
              info: {
                type: "internal",
                dest: args.to,
                value: { coins: args.value },
                bounce: args.bounce ?? true,
                ihrDisabled: true,
                bounced: false,
                ihrFee: 0n,
                forwardFee: 0n,
                createdAt: 0,
                createdLt: 0n,
              },
              body: args.body ?? undefined,
              init: args.init ?? undefined,
            } as any,
          ],
        });
      },
    },
    { value: toNano("0.3") },
    { $$type: "Deploy", queryId: 0n },
  );

  console.log("Transaction sent. Waiting for deployment...");

  // Poll for deployment
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const newState = await client.getContractState(contractAddress);
    if (newState.state === "active") {
      console.log("\nContract deployed successfully!");
      console.log("Address:", contractAddress.toString());
      console.log("\nSet this in your .env files:");
      console.log(`  VITE_CONTRACT_ADDRESS=${contractAddress.toString()}`);
      console.log(`  CONTRACT_ADDRESS=${contractAddress.toString()}`);
      return;
    }
    process.stdout.write(".");
  }

  console.error("\nDeployment timed out. Check the transaction on an explorer.");
  process.exit(1);
}

main().catch((e) => {
  console.error("Deploy failed:", e.message);
  process.exit(1);
});
