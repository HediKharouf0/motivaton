import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { normalizeAddress } from "../contract";
import { useChallengeCache, type IndexedChallenge } from "../challenge-cache";
import { App, APP_ACTIONS, APP_LABELS, formatActionLabel, parseChallengeId } from "../types/challenge";
import { backendApi } from "../api";

type ChallengeStatusFilter = "ALL" | "ACTIVE" | "READY" | "COMPLETED" | "EXPIRED";

const STATUS_OPTIONS: { value: ChallengeStatusFilter; label: string }[] = [
  { value: "ALL", label: "Any status" },
  { value: "ACTIVE", label: "Active" },
  { value: "READY", label: "Ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "EXPIRED", label: "Expired" },
];

function formatTonAmount(value: bigint | number) {
  const ton = Number(value) / 1e9;
  if (!Number.isFinite(ton)) return "--";
  if (ton >= 100) return ton.toFixed(0);
  if (ton >= 10) return ton.toFixed(1).replace(/\.0$/, "");
  return ton.toFixed(2).replace(/\.00$/, "");
}

function formatShortDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatWalletPreview(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getActionIcon(appKey: string, action: string) {
  if (appKey === "LEETCODE") {
    switch (action) {
      case "SOLVE_HARD":
        return "neurology";
      case "MAINTAIN_STREAK":
        return "local_fire_department";
      default:
        return "code_blocks";
    }
  }

  switch (action) {
    case "MERGE_PR":
      return "merge";
    case "CREATE_PR":
      return "call_split";
    case "OPEN_ISSUE":
      return "bug_report";
    case "REVIEW":
      return "rate_review";
    default:
      return "terminal";
  }
}

function getVisibleStepCount(totalCheckpoints: number) {
  return Math.min(totalCheckpoints, 6);
}

function ChallengeCard({
  challenge,
  progress,
  claimed,
}: {
  challenge: IndexedChallenge;
  progress: number;
  claimed: boolean;
}) {
  const { app: appKey, action } = parseChallengeId(challenge.challengeId);
  const appLabel = APP_LABELS[appKey as keyof typeof APP_LABELS] ?? appKey;
  const actionLabel = formatActionLabel(action);
  const expired = Date.now() / 1000 > challenge.endDate;
  const earnedCount = Math.min(progress, challenge.totalCheckpoints);
  const progressPct = Math.min(100, Math.round((earnedCount / challenge.totalCheckpoints) * 100));
  const fullyReleased = claimed || challenge.claimedCount >= challenge.totalCheckpoints;
  const statusKey = fullyReleased
    ? "completed"
    : earnedCount >= challenge.totalCheckpoints
      ? "ready"
      : expired
        ? "expired"
        : "active";
  const statusLabel =
    statusKey === "completed"
      ? "Completed"
      : statusKey === "ready"
        ? "Ready"
        : statusKey === "expired"
          ? "Expired"
          : "Active";
  const visibleSteps = getVisibleStepCount(challenge.totalCheckpoints);
  const hiddenSteps = Math.max(0, challenge.totalCheckpoints - visibleSteps);

  return (
    <Link to={`/challenge/${challenge.index}`} state={{ challenge }} className="vault-card">
      <div className="vault-card-head">
        <div className="vault-header-row">
          <div className="vault-title-wrap">
            <div className="vault-label-row">
              <span className="vault-app-tag">{appLabel}</span>
              {challenge.unlisted && <span className="mini-tag">Unlisted</span>}
              <span className={`state-pill is-${statusKey}`}>{statusLabel}</span>
            </div>
            <div className="vault-title-row">
              <span className={`vault-icon ${appKey === "LEETCODE" ? "is-leetcode" : "is-github"}`}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {getActionIcon(appKey, action)}
                </span>
              </span>
              <h3 className="vault-title">{actionLabel} <span className="mini-tag">#{challenge.index}</span></h3>
            </div>
          </div>
          <div className="vault-money">
            <span className="vault-money-value">{formatTonAmount(challenge.totalDeposit)} TON</span>
            <span className="vault-money-label">Locked reward</span>
          </div>
        </div>
      </div>

      <div className="vault-progress-row">
        <span className="vault-progress-label">Progress</span>
        <span className="vault-progress-value">
          {earnedCount} / {challenge.totalCheckpoints} checkpoints
        </span>
      </div>

      <div className="vault-progress-track" aria-hidden="true">
        <div className="vault-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="vault-foot">
        <div className="vault-foot-item">
          <span className="vault-foot-label">Per checkpoint</span>
          <span className="vault-foot-value">{formatTonAmount(challenge.amountPerCheckpoint)} TON</span>
        </div>
        <div className="vault-foot-item">
          <span className="vault-foot-label">Ends</span>
          <span className="vault-foot-value">{formatShortDate(challenge.endDate)}</span>
        </div>
      </div>
    </Link>
  );
}

export function Home() {
  const userAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const {
    challenges,
    progressMap,
    claimedMap,
    loading,
    error,
    hasContractAddress,
    refreshChallenges,
  } = useChallengeCache();

  const normalizedUserAddress = userAddress ? normalizeAddress(userAddress) : "";

  useEffect(() => {
    void refreshChallenges();
  }, [refreshChallenges]);

  useEffect(() => {
    if (!userAddress) return;
    const tg = (window as any).Telegram?.WebApp;
    const chatId = tg?.initDataUnsafe?.user?.id;
    if (chatId) {
      backendApi.registerTelegramChatId(userAddress, chatId).catch(() => {});
    }
  }, [userAddress]);

  const myChallenges = userAddress
    ? challenges.filter((challenge) => {
        const sponsor = normalizeAddress(challenge.sponsor);
        const beneficiary = normalizeAddress(challenge.beneficiary);
        return sponsor === normalizedUserAddress || beneficiary === normalizedUserAddress;
      })
    : [];

  const myChallengeIds = new Set(myChallenges.map((challenge) => challenge.index));
  const browseChallenges = challenges.filter((challenge) => !challenge.unlisted && !myChallengeIds.has(challenge.index));

  return (
    <div className="screen">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link to="/" className="brand-lockup" aria-label="Motivaton home">
            <div className="brand-copy">
              <div className="brand-title">MOTIVATON</div>
              <div className="brand-subtitle">Reward Engine</div>
            </div>
          </Link>

          <button type="button" className="wallet-control" onClick={() => void tonConnectUI.openModal()}>
            {userAddress ? formatWalletPreview(userAddress) : "Connect"}
          </button>
        </div>
      </header>

      <main className="page-frame">
        <div className="page-stack">
          <section className="panel panel-accent home-hero">
            <div className="loop-grid" aria-hidden="true">
              <div className="loop-card">
                <span className="material-symbols-outlined">lock</span>
                <div className="loop-card-title">Lock</div>
                <div className="loop-card-copy">TON escrow</div>
              </div>
              <div className="loop-card">
                <span className="material-symbols-outlined">terminal</span>
                <div className="loop-card-title">Track</div>
                <div className="loop-card-copy">Real activity</div>
              </div>
              <div className="loop-card">
                <span className="material-symbols-outlined">currency_exchange</span>
                <div className="loop-card-title">Claim</div>
                <div className="loop-card-copy">Reward released</div>
              </div>
            </div>

            <div className="eyebrow">TON productivity escrow</div>
            <h1 className="display-title">
              Productivity is <span className="display-accent">incentivized.</span>
            </h1>
            <p className="support-copy">
              Lock money behind checkpoints. Match the work. Release the reward.
            </p>

            <div className="hero-toolbar">
              <Link to="/create" className="primary-button">
                <span className="material-symbols-outlined" aria-hidden="true">
                  add_circle
                </span>
                <span>Build challenge</span>
              </Link>
              <div className="hero-note">
                Create GitHub or LeetCode reward paths directly from Telegram.
              </div>
            </div>
          </section>

          {!hasContractAddress && (
            <div className="state-card">
              <strong>Contract missing</strong>
              <p>Set `VITE_CONTRACT_ADDRESS` before creating or browsing on-chain challenges.</p>
            </div>
          )}

          {error && (
            <div className="state-card error">
              <strong>Could not load challenges</strong>
              <p>{error}</p>
            </div>
          )}

          <section className="panel section-shell">
            <div className="section-heading">
              <div>
                <div className="section-kicker">Vault</div>
                <h2 className="section-title">Your challenges</h2>
              </div>
              <div className="section-meta">
                {userAddress && <span className="mini-tag">{myChallenges.length} live</span>}
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void refreshChallenges()}
                  disabled={loading}
                  aria-label="Refresh your challenges"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    refresh
                  </span>
                </button>
              </div>
            </div>

            {!userAddress && (
              <div className="state-card">
                <strong>Connect your wallet</strong>
                <p>Your private vaults appear here as soon as the participant wallet is connected.</p>
              </div>
            )}

            {userAddress && loading && (
              <div className="state-card loading">
                <strong>Loading vaults</strong>
                <p>Fetching your active and completed reward paths.</p>
              </div>
            )}

            {userAddress && !loading && myChallenges.length === 0 && (
              <div className="state-card">
                <strong>No vaults yet</strong>
                <p>Your funded or assigned challenges will appear here first.</p>
              </div>
            )}

            {userAddress && myChallenges.length > 0 && (
              <div className="vault-list">
                {myChallenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.index}
                    challenge={challenge}
                    progress={progressMap[String(challenge.index)] || 0}
                    claimed={claimedMap[String(challenge.index)] || false}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="panel section-shell">
            <div className="section-heading">
              <div>
                <div className="section-kicker">Discover</div>
                <h2 className="section-title">Public vaults</h2>
              </div>
              <div className="section-meta">
                <span className="mini-tag">{browseChallenges.length} open</span>
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void refreshChallenges()}
                  disabled={loading}
                  aria-label="Refresh public challenges"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    refresh
                  </span>
                </button>
              </div>
            </div>

            {loading && (
              <div className="state-card loading">
                <strong>Loading public vaults</strong>
                <p>Pulling the latest public challenges from chain and backend cache.</p>
              </div>
            )}

            {!loading && browseChallenges.length === 0 && (
              <div className="state-card">
                <strong>No public vaults yet</strong>
                <p>When users publish public reward paths, they will land here.</p>
              </div>
            )}

            {browseChallenges.length > 0 && (
              <div className="vault-list">
                {browseChallenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.index}
                    challenge={challenge}
                    progress={progressMap[String(challenge.index)] || 0}
                    claimed={claimedMap[String(challenge.index)] || false}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
