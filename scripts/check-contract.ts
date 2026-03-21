import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(new URL(".", import.meta.url).pathname, "../.env.local") });

async function main() {
  const addr = process.env.VITE_CONTRACT_ADDRESS || "";
  const endpoint = process.env.VITE_TON_ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
  const apiKey = process.env.VITE_TON_API_KEY || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  const resp = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ id: "1", jsonrpc: "2.0", method: "runGetMethod", params: { address: addr, method: "challengeCount", stack: [] } }),
  });
  const json = await resp.json();
  console.log("challengeCount:", json.result?.stack?.[0]?.[1]);

  const txResp = await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ id: "2", jsonrpc: "2.0", method: "getTransactions", params: { address: addr, limit: 10 } }),
  });
  const txJson = await txResp.json();
  for (const tx of txJson.result || []) {
    const msg = tx.in_msg;
    const out = tx.out_msgs || [];
    const computeOk = tx.description?.compute_ph?.success;
    const actionOk = tx.description?.action?.success;
    const aborted = tx.description?.aborted;
    console.log(`\ntx: value=${msg?.value} from=${msg?.source?.slice(0,20)} compute=${computeOk} action=${actionOk} aborted=${aborted}`);
    console.log(`  body=${msg?.msg_data?.body?.slice(0,80)}`);
    if (out.length > 0) console.log(`  out_msgs: ${out.length}`);
    if (tx.description?.compute_ph?.exit_code !== undefined) console.log(`  exit_code=${tx.description.compute_ph.exit_code}`);
  }
}
main().catch(console.error);
