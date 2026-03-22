import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../../../.env.local") });

import { Address } from "@ton/core";
import { TonClient } from "@ton/ton";

async function main() {
  const client = new TonClient({ endpoint: process.env.TON_RPC_URL!, apiKey: process.env.RPC_API_KEY! });
  const addr = Address.parse(process.env.CONTRACT_ADDRESS!);

  // Get recent transactions
  const txs = await client.getTransactions(addr, { limit: 5 });
  for (const tx of txs) {
    console.log("---");
    console.log("lt:", tx.lt.toString());
    console.log("now:", tx.now);
    console.log("inMsg type:", tx.inMessage?.info.type);
    if (tx.inMessage?.info.type === "internal") {
      console.log("inMsg src:", tx.inMessage.info.src.toString());
      console.log("inMsg value:", tx.inMessage.info.value.coins.toString());
    }
    console.log("outMsgs:", tx.outMessagesCount);
    console.log("exitCode:", tx.description.type === "generic" ? tx.description.computePhase : "n/a");
    if (tx.description.type === "generic" && tx.description.computePhase.type === "vm") {
      console.log("  vm exitCode:", tx.description.computePhase.exitCode);
      console.log("  vm success:", tx.description.computePhase.success);
    }
  }
}

main().catch(console.error);
