import { Address, beginCell, toNano, Cell } from "@ton/ton";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const TON_ENDPOINT = import.meta.env.VITE_TON_ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = import.meta.env.VITE_TON_API_KEY || "";

// Opcodes from compiled Tact ABI
const OP_CREATE_CHALLENGE = 0xf05423d0;
const OP_CLAIM_CHECKPOINT = 0x7b562c3f;
const OP_REFUND_UNCLAIMED = 0x70ccaed4;

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

export async function getChallengeCount(): Promise<number> {
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "challengeCount",
    stack: [],
  });
  return Number(result.stack[0][1]);
}

export async function getChallenge(idx: number): Promise<OnChainChallenge | null> {
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "challenge",
    stack: [["num", String(idx)]],
  });
  const entry = result.stack[0];
  // entry is ["tuple", { elements: [...] }] for present, or ["num", "0"] for null
  if (entry[0] !== "tuple") return null;
  return parseChallengeFromElements(entry[1].elements);
}

export async function getAllChallenges(): Promise<(OnChainChallenge & { index: number })[]> {
  const count = await getChallengeCount();
  const challenges: (OnChainChallenge & { index: number })[] = [];
  for (let i = 0; i < count; i++) {
    const c = await getChallenge(i);
    if (c) challenges.push({ ...c, index: i });
  }
  return challenges;
}

export async function isCheckpointClaimed(challengeIdx: number, checkpointIdx: number): Promise<boolean> {
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "isCheckpointClaimed",
    stack: [["num", String(challengeIdx)], ["num", String(checkpointIdx)]],
  });
  return result.stack[0][1] === "-1";
}

/**
 * CreateChallenge: opcode(32) | beneficiary(addr) | challengeId(string ref tail) | totalCheckpoints(uint32) | endDate(uint64)
 */
export function buildCreateChallengeBody(
  beneficiary: string,
  challengeId: string,
  totalCheckpoints: number,
  endDate: number,
) {
  return beginCell()
    .storeUint(OP_CREATE_CHALLENGE, 32)
    .storeAddress(Address.parse(beneficiary))
    .storeStringRefTail(challengeId)
    .storeUint(totalCheckpoints, 32)
    .storeUint(endDate, 64)
    .endCell();
}

/**
 * ClaimCheckpoint: opcode(32) | challengeIdx(uint32) | checkpointIndex(uint32) | signature(ref cell)
 */
export function buildClaimCheckpointBody(
  challengeIdx: number,
  checkpointIndex: number,
  signatureBase64: string,
) {
  const sigBuf = Buffer.from(signatureBase64, "base64");
  const sigCell = beginCell().storeBuffer(sigBuf).endCell();

  return beginCell()
    .storeUint(OP_CLAIM_CHECKPOINT, 32)
    .storeUint(challengeIdx, 32)
    .storeUint(checkpointIndex, 32)
    .storeRef(sigCell)
    .endCell();
}

/**
 * RefundUnclaimed: opcode(32) | challengeIdx(uint32)
 */
export function buildRefundUnclaimedBody(challengeIdx: number) {
  return beginCell()
    .storeUint(OP_REFUND_UNCLAIMED, 32)
    .storeUint(challengeIdx, 32)
    .endCell();
}

export { toNano, CONTRACT_ADDRESS };
