import { Address, beginCell, toNano, Cell } from "@ton/ton";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const TON_ENDPOINT = import.meta.env.VITE_TON_ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
const TON_API_KEY = import.meta.env.VITE_TON_API_KEY || "";

// Opcodes from compiled Tact ABI
const OP_CREATE_CHALLENGE = 0xc2860504;
const OP_ADD_FUNDS = 0x48402acd;
const OP_CLAIM_ALL = 0xf9e43eb6;
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
  createdAt: number;
  active: boolean;
  unlisted: boolean;
}

// Toncenter getter responses vary between object and array-based stack item shapes.
// Normalize those shapes here so the UI doesn't depend on one specific JSON encoding.
function getStackItemType(item: unknown): string | undefined {
  if (Array.isArray(item)) return typeof item[0] === "string" ? item[0] : undefined;
  if (!item || typeof item !== "object") return undefined;
  if (typeof (item as { type?: unknown }).type === "string") return (item as { type: string }).type;
  if ("number" in item) return "num";
  if ("slice" in item) return "slice";
  if ("cell" in item) return "cell";
  if ("tuple" in item || "elements" in item) return "tuple";
  return undefined;
}

function getStackItemValue(item: unknown): unknown {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === "object" && "value" in item) {
    return (item as { value: unknown }).value;
  }
  return item;
}

function getTupleElements(item: unknown): unknown[] | null {
  const value = getStackItemValue(item);
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as { elements?: unknown[] }).elements)) {
    return (value as { elements: unknown[] }).elements;
  }
  if (item && typeof item === "object" && Array.isArray((item as { elements?: unknown[] }).elements)) {
    return (item as { elements: unknown[] }).elements;
  }
  return null;
}

function getSliceBase64(item: unknown): string {
  const value = getStackItemValue(item);
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { bytes?: unknown }).bytes === "string") {
    return (value as { bytes: string }).bytes;
  }
  if (item && typeof item === "object") {
    const nestedSlice = (item as { slice?: { bytes?: string } }).slice;
    if (typeof nestedSlice?.bytes === "string") return nestedSlice.bytes;
    const nestedCell = (item as { cell?: { bytes?: string } }).cell;
    if (typeof nestedCell?.bytes === "string") return nestedCell.bytes;
  }
  throw new Error("Unexpected getter slice shape");
}

function getBigIntValue(item: unknown): bigint {
  const value = getStackItemValue(item);
  if (typeof value === "string" || typeof value === "number") return BigInt(value);
  if (value && typeof value === "object") {
    const nestedNumber = (value as { number?: unknown }).number;
    if (typeof nestedNumber === "string" || typeof nestedNumber === "number") {
      return BigInt(nestedNumber);
    }
  }
  if (item && typeof item === "object") {
    const nestedNumber = (item as { number?: { number?: string | number } }).number?.number;
    if (typeof nestedNumber === "string" || typeof nestedNumber === "number") {
      return BigInt(nestedNumber);
    }
  }
  throw new Error("Unexpected getter number shape");
}

function getBooleanValue(item: unknown): boolean {
  const value = getStackItemValue(item);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (value && typeof value === "object") {
    const nestedBoolean = (value as { boolean?: unknown }).boolean;
    if (typeof nestedBoolean === "boolean") return nestedBoolean;
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === "boolean") return nestedValue;
  }
  if (item && typeof item === "object") {
    const directBoolean = (item as { boolean?: boolean | { value?: boolean } }).boolean;
    if (typeof directBoolean === "boolean") return directBoolean;
    if (directBoolean && typeof directBoolean === "object" && typeof directBoolean.value === "boolean") {
      return directBoolean.value;
    }
  }
  return getBigIntValue(item) !== 0n;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpcParallel(calls: { method: string; params: Record<string, any> }[]): Promise<any[]> {
  return Promise.all(calls.map((c) => rpcCall(c.method, c.params)));
}

function parseAddress(base64Boc: string): string {
  const cell = Cell.fromBase64(base64Boc);
  return cell.beginParse().loadAddress().toString();
}

function parseString(base64Boc: string): string {
  const cell = Cell.fromBase64(base64Boc);
  return cell.beginParse().loadStringTail();
}

export function normalizeAddress(address: string): string {
  return Address.parse(address).toRawString();
}

function parseChallengeFromElements(elements: unknown[]): OnChainChallenge {
  return {
    sponsor: parseAddress(getSliceBase64(elements[0])),
    beneficiary: parseAddress(getSliceBase64(elements[1])),
    challengeId: parseString(getSliceBase64(elements[2])),
    totalDeposit: getBigIntValue(elements[3]),
    totalCheckpoints: Number(getBigIntValue(elements[4])),
    amountPerCheckpoint: getBigIntValue(elements[5]),
    claimedCount: Number(getBigIntValue(elements[6])),
    endDate: Number(getBigIntValue(elements[7])),
    createdAt: Number(getBigIntValue(elements[8])),
    active: getBooleanValue(elements[9]),
    unlisted: getBooleanValue(elements[10]),
  };
}

export async function getChallengeCount(): Promise<number> {
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "challengeCount",
    stack: [],
  });
  return Number(getBigIntValue(result.stack[0]));
}

export async function getChallenge(idx: number): Promise<OnChainChallenge | null> {
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "challenge",
    stack: [["num", String(idx)]],
  });
  const entry = result.stack[0];
  if (getStackItemType(entry) !== "tuple") return null;
  const elements = getTupleElements(entry);
  if (!elements) return null;
  return parseChallengeFromElements(elements);
}

export async function getAllChallenges(): Promise<(OnChainChallenge & { index: number })[]> {
  const count = await getChallengeCount();
  if (count === 0) return [];
  const calls = Array.from({ length: count }, (_, i) => ({
    method: "runGetMethod",
    params: { address: CONTRACT_ADDRESS, method: "challenge", stack: [["num", String(i)]] },
  }));
  const results = await rpcParallel(calls);
  const challenges: (OnChainChallenge & { index: number })[] = [];
  for (let i = 0; i < results.length; i++) {
    const entry = results[i].stack[0];
    if (getStackItemType(entry) !== "tuple") continue;
    const elements = getTupleElements(entry);
    if (!elements) continue;
    challenges.push({ ...parseChallengeFromElements(elements), index: i });
  }
  return challenges;
}

export function buildCreateChallengeBody(
  beneficiary: string,
  challengeId: string,
  totalCheckpoints: number,
  endDate: number,
  unlisted: boolean,
) {
  return beginCell()
    .storeUint(OP_CREATE_CHALLENGE, 32)
    .storeAddress(Address.parse(beneficiary))
    .storeStringRefTail(challengeId)
    .storeUint(totalCheckpoints, 32)
    .storeUint(endDate, 64)
    .storeBit(unlisted)
    .endCell();
}

export function buildAddFundsBody(challengeIdx: number) {
  return beginCell()
    .storeUint(OP_ADD_FUNDS, 32)
    .storeUint(challengeIdx, 32)
    .endCell();
}

export async function getSponsorContribution(challengeIdx: number, sponsorAddress: string): Promise<bigint> {
  const addrCell = beginCell().storeAddress(Address.parse(sponsorAddress)).endCell();
  const result = await rpcCall("runGetMethod", {
    address: CONTRACT_ADDRESS,
    method: "sponsorContribution",
    stack: [
      ["num", String(challengeIdx)],
      ["tvm.Slice", addrCell.toBoc().toString("base64")],
    ],
  });
  return getBigIntValue(result.stack[0]);
}

/**
 * ClaimAll: opcode(32) | challengeIdx(uint32) | earnedCount(uint32) | signature(slice)
 */
export function buildClaimAllBody(
  challengeIdx: number,
  earnedCount: number,
  signatureBase64: string,
) {
  const sigBuf = Buffer.from(signatureBase64, "base64");

  return beginCell()
    .storeUint(OP_CLAIM_ALL, 32)
    .storeUint(challengeIdx, 32)
    .storeUint(earnedCount, 32)
    .storeBuffer(sigBuf)
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
