import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import {
  CONTRACT_ADDRESS,
  buildAddFundsBody,
  buildClaimAllBody,
  buildRefundUnclaimedBody,
  getChallenge,
  getSponsorContribution,
  normalizeAddress,
  toNano,
  type OnChainChallenge,
} from "../contract";
import { backendApi, type AuthStatus, type VerificationResult } from "../api";
import { useChallengeCache } from "../challenge-cache";
import { APP_LABELS, formatActionLabel, parseChallengeId } from "../types/challenge";

const CONNECTABLE_APPS = ["github", "leetcode", "chesscom", "strava"] as const;

type IndexedChallenge = OnChainChallenge & { index: number };
type ChallengeLocationState = { challenge?: IndexedChallenge };
type RouteState = "claimed" | "ready" | "current" | "locked";

function getConnectableAppKey(appKey: string): (typeof CONNECTABLE_APPS)[number] | null {
  const authKey = appKey.toLowerCase() as (typeof CONNECTABLE_APPS)[number];
  return CONNECTABLE_APPS.includes(authKey) ? authKey : null;
}

function buildClaimedMap(challenge: OnChainChallenge) {
  return Array.from({ length: challenge.totalCheckpoints }, (_, index) => index < challenge.claimedCount);
}

function formatWalletPreview(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

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

function formatRelativeDeadline(timestamp: number) {
  const diffMs = timestamp * 1000 - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays <= 0) return "Ended";
  if (diffDays === 1) return "1 day left";
  return `${diffDays} days left`;
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

  if (appKey === "CHESSCOM") {
    return "sports_esports";
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

function getRouteState(params: {
  index: number;
  challenge: OnChainChallenge;
  earnedCount: number;
  fullyReleased: boolean;
}): RouteState {
  const { index, challenge, earnedCount, fullyReleased } = params;

  if (fullyReleased || index < challenge.claimedCount) return "claimed";
  if (index < earnedCount) return "ready";
  if (index === earnedCount && earnedCount < challenge.totalCheckpoints) return "current";
  return "locked";
}

function getRouteStateLabel(state: RouteState, canClaimRewards: boolean) {
  switch (state) {
    case "claimed":
      return "Released";
    case "ready":
      return canClaimRewards ? "Ready" : "Matched";
    case "current":
      return "Now";
    default:
      return "Locked";
  }
}

function getRouteCopy(state: RouteState, actionLabel: string, canClaimRewards: boolean) {
  const actionCopy = actionLabel.toLowerCase();

  switch (state) {
    case "claimed":
      return "Already released to the beneficiary.";
    case "ready":
      return canClaimRewards
        ? "Verified and waiting for the claim transaction."
        : `Progress matched. Claim opens when the path completes or expires.`;
    case "current":
      return `The next verified ${actionCopy} lands here.`;
    default:
      return `Unlocks after the earlier ${actionCopy} checkpoints are complete.`;
  }
}

function getApiShortReason(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const shortReason = (error as { shortReason?: unknown }).shortReason;
  return typeof shortReason === "string" ? shortReason : "";
}

export function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const { getCachedChallenge, progressMap, claimedMap, storeChallenge } = useChallengeCache();

  const idx = Number.parseInt(id || "0", 10);
  const locationState = location.state as ChallengeLocationState | null;
  const cachedChallenge = getCachedChallenge(idx);
  const prefetchedChallenge =
    locationState?.challenge && locationState.challenge.index === idx
      ? locationState.challenge
      : cachedChallenge;

  const [challenge, setChallenge] = useState<OnChainChallenge | null>(prefetchedChallenge);
  const [checkpointMap, setCheckpointMap] = useState<boolean[]>(
    prefetchedChallenge ? buildClaimedMap(prefetchedChallenge) : [],
  );
  const [loading, setLoading] = useState(prefetchedChallenge === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [inspectionRefusal, setInspectionRefusal] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [userContribution, setUserContribution] = useState<bigint | null>(null);
  const [creatorContribution, setCreatorContribution] = useState<bigint | null>(null);
  const [duolingoInput, setDuolingoInput] = useState("");
  const [leetcodeInput, setLeetcodeInput] = useState("");
  const [chesscomInput, setChesscomInput] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [backendProgress, setBackendProgress] = useState<number>(
    prefetchedChallenge ? progressMap[String(prefetchedChallenge.index)] ?? prefetchedChallenge.claimedCount : 0,
  );
  const [backendClaimed, setBackendClaimed] = useState<boolean>(
    prefetchedChallenge ? claimedMap[String(prefetchedChallenge.index)] ?? false : false,
  );

  useEffect(() => {
    setLoading(prefetchedChallenge === null);
    setChallenge(prefetchedChallenge);
    setCheckpointMap(prefetchedChallenge ? buildClaimedMap(prefetchedChallenge) : []);
    setUserContribution(null);
    setCreatorContribution(null);
    setVerification(null);
    setInspectionRefusal("");
    setAuthStatus(null);
    setBackendProgress(
      prefetchedChallenge ? progressMap[String(prefetchedChallenge.index)] ?? prefetchedChallenge.claimedCount : 0,
    );
    setBackendClaimed(
      prefetchedChallenge ? claimedMap[String(prefetchedChallenge.index)] ?? false : false,
    );
    setError("");

    void loadChallenge({
      seedChallenge: prefetchedChallenge,
      forceRefresh: prefetchedChallenge === null,
      showBlockingLoader: prefetchedChallenge === null,
    });
  }, [idx, userAddress]);

  async function loadChallenge(options?: {
    forceRefresh?: boolean;
    seedChallenge?: OnChainChallenge | null;
    showBlockingLoader?: boolean;
  }) {
    const showBlockingLoader = options?.showBlockingLoader ?? challenge === null;

    if (showBlockingLoader) {
      setLoading(true);
    }

    setError("");

    try {
      let nextChallenge = options?.seedChallenge ?? challenge;
      if (options?.forceRefresh || !nextChallenge) {
        nextChallenge = await getChallenge(idx);
      }

      setChallenge(nextChallenge);

      if (!nextChallenge) {
        setCheckpointMap([]);
        setUserContribution(null);
        setCreatorContribution(null);
        setAuthStatus(null);
        return;
      }

      const creatorContributionPromise = getSponsorContribution(idx, nextChallenge.sponsor);
      const userContributionPromise = userAddress
        ? userAddress === nextChallenge.sponsor
          ? creatorContributionPromise
          : getSponsorContribution(idx, userAddress)
        : Promise.resolve(0n);

      const authStatusPromise = userAddress
        ? backendApi.getAuthStatus(userAddress).catch(() => null)
        : Promise.resolve(null);

      const progressPromise = backendApi.getProgress(idx).catch(() => ({
        challengeIdx: idx,
        progress: 0,
        claimed: false,
      }));

      const [creatorStake, currentUserStake, auth, progressData] = await Promise.all([
        creatorContributionPromise,
        userContributionPromise,
        authStatusPromise,
        progressPromise,
      ]);

      storeChallenge({ ...nextChallenge, index: idx }, progressData.progress, progressData.claimed);
      setCheckpointMap(buildClaimedMap(nextChallenge));
      setCreatorContribution(creatorStake);
      setUserContribution(userAddress ? currentUserStake : null);
      setBackendProgress(progressData.progress);
      setBackendClaimed(progressData.claimed);
      setAuthStatus(auth);
    } catch (loadError: any) {
      setError(loadError.message);
    } finally {
      if (showBlockingLoader) {
        setLoading(false);
      }
    }
  }

  async function handleVerify() {
    if (!challenge) return;

    const { app, action, count } = parseChallengeId(challenge.challengeId);
    setVerifying(true);
    setVerification(null);
    setInspectionRefusal("");
    setError("");

    try {
      const result = await backendApi.check({
        app,
        action,
        count,
        challengeIdx: idx,
        duolingoUsername: duolingoInput || undefined,
      });
      setVerification(result);
      if (result.blocked && result.shortReason) {
        setInspectionRefusal(result.shortReason);
      }
    } catch (verifyError: any) {
      const shortReason = getApiShortReason(verifyError);
      if (shortReason) {
        setInspectionRefusal(shortReason);
      } else {
        setError(verifyError.message);
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleClaim() {
    if (!challenge || !userAddress) return;

    setClaiming(true);
    setInspectionRefusal("");
    setError("");

    try {
      const proof = await backendApi.signProof({
        challengeIdx: idx,
        beneficiaryAddress: userAddress,
        duolingoUsername: duolingoInput || undefined,
      });

      if (proof.earnedCount <= proof.alreadyClaimed) {
        alert("No new checkpoints to claim.");
        return;
      }

      const body = buildClaimAllBody(idx, proof.earnedCount, proof.signature);
      const boc = body.toBoc().toString("base64");

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: CONTRACT_ADDRESS,
            amount: toNano("0.05").toString(),
            payload: boc,
          },
        ],
      });

      await loadChallenge({ forceRefresh: true, showBlockingLoader: false });
    } catch (claimError: any) {
      if (!claimError.message?.includes("Cancelled") && !claimError.message?.includes("canceled")) {
        const shortReason = getApiShortReason(claimError);
        if (shortReason) {
          setInspectionRefusal(shortReason);
        } else {
          setError(claimError.message || "Claim failed.");
        }
      }
    } finally {
      setClaiming(false);
    }
  }

  async function handleRefund() {
    if (!challenge) return;

    setRefunding(true);

    try {
      const body = buildRefundUnclaimedBody(idx);

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: CONTRACT_ADDRESS,
            amount: toNano("0.05").toString(),
            payload: body.toBoc().toString("base64"),
          },
        ],
      });

      await loadChallenge({ forceRefresh: true, showBlockingLoader: false });
    } catch (refundError: any) {
      if (!refundError.message?.includes("Cancelled") && !refundError.message?.includes("canceled")) {
        alert(refundError.message || "Refund failed.");
      }
    } finally {
      setRefunding(false);
    }
  }

  async function handleConnectApp() {
    if (!userAddress || !challenge) return;

    const { app } = parseChallengeId(challenge.challengeId);
    const connectableKey = getConnectableAppKey(app);

    if (!connectableKey) return;

    setConnecting(true);

    try {
      switch (connectableKey) {
        case "github": {
          const { url } = await backendApi.startGitHubOAuth(userAddress, idx);
          window.location.href = url;
          return;
        }
        case "leetcode": {
          if (!leetcodeInput.trim()) {
            alert("Enter your LeetCode username.");
            return;
          }

          await backendApi.connectLeetCode(userAddress, leetcodeInput.trim());
          await loadChallenge({ forceRefresh: true, showBlockingLoader: false });
          return;
        }
        case "chesscom": {
          if (!chesscomInput.trim()) {
            alert("Enter your Chess.com username.");
            return;
          }
          await backendApi.connectChessCom(userAddress, chesscomInput.trim());
          await loadChallenge({ forceRefresh: true, showBlockingLoader: false });
          return;
        }
        case "strava": {
          const { url } = await backendApi.startStravaOAuth(userAddress, idx);
          window.location.href = url;
          return;
        }
      }
    } catch (connectError: any) {
      alert(connectError.message || "Connection failed.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleAddFunds() {
    if (!challenge) return;

    if (!userAddress) {
      await tonConnectUI.openModal();
      return;
    }

    const parsedAmount = Number.parseFloat(fundAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0.01) {
      alert("Enter an amount above 0.01 TON so the pool actually increases after gas reserve.");
      return;
    }

    setFunding(true);

    try {
      const body = buildAddFundsBody(idx);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: CONTRACT_ADDRESS,
            amount: toNano(fundAmount).toString(),
            payload: body.toBoc().toString("base64"),
          },
        ],
      });

      setFundAmount("");
      await loadChallenge({ forceRefresh: true, showBlockingLoader: false });
    } catch (fundError: any) {
      if (!fundError.message?.includes("Cancelled") && !fundError.message?.includes("canceled")) {
        alert(fundError.message || "Funding failed.");
      }
    } finally {
      setFunding(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadChallenge({ forceRefresh: true, showBlockingLoader: false });
    } finally {
      setRefreshing(false);
    }
  }

  function renderFallbackState(kind: "loading" | "error" | "empty", title: string, message: string) {
    return (
      <div className="screen">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <div className="topbar-leading">
              <button type="button" className="back-control" onClick={() => navigate("/")} aria-label="Back to challenges">
                <span className="material-symbols-outlined" aria-hidden="true">
                  arrow_back
                </span>
              </button>
              <div className="back-copy">
                <div className="brand-title">Challenge Path</div>
                <div className="brand-subtitle">Loading</div>
              </div>
            </div>
          </div>
        </header>

        <main className="page-frame">
          <div className="page-stack">
            <div className={`state-card ${kind === "error" ? "error" : kind === "loading" ? "loading" : ""}`}>
              <strong>{title}</strong>
              <p>{message}</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => navigate("/")}>
              Back to challenges
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return renderFallbackState("loading", "Loading challenge", "Fetching on-chain challenge data...");
  }

  if (error && !challenge) {
    return renderFallbackState("error", "Could not load challenge", error);
  }

  if (!challenge) {
    return renderFallbackState("empty", "Challenge not found", "The contract did not return a challenge for this index.");
  }

  const { app: appKey, action } = parseChallengeId(challenge.challengeId);
  const appLabel = APP_LABELS[appKey as keyof typeof APP_LABELS] ?? appKey;
  const actionLabel = formatActionLabel(action);
  const expired = Date.now() / 1000 > challenge.endDate;
  const earnedCount = Math.min(backendProgress, challenge.totalCheckpoints);
  const onChainClaimed = challenge.claimedCount >= challenge.totalCheckpoints || !challenge.active;
  const fullyReleased = earnedCount >= challenge.totalCheckpoints && onChainClaimed;
  const routeFullyMatched = earnedCount >= challenge.totalCheckpoints;
  const isOpen = !fullyReleased && !routeFullyMatched && !expired;
  const progressPct = Math.min(100, Math.round((earnedCount / challenge.totalCheckpoints) * 100));
  const statusKey = fullyReleased ? "completed" : routeFullyMatched ? "claimable" : expired ? "expired" : "active";
  const statusLabel =
    statusKey === "completed"
      ? "Completed"
      : statusKey === "claimable"
        ? "Claimable"
        : statusKey === "expired"
          ? "Expired"
          : "Active";
  const hasAdditionalBackers = creatorContribution !== null && creatorContribution < challenge.totalDeposit;
  const showUserContribution = userContribution !== null && userContribution > 0n;
  const normalizedUserAddress = userAddress ? normalizeAddress(userAddress) : "";
  const isBeneficiary = normalizedUserAddress !== "" && normalizeAddress(challenge.beneficiary) === normalizedUserAddress;
  const isSponsor = normalizedUserAddress !== "" && normalizeAddress(challenge.sponsor) === normalizedUserAddress;
  const connectableKey = getConnectableAppKey(appKey);
  const appConnection = connectableKey ? authStatus?.[connectableKey] : undefined;
  const appConnected = appConnection?.connected === true;
  const connectedUsername = appConnection?.username;
  const showConnectPrompt = isBeneficiary && isOpen && connectableKey !== null && !appConnected;
  const showConnectedState = isBeneficiary && isOpen && connectableKey !== null && appConnected;
  const showEndedWarning = isBeneficiary && !isOpen && expired && !routeFullyMatched && connectableKey !== null && !appConnected;
  const needsUsernameInput =
    (connectableKey === "leetcode" || connectableKey === "chesscom") && !appConnected;
  const usernameInputValue = connectableKey === "chesscom" ? chesscomInput : leetcodeInput;
  const usernameInputSetter = connectableKey === "chesscom" ? setChesscomInput : setLeetcodeInput;
  const canClaimRewards = isBeneficiary && !fullyReleased && (expired || routeFullyMatched);
  const showManualVerificationInput = canClaimRewards && appKey === "DUOLINGO";
  const nextCheckpoint = earnedCount < challenge.totalCheckpoints ? earnedCount + 1 : challenge.totalCheckpoints;
  const nextUnlockLabel = fullyReleased
    ? "All slices released"
    : routeFullyMatched
      ? `${formatTonAmount(challenge.totalDeposit)} TON ready`
      : `Step ${nextCheckpoint} · ${formatTonAmount(challenge.amountPerCheckpoint)} TON`;

  let nextTitle = "Checkpoint in motion";
  let nextCopy = `Checkpoint ${nextCheckpoint} releases ${formatTonAmount(challenge.amountPerCheckpoint)} TON.`;

  if (showConnectPrompt) {
    nextTitle = `Connect ${appLabel}`;
    nextCopy = `Link the beneficiary ${appLabel} account so this path can track live activity and unlock reward slices.`;
  } else if (canClaimRewards) {
    nextTitle = "Claim earned TON";
    nextCopy = expired
      ? "The path has ended. Claim every earned checkpoint in one transaction."
      : "All checkpoints are matched. Claim the full unlocked reward now.";
  } else if (showEndedWarning) {
    nextTitle = `${appLabel} was never linked`;
    nextCopy = "No verified activity was recorded while the path was live.";
  } else if (showConnectedState) {
    nextTitle = "Tracking live";
    nextCopy = `Keep shipping on ${appLabel}. The next verified ${actionLabel.toLowerCase()} unlocks the next slice.`;
  } else if (!isBeneficiary && isOpen) {
    nextTitle = "Path is live";
    nextCopy = `The beneficiary is working toward checkpoint ${nextCheckpoint}.`;
  } else if (expired) {
    nextTitle = "Path closed";
    nextCopy = "The deadline has passed. Remaining value stays locked until the valid closing action is taken.";
  }

  return (
    <div className="screen">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <div className="topbar-leading">
            <button type="button" className="back-control" onClick={() => navigate("/")} aria-label="Back to challenges">
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <div className="back-copy">
              <div className="brand-title">Challenge Path</div>
              <div className="brand-subtitle">#{idx}</div>
            </div>
          </div>

          <button type="button" className="wallet-control" onClick={() => void tonConnectUI.openModal()}>
            {userAddress ? formatWalletPreview(userAddress) : "Connect"}
          </button>
        </div>
      </header>

      <main className="page-frame">
        <div className="page-stack">
          <section className="panel panel-accent challenge-hero">
            <div className="challenge-chip-row">
              <div className="eyebrow">Challenge #{idx}</div>
              <div className="section-meta">
                <span className={`state-pill is-${statusKey}`}>{statusLabel}</span>
                <span className="mini-tag">{appLabel}</span>
                {challenge.unlisted && <span className="state-pill is-unlisted">Unlisted</span>}
              </div>
            </div>
            <div className="source-card-main" style={{ marginTop: "0.8rem" }}>
              <span className={`vault-icon ${appKey === "LEETCODE" ? "is-leetcode" : "is-github"}`}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {getActionIcon(appKey, action)}
                </span>
              </span>
              <div>
                <h1 className="challenge-title">{actionLabel}</h1>
                <p className="support-copy tight">{appLabel} reward route</p>
              </div>
            </div>

            <div className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Locked reward</span>
                <span className="metric-value">{formatTonAmount(challenge.totalDeposit)} TON</span>
                <span className="metric-support">{challenge.totalCheckpoints} slices in escrow</span>
              </div>

              <div className="metric-card">
                <span className="metric-label">Progress</span>
                <span className="metric-value">
                  {earnedCount} / {challenge.totalCheckpoints}
                </span>
                <span className="metric-support">{progressPct}% matched</span>
              </div>

              <div className="metric-card">
                <span className="metric-label">Next unlock</span>
                <span className="metric-value">{nextUnlockLabel}</span>
                <span className="metric-support">
                  {fullyReleased ? "Route closed" : `Checkpoint ${nextCheckpoint}`}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-label">Deadline</span>
                <span className="metric-value">{formatShortDate(challenge.endDate)}</span>
                <span className="metric-support">{formatRelativeDeadline(challenge.endDate)}</span>
              </div>
            </div>
          </section>

          <section className="panel route-panel">
            <div className="route-head">
              <div>
                <div className="section-kicker">Reward path</div>
                <h2 className="section-title">Checkpoint route</h2>
              </div>
              <div className="section-meta">
                <span className="mini-tag">{progressPct}% matched</span>
              </div>
            </div>

            <div className="route-list">
              {checkpointMap.map((_, index) => {
                const routeState = getRouteState({
                  index,
                  challenge,
                  earnedCount,
                  fullyReleased,
                });

                return (
                  <div key={index} className={`route-item is-${routeState}`}>
                    <span className="route-bullet" aria-hidden="true">
                      <span className="material-symbols-outlined">
                        {routeState === "claimed"
                          ? "check"
                          : routeState === "ready"
                            ? "lock_open"
                            : routeState === "current"
                              ? "play_arrow"
                              : "lock"}
                      </span>
                    </span>

                    <div className="route-card">
                      <div className="route-top">
                        <span className="route-step-label">Checkpoint {index + 1}</span>
                        <span className="route-step-state">
                          {getRouteStateLabel(routeState, canClaimRewards)}
                        </span>
                      </div>
                      <h3 className="route-step-title">
                        {formatTonAmount(challenge.amountPerCheckpoint)} TON
                      </h3>
                      <p className="route-step-copy">
                        {getRouteCopy(routeState, actionLabel, canClaimRewards)}
                      </p>
                      <div className="route-step-reward">
                        <span>{routeState === "current" ? "Next slice" : "Reward slice"}</span>
                        <strong>{actionLabel}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {isBeneficiary && connectableKey && (
            <section className={`panel ${!appConnected && isOpen ? "panel-accent" : "panel-soft"} next-panel`}>
              <div className="section-kicker">{appLabel} account</div>
              <h2 className="section-title">
                {appConnected
                  ? `${appLabel} connected`
                  : isOpen
                    ? `Connect ${appLabel}`
                    : `${appLabel} not linked`}
              </h2>
              <div className="next-copy">
                <p className="support-copy tight">
                  {appConnected
                    ? connectedUsername
                      ? <>Synced as <strong>{connectableKey === "github" ? `@${connectedUsername}` : connectedUsername}</strong>. Your {actionLabel.toLowerCase()} activity is being tracked automatically.</>
                      : <>Your {appLabel} account is connected. Activity is being tracked automatically.</>
                    : isOpen
                      ? <>Link your {appLabel} account so this path can track live activity and unlock reward slices. Without this connection, the challenge cannot verify your progress.</>
                      : <>No {appLabel} account was connected while this path was live.</>}
                </p>
              </div>

              {!appConnected && isOpen && needsUsernameInput && (
                <input
                  className="inline-input"
                  placeholder={`Your ${appLabel} username`}
                  value={usernameInputValue}
                  onChange={(event) => usernameInputSetter(event.target.value)}
                />
              )}

              {!appConnected && isOpen && (
                <div className="next-actions">
                  <button className="primary-button" onClick={handleConnectApp} disabled={connecting}>
                    {connecting ? `Connecting ${appLabel}...` : `Connect ${appLabel}`}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className={`panel ${canClaimRewards ? "panel-accent" : "panel-soft"} next-panel`}>
            <div className="section-kicker">Next move</div>
            <h2 className="section-title">{nextTitle}</h2>
            <div className="next-copy">
              <p className="support-copy tight">{nextCopy}</p>
            </div>

            {showManualVerificationInput && (
              <input
                className="inline-input"
                placeholder="Your Duolingo username"
                value={duolingoInput}
                onChange={(event) => setDuolingoInput(event.target.value)}
              />
            )}

            <div className="next-actions">
              {canClaimRewards && (
                <>
                  <button className="primary-button" onClick={handleClaim} disabled={claiming}>
                    {claiming ? "Claiming..." : "Claim earned TON"}
                  </button>
                  <button className="secondary-button" onClick={handleVerify} disabled={verifying}>
                    {verifying ? "Checking..." : "Check proof"}
                  </button>
                </>
              )}

              {!canClaimRewards && (
                <button className="ghost-button" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh route"}
                </button>
              )}
            </div>

            {inspectionRefusal && (
              <div className="inspection-note" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">
                  gpp_bad
                </span>
                <div>
                  <strong>Blocked</strong>
                  <p>{inspectionRefusal}</p>
                </div>
              </div>
            )}
          </section>

          {(isOpen || (expired && !fullyReleased && isSponsor)) && (
            <section className="panel panel-soft actions-panel">
              <div className="section-heading">
                <div>
                  <div className="section-kicker">Contract actions</div>
                  <h2 className="section-title">Pool controls</h2>
                </div>
              </div>

              {isOpen && (
                <div className="actions-grid">
                  <input
                    className="inline-input"
                    type="number"
                    step="0.01"
                    min="0.02"
                    placeholder="0.50 TON"
                    value={fundAmount}
                    onChange={(event) => setFundAmount(event.target.value)}
                  />
                  <button className="secondary-button" onClick={handleAddFunds} disabled={funding}>
                    {!userAddress ? "Connect wallet" : funding ? "Adding funds..." : "Add funds"}
                  </button>
                </div>
              )}

              {expired && !fullyReleased && isSponsor && (
                <div className="next-actions" style={{ marginTop: isOpen ? "0.85rem" : "0" }}>
                  <button className="ghost-button" onClick={handleRefund} disabled={refunding}>
                    {refunding ? "Refunding..." : "Refund unclaimed balance"}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="panel section-shell">
            <div className="section-heading">
              <div>
                <div className="section-kicker">Context</div>
                <h2 className="section-title">People and terms</h2>
              </div>
            </div>

            {hasAdditionalBackers && (
              <p className="support-copy tight" style={{ marginBottom: "0.85rem" }}>
                This pool has additional backers beyond the original creator.
              </p>
            )}

            <div className="context-grid">
              <div className="context-card">
                <span className="context-key">Sponsor</span>
                <div className="context-value">{formatWalletPreview(challenge.sponsor)}</div>
                <div className="context-meta">
                  {creatorContribution !== null
                    ? `Funded ${formatTonAmount(creatorContribution)} TON${isSponsor ? " • You" : ""}`
                    : isSponsor
                      ? "You"
                      : "Creator wallet"}
                </div>
              </div>

              <div className="context-card">
                <span className="context-key">Beneficiary</span>
                <div className="context-value">{formatWalletPreview(challenge.beneficiary)}</div>
                <div className="context-meta">{isBeneficiary ? "You" : "Reward recipient"}</div>
              </div>

              <div className="context-card">
                <span className="context-key">Challenge terms</span>
                <div className="context-value">{appLabel}</div>
                <div className="context-meta">
                  {actionLabel} • {challenge.unlisted ? "Unlisted" : "Public"}
                </div>
              </div>

              <div className="context-card">
                <span className="context-key">Deadline</span>
                <div className="context-value">{formatShortDate(challenge.endDate)}</div>
                <div className="context-meta">{formatRelativeDeadline(challenge.endDate)}</div>
              </div>

              {showUserContribution && (
                <div className="context-card">
                  <span className="context-key">Your stake</span>
                  <div className="context-value">{formatTonAmount(userContribution || 0n)} TON</div>
                  <div className="context-meta">Total contributed by your wallet</div>
                </div>
              )}
            </div>
          </section>

          {verification && (
            <section className="panel verification-card">
              <div className="verification-head">
                <div>
                  <div className="section-kicker">Verification</div>
                  <h2 className="section-title">Latest proof check</h2>
                </div>
                <span className={`state-pill ${verification.blocked ? "is-expired" : verification.verified ? "is-ready" : "is-active"}`}>
                  {verification.blocked ? "Blocked" : verification.verified ? "Verified" : "Pending"}
                </span>
              </div>

              <div className="verification-grid">
                <div className="verification-row">
                  <span>Progress</span>
                  <strong>
                    {verification.currentCount} / {verification.targetCount}
                  </strong>
                </div>
                <div className="verification-row">
                  <span>Message</span>
                  <strong>{verification.message}</strong>
                </div>
                {verification.blocked && verification.shortReason && (
                  <div className="verification-row">
                    <span>AI veto</span>
                    <strong>{verification.shortReason}</strong>
                  </div>
                )}
              </div>
            </section>
          )}

          {error && (
            <div className="state-card error">
              <strong>Action failed</strong>
              <p>{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
