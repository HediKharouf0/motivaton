import type { EventEntry } from "./store.js";

const STRAVA_API = "https://www.strava.com/api/v3";
const STRAVA_OAUTH = "https://www.strava.com/oauth/token";

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId: number;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
}

export async function exchangeStravaCode(code: string): Promise<StravaTokens & { athlete: { id: number; username: string | null; firstname: string; lastname: string } }> {
  const resp = await fetch(STRAVA_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      client_secret: process.env.STRAVA_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) throw new Error(`Strava OAuth ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at * 1000,
    athleteId: data.athlete.id,
    athlete: {
      id: data.athlete.id,
      username: data.athlete.username || null,
      firstname: data.athlete.firstname,
      lastname: data.athlete.lastname,
    },
  };
}

export async function refreshStravaTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const resp = await fetch(STRAVA_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || "",
      client_secret: process.env.STRAVA_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) throw new Error(`Strava refresh ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_at * 1000,
  };
}

export async function fetchStravaActivities(accessToken: string, after?: number): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: "100" });
  if (after) params.set("after", String(after));
  const resp = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Strava activities ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export function extractStravaEvents(
  activities: StravaActivity[],
  since: Date,
): Record<string, EventEntry[]> {
  const result: Record<string, EventEntry[]> = {};

  for (const act of activities) {
    if (new Date(act.start_date) < since) continue;

    const id = String(act.id);
    const type = (act.sport_type || act.type || "").toLowerCase();

    // LOG_ACTIVITY — any activity
    if (!result["LOG_ACTIVITY"]) result["LOG_ACTIVITY"] = [];
    result["LOG_ACTIVITY"].push({ id, count: 1 });

    // Type-specific
    if (type === "run") {
      if (!result["RUN"]) result["RUN"] = [];
      result["RUN"].push({ id, count: 1 });
    } else if (type === "ride" || type === "virtualride") {
      if (!result["RIDE"]) result["RIDE"] = [];
      result["RIDE"].push({ id, count: 1 });
    } else if (type === "swim") {
      if (!result["SWIM"]) result["SWIM"] = [];
      result["SWIM"].push({ id, count: 1 });
    } else if (type === "walk" || type === "hike") {
      if (!result["WALK"]) result["WALK"] = [];
      result["WALK"].push({ id, count: 1 });
    }

    // Distance-based (in km)
    const km = act.distance / 1000;
    if (km > 0) {
      if (!result["LOG_KM"]) result["LOG_KM"] = [];
      result["LOG_KM"].push({ id, count: Math.floor(km) });
    }
  }

  return result;
}
