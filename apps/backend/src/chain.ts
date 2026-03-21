import { Cell } from "@ton/ton";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const TON_ENDPOINT = process.env.TON_ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = process.env.TON_API_KEY || "";

export interface OnChainChallenge {
  sponsor: string;
  beneficiary: string;
  challengeId: string;
  totalDeposit: bigint;
  totalCheckpoints: number;
  amountPerCheckpoint: bigint;
  claimedCount: number;
  endDate: number;
  active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpcCall(method: string, params: Record<string, any>): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TON_API_KEY) headers["X-API-Key"] = TON_API_KEY;
  const resp = await fetch(TON_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: "1", jsonrpc: "2.0", method, params }),
  });
  const json = await resp.json();
  if (!json.ok) throw new Error(json.error || "RPC error");
  return json.result;
}

function parseAddress(base64Boc: string): string {
  const cell = Cell.fromBase64(base64Boc);
  return cell.beginParse().loadAddress().toString();
}

function parseString(base64Boc: string): string {
  const cell = Cell.fromBase64(base64Boc);
  return cell.beginParse().loadStringTail();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseChallengeFromElements(elements: any[]): OnChainChallenge {
  return {
    sponsor: parseAddress(elements[0].slice.bytes),
    beneficiary: parseAddress(elements[1].slice.bytes),
    challengeId: parseString(elements[2].slice.bytes),
    totalDeposit: BigInt(elements[3].number.number),
    totalCheckpoints: Number(elements[4].number.number),
    amountPerCheckpoint: BigInt(elements[5].number.number),
    claimedCount: Number(elements[6].number.number),
    endDate: Number(elements[7].number.number),
    active: elements[8].number.number === "-1",
  };
}

export async function getChallenge(idx: number): Promise<OnChainChallenge | null> {
  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS env var is not set.");
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "challenge",
    stack: [["num", String(idx)]],
  });
  const entry = result.stack[0];
  if (entry[0] !== "tuple") return null;
  return parseChallengeFromElements(entry[1].elements);
}
