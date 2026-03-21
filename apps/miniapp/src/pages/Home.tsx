import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { getAllChallenges, normalizeAddress, type OnChainChallenge } from "../contract";
import { APP_LABELS, formatActionLabel, parseChallengeId } from "../types/challenge";

type IndexedChallenge = OnChainChallenge & { index: number };

function ChallengeCard({ challenge }: { challenge: IndexedChallenge }) {
  const { app: appKey, action, count } = parseChallengeId(challenge.challengeId);
  const appLabel = APP_LABELS[appKey as keyof typeof APP_LABELS] ?? appKey;
  const actionLabel = formatActionLabel(action);
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
  const endsAt = new Date(challenge.endDate * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <Link to={`/challenge/${challenge.index}`} className="challenge-card surface">
      <div className="challenge-card-top">
        <div>
          <div className="challenge-card-app-row">
            <div className="challenge-card-app">{appLabel}</div>
            {challenge.unlisted && <span className="mini-pill">Unlisted</span>}
          </div>
          <h3 className="challenge-card-title">{actionLabel}</h3>
        </div>
        <span className={`status-pill status-${status}`}>{status}</span>
      </div>

      <p className="challenge-card-copy">
        Unlock {count || challenge.totalCheckpoints} checkpoints before {endsAt}. Each verified step releases part of the escrow.
      </p>

      <div className="challenge-meta">
        <div className="challenge-meta-item">
          <span className="challenge-meta-label">Progress</span>
          <span className="challenge-meta-value">
            {challenge.claimedCount}/{challenge.totalCheckpoints}
          </span>
        </div>
        <div className="challenge-meta-item">
          <span className="challenge-meta-label">Pool</span>
          <span className="challenge-meta-value">
            {(Number(challenge.totalDeposit) / 1e9).toFixed(2)} TON
          </span>
        </div>
        <div className="challenge-meta-item">
          <span className="challenge-meta-label">Ends</span>
          <span className="challenge-meta-value">{endsAt}</span>
        </div>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="challenge-footer">
        <span>{progressPct}% unlocked</span>
        <span className="challenge-link">Open challenge</span>
      </div>
    </Link>
  );
}

export function Home() {
  const userAddress = useTonAddress();
  const [challenges, setChallenges] = useState<IndexedChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const hasContractAddress = Boolean(import.meta.env.VITE_CONTRACT_ADDRESS);

  const normalizedUserAddress = userAddress ? normalizeAddress(userAddress) : "";

  async function refreshChallenges() {
    if (!hasContractAddress) return;
    setLoading(true);
    setError("");
    try {
      const nextChallenges = await getAllChallenges();
      setChallenges(nextChallenges);
      setLastUpdatedAt(new Date());
    } catch (e: any) {
      console.error("Failed to load challenges:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshChallenges();
  }, [hasContractAddress]);

  const myChallenges = userAddress
    ? challenges.filter((c) => {
        const sponsor = normalizeAddress(c.sponsor);
        const beneficiary = normalizeAddress(c.beneficiary);
        return sponsor === normalizedUserAddress || beneficiary === normalizedUserAddress;
      })
    : [];
  const myChallengeIds = new Set(myChallenges.map((challenge) => challenge.index));
  const browseChallenges = challenges.filter((challenge) => !challenge.unlisted && !myChallengeIds.has(challenge.index));

  useEffect(() => {
    console.log("[Home] challenge counts", {
      totalChallenges: challenges.length,
      userChallenges: myChallenges.length,
      browseChallenges: browseChallenges.length,
      userAddress,
    });
  }, [browseChallenges.length, challenges.length, myChallenges.length, userAddress]);

  return (
    <div className="page">
      <header className="surface surface-accent hero-panel">
        <div className="hero-row">
          <div>
            <h1 className="page-title">Make the promise cost something.</h1>
          </div>
          <div className="tonconnect-slot">
            <TonConnectButton />
          </div>
        </div>
        <div className="button-row hero-actions" style={{ marginTop: "1.1rem" }}>
          <p className="hero-copy">
            Create small accountability escrows on TON. Sponsors lock the stake, beneficiaries unlock it checkpoint by checkpoint.
          </p>
          <Link to="/create" className="button-primary hero-cta">
            Create challenge
          </Link>
        </div>
      </header>

      {!hasContractAddress && (
        <div className="empty-state">
          <strong>Contract address missing</strong>
          <p>Set `VITE_CONTRACT_ADDRESS` to browse and create on-chain challenges from the miniapp.</p>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <strong>Could not load challenges</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="detail-stack">
        <div className="section-header">
          <div>
            <div className="section-heading-row">
              <div className="title-with-pill">
                <h2 className="section-title">Your challenges</h2>
                {userAddress && (
                  <span className="inline-note" title={`${myChallenges.length} challenges`} aria-label={`${myChallenges.length} challenges`}>
                    {myChallenges.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => void refreshChallenges()}
                disabled={loading}
                aria-label="Refresh your challenges"
                title="Refresh your challenges"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="section-note">
              Only challenges where the connected wallet is the sponsor or beneficiary are shown here.
            </p>
          </div>
        </div>
        {!userAddress && (
          <div className="empty-state">
            <strong>Connect your wallet</strong>
            <p>Challenge lists are now private to the connected participant view.</p>
          </div>
        )}
        {userAddress && loading && <div className="loading-card">Loading your challenges...</div>}
        {userAddress && !loading && myChallenges.length === 0 && (
          <div className="empty-state">
            <strong>No challenges yet</strong>
            <p>Create the first one and the list will populate here.</p>
          </div>
        )}
        {userAddress && (
          <div className="list-stack">
            {myChallenges.map((c) => (
              <ChallengeCard key={c.index} challenge={c} />
            ))}
          </div>
        )}
      </section>

      <section className="detail-stack">
        <div className="section-header">
          <div>
            <div className="section-heading-row">
              <div className="title-with-pill">
                <h2 className="section-title">Browse challenges</h2>
                <span className="inline-note" title={`${browseChallenges.length} public challenges`} aria-label={`${browseChallenges.length} public challenges`}>
                  {browseChallenges.length}
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => void refreshChallenges()}
                disabled={loading}
                aria-label="Refresh browse challenges"
                title="Refresh browse challenges"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="section-note">
              Public challenges from other users. Unlisted challenges stay out of this section.
            </p>
          </div>
        </div>
        {loading && <div className="loading-card">Loading browse challenges...</div>}
        {!loading && browseChallenges.length === 0 && (
          <div className="empty-state">
            <strong>No public challenges yet</strong>
            <p>When users create public challenges, they will appear here.</p>
          </div>
        )}
        {!loading && browseChallenges.length > 0 && (
          <div className="list-stack">
            {browseChallenges.map((c) => (
              <ChallengeCard key={c.index} challenge={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
