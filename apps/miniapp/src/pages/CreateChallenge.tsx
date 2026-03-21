import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import {
  App,
  APP_ACTIONS,
  APP_LABELS,
  type AppAction,
  buildChallengeId,
  formatActionLabel,
} from "../types/challenge";
import {
  buildCreateChallengeBody,
  CONTRACT_ADDRESS,
  getAllChallenges,
  normalizeAddress,
  toNano,
} from "../contract";

export function CreateChallenge() {
  const navigate = useNavigate();
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  const [app, setApp] = useState<App>(App.Github);
  const [action, setAction] = useState<AppAction>(APP_ACTIONS[App.Github][0].value);
  const [count, setCount] = useState(1);
  const [amount, setAmount] = useState("");
  const [whoIsPaid, setWhoIsPaid] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duolingoUsername, setDuolingoUsername] = useState("");
  const [unlisted, setUnlisted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");

  const actions = useMemo(() => APP_ACTIONS[app], [app]);

  async function waitForChallengeIndexing(params: {
    sponsor: string;
    beneficiary: string;
    challengeId: string;
    totalCheckpoints: number;
    endDate: number;
    unlisted: boolean;
  }) {
    const sponsor = normalizeAddress(params.sponsor);
    const beneficiary = normalizeAddress(params.beneficiary);
    const startedAt = Date.now();

    while (Date.now() - startedAt < 45000) {
      const challenges = await getAllChallenges();
      const challenge = challenges.find((candidate) =>
        normalizeAddress(candidate.sponsor) === sponsor &&
        normalizeAddress(candidate.beneficiary) === beneficiary &&
        candidate.challengeId === params.challengeId &&
        candidate.totalCheckpoints === params.totalCheckpoints &&
        candidate.endDate === params.endDate &&
        candidate.unlisted === params.unlisted,
      );

      if (challenge) return challenge;

      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }

    throw new Error("The transaction was submitted, but the challenge is not visible yet. Wait a few seconds and try again.");
  }

  function handleAppChange(newApp: App) {
    setApp(newApp);
    setAction(APP_ACTIONS[newApp][0].value);
  }

  const challengeId = useMemo(() => buildChallengeId(app, action, count), [app, action, count]);
  const amountNumber = Number.parseFloat(amount);
  const rewardPerCheckpoint = Number.isFinite(amountNumber) && count > 0 ? amountNumber / count : 0;

  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!userAddress) {
      await tonConnectUI.openModal();
      return;
    }

    if (!CONTRACT_ADDRESS) {
      alert("Contract address not configured. Set VITE_CONTRACT_ADDRESS.");
      return;
    }

    setSubmitting(true);
    setSubmissionStatus("");
    try {
      const beneficiary = whoIsPaid || userAddress;
      const endTimestamp = Math.floor(
        new Date(`${endDate}T23:59:59`).getTime() / 1000,
      );
      const totalCheckpoints = count;

      const body = buildCreateChallengeBody(beneficiary, challengeId, totalCheckpoints, endTimestamp, unlisted);

      // Send transaction via TON Connect
      console.log("[CreateChallenge] sending to:", CONTRACT_ADDRESS, "amount:", toNano(amount).toString(), "payload:", body.toBoc().toString("base64"));
      setSubmissionStatus("Waiting for wallet confirmation...");
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: CONTRACT_ADDRESS,
            amount: toNano(amount).toString(),
            payload: body.toBoc().toString("base64"),
          },
        ],
      });

      setSubmissionStatus("Waiting for the challenge to be indexed...");
      const indexedChallenge = await waitForChallengeIndexing({
        sponsor: userAddress,
        beneficiary,
        challengeId,
        totalCheckpoints,
        endDate: endTimestamp,
        unlisted,
      });

      navigate(`/challenge/${indexedChallenge.index}`, {
        state: { challenge: indexedChallenge },
      });
    } catch (err: any) {
      if (err.message?.includes("Cancelled") || err.message?.includes("canceled")) {
        // User cancelled — do nothing
      } else {
        alert(err.message || "Failed to create challenge.");
      }
    } finally {
      setSubmitting(false);
      setSubmissionStatus("");
    }
  }

  const actionLabel = actions.find((a) => a.value === action)?.label ?? action;

  return (
    <div className="page">
      <button type="button" className="top-link" onClick={() => navigate("/")}>
        Back to challenges
      </button>

      <header className="surface surface-accent hero-panel">
        <div className="eyebrow">New escrow</div>
        <h1 className="page-title">Define the rule. Lock the stake.</h1>
        <p className="page-intro">
          Set the accountability rule, who benefits, and when the escrow closes. The contract holds the deposit until verified checkpoints are claimed.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="form-stack">
        <section className="surface section-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Challenge rule</h2>
              <p className="section-note">Choose the app, the tracked action, and how many checkpoints must be unlocked.</p>
            </div>
          </div>
          <div className="section-divider" />
          <div className="split-grid">
            <div className="form-group">
              <label className="form-label">App</label>
              <select
                className="form-select"
                value={app}
                onChange={(e) => handleAppChange(e.target.value as App)}
              >
                {Object.values(App).map((a) => (
                  <option key={a} value={a}>
                    {APP_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Action</label>
              <select
                className="form-select"
                value={action}
                onChange={(e) => setAction(e.target.value as AppAction)}
              >
                {actions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "0.9rem" }}>
            <label className="form-label">Times to complete</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <p className="field-hint">Each successful claim unlocks one checkpoint from the escrow.</p>
          </div>
        </section>

        <section className="surface section-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Stake and participants</h2>
              <p className="section-note">The connected wallet funds the challenge. The beneficiary receives unlocked rewards.</p>
            </div>
          </div>
          <div className="section-divider" />
          <div className="split-grid">
            <div className="form-group">
              <label className="form-label">Amount (TON)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.06"
                placeholder="1.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="field-hint">Reserve at least 0.05 TON for gas. The rest is escrowed.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Deadline date</label>
              <input
                className="form-input"
                type="date"
                min={minDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "0.9rem" }}>
            <label className="form-label">Who gets paid</label>
            <input
              className="form-input"
              type="text"
              placeholder={userAddress || "Connect wallet first"}
              value={whoIsPaid}
              onChange={(e) => setWhoIsPaid(e.target.value)}
            />
            <p className="field-hint">Leave empty to pay yourself. Otherwise enter the beneficiary TON address.</p>
          </div>

          <label className="toggle-row" style={{ marginTop: "0.9rem" }}>
            <span className="toggle-copy">
              <span className="toggle-title">Unlisted</span>
              <span className="toggle-note">Hide this challenge from public browse lists. It will still be accessible via direct link.</span>
            </span>
            <span className="toggle-switch">
              <input
                type="checkbox"
                checked={unlisted}
                onChange={(e) => setUnlisted(e.target.checked)}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </span>
          </label>

          {app === App.Duolingo && (
            <div className="form-group" style={{ marginTop: "0.9rem" }}>
              <label className="form-label">Duolingo username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Your Duolingo username"
                value={duolingoUsername}
                onChange={(e) => setDuolingoUsername(e.target.value)}
              />
              <p className="field-hint">Used by the verifier flow. The backend and contract rules still need to bind this value safely.</p>
            </div>
          )}
        </section>

        <aside className="surface surface-accent summary-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">Challenge summary</h2>
              <p className="section-note">A quick read before you ask the wallet to sign.</p>
            </div>
          </div>
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-label">Goal</span>
              <span className="summary-value">
                {count} x {actionLabel} on {APP_LABELS[app]}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total stake</span>
              <span className="summary-value">{amount || "--"} TON</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Per checkpoint</span>
              <span className="summary-value">
                {rewardPerCheckpoint > 0 ? `${rewardPerCheckpoint.toFixed(3)} TON` : "--"}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Deadline</span>
              <span className="summary-value">
                {endDate ? new Date(endDate).toLocaleDateString() : "--"}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Visibility</span>
              <span className="summary-value">{unlisted ? "Unlisted" : "Public"}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Sponsor</span>
              <span className="summary-value">
                {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Not connected"}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Beneficiary</span>
              <span className="summary-value">
                {whoIsPaid
                  ? `${whoIsPaid.slice(0, 6)}...${whoIsPaid.slice(-4)}`
                  : userAddress
                    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                    : "Not connected"}
              </span>
            </div>
          </div>
        </aside>

        <div className="button-row">
          <button type="button" className="button-secondary" onClick={() => navigate("/")}>
            Back
          </button>
          <button type="submit" className="button-primary" disabled={submitting}>
            {!userAddress ? "Connect wallet" : submitting ? "Creating..." : "Create challenge"}
          </button>
        </div>
        {submissionStatus && <p className="field-hint">{submissionStatus}</p>}
      </form>
    </div>
  );
}
