import type { EventEntry } from "./store.js";

const CHESSCOM_API = "https://api.chess.com/pub";

interface ChessComGame {
  url: string;
  end_time: number;
  time_class: string; // "rapid" | "blitz" | "bullet" | "daily"
  white: { username: string; result: string };
  black: { username: string; result: string };
}

async function chesscomFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${CHESSCOM_API}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Chess.com API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export async function fetchRecentGames(username: string): Promise<ChessComGame[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  try {
    const data = await chesscomFetch<{ games: ChessComGame[] }>(
      `/player/${username.toLowerCase()}/games/${year}/${month}`,
    );
    return data.games ?? [];
  } catch {
    return [];
  }
}

function getUserResult(game: ChessComGame, username: string): { result: string; timeClass: string } | null {
  const lower = username.toLowerCase();
  if (game.white.username.toLowerCase() === lower) {
    return { result: game.white.result, timeClass: game.time_class };
  }
  if (game.black.username.toLowerCase() === lower) {
    return { result: game.black.result, timeClass: game.time_class };
  }
  return null;
}

function isWin(result: string): boolean {
  return result === "win";
}

function gameId(game: ChessComGame): string {
  // URL is unique per game
  return game.url.split("/").pop() ?? String(game.end_time);
}

export function extractChessComEvents(
  games: ChessComGame[],
  username: string,
  since: Date,
): Record<string, EventEntry[]> {
  const result: Record<string, EventEntry[]> = {};

  for (const game of games) {
    if (new Date(game.end_time * 1000) < since) continue;

    const userResult = getUserResult(game, username);
    if (!userResult) continue;

    const id = gameId(game);

    // PLAY_GAME — all completed games
    if (!result["PLAY_GAME"]) result["PLAY_GAME"] = [];
    result["PLAY_GAME"].push({ id, count: 1 });

    if (isWin(userResult.result)) {
      // WIN_GAME — all wins
      if (!result["WIN_GAME"]) result["WIN_GAME"] = [];
      result["WIN_GAME"].push({ id: `${id}_win`, count: 1 });

      // Time-control-specific wins
      const tcAction = `WIN_${userResult.timeClass.toUpperCase()}`;
      if (["WIN_RAPID", "WIN_BLITZ", "WIN_BULLET"].includes(tcAction)) {
        if (!result[tcAction]) result[tcAction] = [];
        result[tcAction].push({ id: `${id}_${tcAction}`, count: 1 });
      }
    }
  }

  return result;
}

export async function verifyChessComUsername(username: string): Promise<boolean> {
  try {
    await chesscomFetch<{ username: string }>(`/player/${username.toLowerCase()}`);
    return true;
  } catch {
    return false;
  }
}
