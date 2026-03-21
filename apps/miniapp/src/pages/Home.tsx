import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { getAllChallenges, type OnChainChallenge } from "../contract";
import { APP_LABELS } from "../types/challenge";

type IndexedChallenge = OnChainChallenge & { index: number };

function ChallengeCard({ challenge }: { challenge: IndexedChallenge }) {
  const parts = challenge.challengeId.split(":");
  const appKey = parts[0] || "";
  const action = parts[1] || "";
  const appLabel = APP_LABELS[appKey as keyof typeof APP_LABELS] ?? appKey;
  const progressPct = Math.min(
    100,
    Math.round((challenge.claimedCount / challenge.totalCheckpoints) * 100),
  );
  const expired = Date.now() / 1000 > challenge.endDate;
  const status = !challenge.active
    ? challenge.claimedCount >= challenge.totalCheckpoints
      ? "completed"
      : "closed"
    : expired
      ? "expired"
      : "active";

  return (
    <Link
      to={`/challenge/${challenge.index}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", marginBottom: 12 }}
    >
      <div className="challenge-summary" style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong>{appLabel}: {action}</strong>
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 6,
              background:
                status === "completed" ? "#4caf50" : status === "expired" || status === "closed" ? "#f44336" : "var(--tg-theme-button-color)",
              color: "#fff",
            }}
          >
            {status}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "var(--tg-theme-hint-color)", marginBottom: 6 }}>
          {challenge.claimedCount}/{challenge.totalCheckpoints} claimed &middot;{" "}
          {(Number(challenge.totalDeposit) / 1e9).toFixed(2)} TON
        </div>
        <div style={{ background: "#e0e0e0", borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPct}%`,
              background: status === "completed" ? "#4caf50" : "var(--tg-theme-button-color)",
              height: "100%",
              borderRadius: 6,
            }}
          />
        </div>
      </div>
    </Link>
  );
}

export function Home() {
  const userAddress = useTonAddress();
  const [challenges, setChallenges] = useState<IndexedChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!import.meta.env.VITE_CONTRACT_ADDRESS) return;
    setLoading(true);
    setError("");
    getAllChallenges()
      .then(setChallenges)
      .catch((e) => {
        console.error("Failed to load challenges:", e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const myChallenges = userAddress
    ? challenges.filter((c) => c.sponsor === userAddress || c.beneficiary === userAddress)
    : [];
  const myIds = new Set(myChallenges.map((c) => c.index));
  const browseChallenges = challenges.filter((c) => !myIds.has(c.index));

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Motivaton</h1>
        <TonConnectButton />
      </div>
      <p style={{ marginBottom: 24, color: "var(--tg-theme-hint-color)" }}>
        Create productivity challenges backed by real TON. Hold yourself or a friend accountable.
      </p>
      <Link to="/create" className="nav-btn" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
        Create Challenge
      </Link>

      {error && <p style={{ color: "#f44336", marginBottom: 16 }}>{error}</p>}

      {userAddress && (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Your Challenges</h2>
          {loading && <p style={{ color: "var(--tg-theme-hint-color)" }}>Loading...</p>}
          {!loading && myChallenges.length === 0 && (
            <p style={{ color: "var(--tg-theme-hint-color)", marginBottom: 24 }}>No challenges yet.</p>
          )}
          {myChallenges.map((c) => (
            <ChallengeCard key={c.index} challenge={c} />
          ))}
          <div style={{ marginBottom: 24 }} />
        </>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Browse Challenges</h2>
      {loading && <p style={{ color: "var(--tg-theme-hint-color)" }}>Loading...</p>}
      {!loading && browseChallenges.length === 0 && (
        <p style={{ color: "var(--tg-theme-hint-color)" }}>No other challenges to browse.</p>
      )}
      {browseChallenges.map((c) => (
        <ChallengeCard key={c.index} challenge={c} />
      ))}
    </div>
  );
}
