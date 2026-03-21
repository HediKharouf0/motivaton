import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import {
  getChallenge,
  isCheckpointClaimed,
  buildClaimCheckpointBody,
  buildRefundUnclaimedBody,
  CONTRACT_ADDRESS,
  toNano,
  type OnChainChallenge,
} from "../contract";
import { backendApi, type VerificationResult } from "../api";
import { APP_LABELS, formatActionLabel, parseChallengeId } from "../types/challenge";

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
  const [refunding, setRefunding] = useState(false);
  const [duolingoInput, setDuolingoInput] = useState("");

  const idx = parseInt(id || "0", 10);

  useEffect(() => {
    loadChallenge();
  }, [idx]);

  async function loadChallenge() {
    setLoading(true);
    setError("");
    try {
      const c = await getChallenge(idx);
      setChallenge(c);
      if (c) {
        const claimed: boolean[] = [];
        for (let i = 0; i < c.totalCheckpoints; i++) {
          claimed.push(await isCheckpointClaimed(idx, i));
        }
        setClaimedMap(claimed);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!challenge) return;
    const parts = challenge.challengeId.split(":");
    const app = parts[0];
    const action = parts[1];
    const count = parseInt(parts[2] || "0", 10);

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

    // Find first unclaimed checkpoint
    const checkpointIndex = claimedMap.findIndex((c) => !c);
    if (checkpointIndex === -1) {
      alert("All checkpoints already claimed.");
      return;
    }

    setClaiming(true);
    try {
      // Get signed proof from backend (backend reads challenge data from chain)
      const proof = await backendApi.signProof({
        challengeIdx: idx,
        checkpointIndex,
        beneficiaryAddress: userAddress,
        duolingoUsername: duolingoInput || undefined,
      });

      // Send claim transaction
      const body = buildClaimCheckpointBody(idx, checkpointIndex, proof.signature);
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

      // Reload after claim
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
  const isBeneficiary = userAddress === challenge.beneficiary;
  const isSponsor = userAddress === challenge.sponsor;
  const progressPct = Math.min(100, Math.round((challenge.claimedCount / challenge.totalCheckpoints) * 100));
  const status = !challenge.active
    ? challenge.claimedCount >= challenge.totalCheckpoints
      ? "completed"
      : "closed"
    : expired
      ? "expired"
      : "active";
  const nextCheckpoint = claimedMap.findIndex((claimed) => !claimed);

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
          <span className={`status-pill status-${status}`}>{status}</span>
        </div>
        <div className="info-chip-row">
          <span className="inline-note">{challenge.challengeId}</span>
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
      </section>

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
          <h2 className="section-title" style={{ marginBottom: "0.9rem" }}>Participants</h2>
          <div className="detail-stack">
            <div className="identity-row">
              <div>
                <div className="identity-role">Sponsor</div>
                <div className="identity-address">{challenge.sponsor.slice(0, 6)}...{challenge.sponsor.slice(-4)}</div>
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

      {appKey === "DUOLINGO" && challenge.active && !expired && isBeneficiary && (
        <section className="surface section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Verification input</h2>
              <p className="section-note">Required for the current Duolingo verification flow.</p>
            </div>
          </div>
          <label className="form-label">Duolingo Username (for verification)</label>
          <input
            className="form-input"
            placeholder="Your Duolingo username"
            value={duolingoInput}
            onChange={(e) => setDuolingoInput(e.target.value)}
          />
        </section>
      )}

      {challenge.active && !expired && isBeneficiary && (
        <section className="surface surface-accent section-panel action-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Beneficiary actions</h2>
              <p className="section-note">Check progress first if you want feedback, then submit the next claim through the wallet.</p>
            </div>
          </div>
          <div className="button-row">
            <button className="button-secondary" onClick={handleVerify} disabled={verifying}>
              {verifying ? "Checking..." : "Verify progress"}
            </button>
            <button className="button-primary" onClick={handleClaim} disabled={claiming}>
              {claiming ? "Claiming..." : "Claim next checkpoint"}
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
