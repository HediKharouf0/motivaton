import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import {
  getChallenge,
  getSponsorContribution,
  isCheckpointClaimed,
  buildAddFundsBody,
  buildClaimCheckpointBody,
  buildRefundUnclaimedBody,
  CONTRACT_ADDRESS,
  normalizeAddress,
  toNano,
  type OnChainChallenge,
} from "../contract";
import { backendApi, type VerificationResult, type AuthStatus } from "../api";
import { APP_LABELS, formatActionLabel, parseChallengeId } from "../types/challenge";

const OAUTH_APPS = ["github"] as const;

function getOAuthAppKey(appKey: string): (typeof OAUTH_APPS)[number] | null {
  const authKey = appKey.toLowerCase() as (typeof OAUTH_APPS)[number];
  return OAUTH_APPS.includes(authKey) ? authKey : null;
}

export function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  const [challenge, setChallenge] = useState<OnChainChallenge | null>(null);
  const [claimedMap, setClaimedMap] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCount, setClaimCount] = useState(1);
  const [refunding, setRefunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [userContribution, setUserContribution] = useState<bigint | null>(null);
  const [creatorContribution, setCreatorContribution] = useState<bigint | null>(null);
  const [duolingoInput, setDuolingoInput] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [connecting, setConnecting] = useState(false);

  const idx = parseInt(id || "0", 10);

  useEffect(() => {
    loadChallenge();
  }, [idx, userAddress]);

  async function loadChallenge() {
    setLoading(true);
    setError("");
    try {
      const c = await getChallenge(idx);
      setChallenge(c);
      if (!c) {
        setClaimedMap([]);
        setUserContribution(null);
        setCreatorContribution(null);
        return;
      }

      const claimedPromise = Promise.all(
        Array.from({ length: c.totalCheckpoints }, (_, i) => isCheckpointClaimed(idx, i)),
      );
      const creatorContributionPromise = getSponsorContribution(idx, c.sponsor);
      const userContributionPromise = userAddress
        ? userAddress === c.sponsor
          ? creatorContributionPromise
          : getSponsorContribution(idx, userAddress)
        : Promise.resolve(0n);

      const authStatusPromise = userAddress
        ? backendApi.getAuthStatus(userAddress).catch(() => null)
        : Promise.resolve(null);

      const [claimed, creatorStake, currentUserStake, auth] = await Promise.all([
        claimedPromise,
        creatorContributionPromise,
        userContributionPromise,
        authStatusPromise,
      ]);

      setClaimedMap(claimed);
      setCreatorContribution(creatorStake);
      setUserContribution(userAddress ? currentUserStake : null);
      setAuthStatus(auth);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!challenge) return;
    const { app, action, count } = parseChallengeId(challenge.challengeId);

    setVerifying(true);
    try {
      const result = await backendApi.check({
        app,
        action,
        count,
        duolingoUsername: duolingoInput || undefined,
      });
      setVerification(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleClaim() {
    if (!challenge || !userAddress) return;

    setClaiming(true);
    try {
      // Backend verifies performance and returns signed proofs for all earned unclaimed checkpoints
      const proof = await backendApi.signProof({
        challengeIdx: idx,
        beneficiaryAddress: userAddress,
        duolingoUsername: duolingoInput || undefined,
      });

      if (proof.newCheckpoints.length === 0) {
        alert("No new checkpoints to claim.");
        return;
      }

      // Build one message per checkpoint, all sent in a single wallet confirmation
      const messages = proof.newCheckpoints.map((cp) => ({
        address: CONTRACT_ADDRESS,
        amount: toNano("0.05").toString(),
        payload: buildClaimCheckpointBody(idx, cp.checkpointIndex, cp.signature)
          .toBoc()
          .toString("base64"),
      }));

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages,
      });

      await loadChallenge();
    } catch (e: any) {
      if (!e.message?.includes("Cancelled") && !e.message?.includes("canceled")) {
        alert(e.message || "Claim failed.");
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
      await loadChallenge();
    } catch (e: any) {
      if (!e.message?.includes("Cancelled") && !e.message?.includes("canceled")) {
        alert(e.message || "Refund failed.");
      }
    } finally {
      setRefunding(false);
    }
  }

  async function handleConnectApp() {
    if (!userAddress || !challenge) return;
    const { app } = parseChallengeId(challenge.challengeId);
    const oauthAppKey = getOAuthAppKey(app);

    if (!oauthAppKey) return;

    setConnecting(true);
    try {
      switch (oauthAppKey) {
        case "github": {
          const { url } = await backendApi.startGitHubOAuth(userAddress, idx);
          // Redirect in the same window — callback will redirect back
          window.location.href = url;
          return;
        }
      }
    } catch (e: any) {
      alert(e.message || "Connection failed.");
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
      await loadChallenge();
    } catch (e: any) {
      if (!e.message?.includes("Cancelled") && !e.message?.includes("canceled")) {
        alert(e.message || "Funding failed.");
      }
    } finally {
      setFunding(false);
    }
  }

  function renderFallbackState(kind: "loading" | "error" | "empty", title: string, message: string) {
    const boxClassName =
      kind === "loading" ? "loading-card" : kind === "error" ? "error-banner" : "empty-state";

    return (
      <div className="page">
        <button type="button" className="top-link" onClick={() => navigate("/")}>
          Back to challenges
        </button>
        <div className={boxClassName}>
          <strong>{title}</strong>
          <p>{message}</p>
        </div>
        <button type="button" className="button-secondary button-full" onClick={() => navigate("/")}>
          Go back
        </button>
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
  const progressPct = Math.min(100, Math.round((challenge.claimedCount / challenge.totalCheckpoints) * 100));
  const status = !challenge.active
    ? challenge.claimedCount >= challenge.totalCheckpoints
      ? "completed"
      : "closed"
    : expired
      ? "expired"
      : "active";
  const nextCheckpoint = claimedMap.findIndex((claimed) => !claimed);
  const hasAdditionalBackers = creatorContribution !== null && creatorContribution < challenge.totalDeposit;
  const showUserContribution = userContribution !== null && userContribution > 0n;
  const normalizedUserAddress = userAddress ? normalizeAddress(userAddress) : "";
  const isBeneficiary = normalizedUserAddress !== "" && normalizeAddress(challenge.beneficiary) === normalizedUserAddress;
  const isSponsor = normalizedUserAddress !== "" && normalizeAddress(challenge.sponsor) === normalizedUserAddress;
  const oauthAppKey = getOAuthAppKey(appKey);
  const oauthConnection = oauthAppKey ? authStatus?.[oauthAppKey] : undefined;
  const appConnected = oauthConnection?.connected === true;
  const connectedUsername = oauthConnection?.username;
  const showOAuthConnectPrompt = isBeneficiary && challenge.active && !expired && oauthAppKey !== null && !appConnected;
  const showOAuthConnectedState = isBeneficiary && challenge.active && oauthAppKey !== null && appConnected;
  const showOAuthEndedWarning = isBeneficiary && challenge.active && expired && oauthAppKey !== null && !appConnected;
  const showManualVerificationInput = isBeneficiary && challenge.active && expired && appKey === "DUOLINGO";

  return (
    <div className="page">
      <button type="button" className="top-link" onClick={() => navigate("/")}>
        Back to challenges
      </button>

      <header className="surface surface-accent hero-panel detail-header">
        <div className="eyebrow">On-chain challenge</div>
        <div className="detail-title-row">
          <div>
            <h1 className="detail-title">{appLabel} / {actionLabel}</h1>
            <p className="detail-subcopy">
              Escrow #{idx} releases funds one checkpoint at a time. Claims require backend verification and a contract-valid proof.
            </p>
          </div>
          <div className="pill-cluster">
            <span className={`status-pill status-${status}`}>{status}</span>
            {challenge.unlisted && <span className="status-pill status-unlisted">Unlisted</span>}
          </div>
        </div>
        <div className="info-chip-row">
          <span className="inline-note">{new Date(challenge.endDate * 1000).toLocaleDateString()}</span>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-tile surface">
          <span className="stat-label">Progress</span>
          <div className="stat-value">{challenge.claimedCount} / {challenge.totalCheckpoints}</div>
          <p className="section-note">{progressPct}% of checkpoints unlocked</p>
        </div>
        <div className="stat-tile surface">
          <span className="stat-label">Escrow pool</span>
          <div className="stat-value">{(Number(challenge.totalDeposit) / 1e9).toFixed(2)} TON</div>
          <p className="section-note">Total value currently held by the contract.</p>
        </div>
        <div className="stat-tile surface">
          <span className="stat-label">Per checkpoint</span>
          <div className="stat-value">{(Number(challenge.amountPerCheckpoint) / 1e9).toFixed(4)} TON</div>
          <p className="section-note">
            {nextCheckpoint === -1 ? "All checkpoints already claimed." : `Next unlock is checkpoint ${nextCheckpoint + 1}.`}
          </p>
        </div>
        <div className="stat-tile surface">
          <span className="stat-label">Closing time</span>
          <div className="stat-value">{new Date(challenge.endDate * 1000).toLocaleDateString()}</div>
          <p className="section-note">{expired ? "Past deadline. Refund path may be available." : "Claims remain open until the deadline."}</p>
        </div>
        {showUserContribution && (
          <div className="stat-tile surface">
            <span className="stat-label">Your stake</span>
            <div className="stat-value">{(Number(userContribution) / 1e9).toFixed(2)} TON</div>
            <p className="section-note">Your total contribution to this escrow.</p>
          </div>
        )}
      </section>

      {showOAuthConnectPrompt && (
        <section className="surface surface-accent section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Connect {appLabel}</h2>
              <p className="section-note">
                Link your {appLabel} account so your daily activity is tracked automatically.
                Without this, the challenge cannot verify your progress.
              </p>
            </div>
          </div>
          <button className="button-primary button-full" onClick={handleConnectApp} disabled={connecting}>
            {connecting ? "Connecting..." : `Connect ${appLabel}`}
          </button>
        </section>
      )}

      {showOAuthConnectedState && (
        <section className="surface section-panel app-status-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">{appLabel} connected</h2>
              <p className="section-note app-status-copy">
                {connectedUsername
                  ? <>Logged in as <strong>@{connectedUsername}</strong>. Your daily {actionLabel.toLowerCase()} activity is being tracked automatically.</>
                  : <>Your {appLabel} account is connected. Daily {actionLabel.toLowerCase()} activity is being tracked automatically.</>}
              </p>
            </div>
          </div>
        </section>
      )}

      {showOAuthEndedWarning && (
        <section className="surface section-panel app-status-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">{appLabel} not connected</h2>
              <p className="section-note app-status-copy app-status-warning">
                Your {appLabel} account was not linked during this challenge. No progress was tracked.
                Connect now if you believe this is an error, then contact the sponsor.
              </p>
            </div>
          </div>
        </section>
      )}

      {showManualVerificationInput && (
        <section className="surface section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Verification input</h2>
              <p className="section-note">Enter your Duolingo username to verify your progress.</p>
            </div>
          </div>
          <input
            className="form-input"
            placeholder="Your Duolingo username"
            value={duolingoInput}
            onChange={(e) => setDuolingoInput(e.target.value)}
          />
        </section>
      )}

      {challenge.active && !expired && (
        <section className="surface section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Back this challenge</h2>
              <p className="section-note">Anyone can add TON to increase the reward pool. 0.01 TON stays reserved for gas.</p>
            </div>
          </div>
          <div className="split-grid">
            <div className="form-group">
              <label className="form-label">Amount (TON)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.02"
                placeholder="0.50"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
            </div>
            <button className="button-primary button-full" onClick={handleAddFunds} disabled={funding}>
              {!userAddress ? "Connect wallet to add funds" : funding ? "Adding funds..." : "Add funds"}
            </button>
          </div>
        </section>
      )}

      <section className="surface section-panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">Checkpoint board</h2>
            <p className="section-note">Each green tile is already unlocked and claimed.</p>
          </div>
          <span className="inline-note">{progressPct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="checkpoint-grid">
          {claimedMap.map((claimed, i) => (
            <div key={i} className={`checkpoint-pill ${claimed ? "is-claimed" : ""}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </section>

      <section className="identity-grid">
        <div className="surface section-panel">
          <h2 className="section-title" style={{ marginBottom: "0.35rem" }}>Participants</h2>
          {hasAdditionalBackers && (
            <p className="section-note" style={{ marginBottom: "0.9rem" }}>
              This challenge has additional backers beyond the original creator.
            </p>
          )}
          <div className="detail-stack">
            <div className="identity-row">
              <div>
                <div className="identity-role">Creator</div>
                <div className="identity-address">{challenge.sponsor.slice(0, 6)}...{challenge.sponsor.slice(-4)}</div>
                {creatorContribution !== null && (
                  <div className="identity-note">
                    Contributed {(Number(creatorContribution) / 1e9).toFixed(2)} TON
                  </div>
                )}
              </div>
              {isSponsor && <span className="inline-note">You</span>}
            </div>
            <div className="identity-row">
              <div>
                <div className="identity-role">Beneficiary</div>
                <div className="identity-address">{challenge.beneficiary.slice(0, 6)}...{challenge.beneficiary.slice(-4)}</div>
              </div>
              {isBeneficiary && <span className="inline-note">You</span>}
            </div>
          </div>
        </div>
        <div className="surface section-panel">
          <h2 className="section-title" style={{ marginBottom: "0.9rem" }}>Action context</h2>
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-label">App</span>
              <span className="summary-value">{appLabel}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Action</span>
              <span className="summary-value">{actionLabel}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Claim status</span>
              <span className="summary-value">{challenge.active ? "Open" : "Closed"}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Wallet state</span>
              <span className="summary-value">{userAddress ? "Connected" : "Connect a wallet to act"}</span>
            </div>
          </div>
        </div>
      </section>

      {expired && challenge.active && isBeneficiary && (
        <section className="surface surface-accent section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Claim your rewards</h2>
              <p className="section-note">
                The challenge has ended. Verify your progress and claim all earned checkpoints in one transaction.
              </p>
            </div>
          </div>
          <div className="button-row">
            <button className="button-secondary" onClick={handleVerify} disabled={verifying}>
              {verifying ? "Checking..." : "Verify progress"}
            </button>
            <button className="button-primary" onClick={handleClaim} disabled={claiming}>
              {claiming ? "Claiming..." : "Claim earned checkpoints"}
            </button>
          </div>
        </section>
      )}

      {expired && challenge.active && isSponsor && challenge.claimedCount < challenge.totalCheckpoints && (
        <section className="surface section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Sponsor refund</h2>
              <p className="section-note">After the deadline, any remaining value can be returned to the sponsor.</p>
            </div>
          </div>
          <button className="button-ghost button-full" onClick={handleRefund} disabled={refunding}>
            {refunding ? "Refunding..." : "Refund unclaimed balance"}
          </button>
        </section>
      )}

      {verification && (
        <section className="surface section-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Verification result</h2>
              <p className="section-note">Backend readout for the current verification request.</p>
            </div>
            <span className={`verification-badge ${verification.verified ? "is-verified" : "is-pending"}`}>
              {verification.verified ? "Verified" : "Not yet"}
            </span>
          </div>
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-label">Progress</span>
              <span className="summary-value">{verification.currentCount} / {verification.targetCount}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Details</span>
              <span className="summary-value">{verification.message}</span>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="error-banner">
          <strong>Action failed</strong>
          <p>{error}</p>
        </div>
      )}

      <button type="button" className="button-secondary button-full" onClick={() => navigate("/")}>
        Back
      </button>
    </div>
  );
}
