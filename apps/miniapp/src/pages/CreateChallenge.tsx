import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { App, APP_ACTIONS, APP_LABELS, type AppAction, buildChallengeId } from "../types/challenge";
import {
  CONTRACT_ADDRESS,
  buildCreateChallengeBody,
  getAllChallenges,
  normalizeAddress,
  toNano,
} from "../contract";
import { useChallengeCache } from "../challenge-cache";

function formatWalletPreview(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatTonAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/\.00$/, "");
}

function getAppIcon(app: App) {
  return app === App.LeetCode ? "code_blocks" : "terminal";
}

export function CreateChallenge() {
  const navigate = useNavigate();
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const { storeChallenge } = useChallengeCache();

  const [app, setApp] = useState<App>(App.Github);
  const [action, setAction] = useState<AppAction>(APP_ACTIONS[App.Github][0].value);
  const [count, setCount] = useState(1);
  const [amount, setAmount] = useState("");
  const [whoIsPaid, setWhoIsPaid] = useState("");
  const [endDate, setEndDate] = useState("");
  const [unlisted, setUnlisted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardOpen(heightDiff > 100);
    };

    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const actions = useMemo(() => APP_ACTIONS[app], [app]);
  const challengeId = useMemo(() => buildChallengeId(app, action, count), [app, action, count]);
  const amountNumber = Number.parseFloat(amount);
  const rewardPerCheckpoint = Number.isFinite(amountNumber) && count > 0 ? amountNumber / count : 0;
  const actionLabel = actions.find((entry) => entry.value === action)?.label ?? action;
  const previewCount = Math.min(count, 6);
  const overflowCount = Math.max(0, count - previewCount);
  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

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

  function handleAppChange(nextApp: App) {
    setApp(nextApp);
    setAction(APP_ACTIONS[nextApp][0].value);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

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
      const endTimestamp = Math.floor(new Date(`${endDate}T23:59:59`).getTime() / 1000);
      const totalCheckpoints = count;
      const body = buildCreateChallengeBody(beneficiary, challengeId, totalCheckpoints, endTimestamp, unlisted);

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

      setSubmissionStatus("Waiting for the challenge to appear...");
      const indexedChallenge = await waitForChallengeIndexing({
        sponsor: userAddress,
        beneficiary,
        challengeId,
        totalCheckpoints,
        endDate: endTimestamp,
        unlisted,
      });

      storeChallenge(indexedChallenge);
      navigate(`/challenge/${indexedChallenge.index}`, {
        state: { challenge: indexedChallenge },
      });
    } catch (error: any) {
      if (!error.message?.includes("Cancelled") && !error.message?.includes("canceled")) {
        alert(error.message || "Failed to create challenge.");
      }
    } finally {
      setSubmitting(false);
      setSubmissionStatus("");
    }
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
              <div className="brand-title">Build Path</div>
              <div className="brand-subtitle">Create Challenge</div>
            </div>
          </div>

          <button type="button" className="wallet-control" onClick={() => void tonConnectUI.openModal()}>
            {userAddress ? formatWalletPreview(userAddress) : "Connect"}
          </button>
        </div>
      </header>

      <main className="page-frame page-frame-with-submit">
        <div className="page-stack">
          <section className="panel panel-accent builder-intro">
            <div className="eyebrow">Challenge builder</div>
            <h1 className="display-title">Build a reward path.</h1>
            <p className="support-copy">
              Choose the source, set the checkpoints, lock the TON, and name the beneficiary. The contract holds the stake as soon as you sign.
            </p>
          </section>

          <form onSubmit={handleSubmit} className="builder-form">
            <section className="builder-step">
              <span className="builder-marker is-active">1</span>
              <div className="builder-content panel panel-soft">
                <div className="builder-label">Source</div>
                <h3>{APP_LABELS[app]}</h3>
                <div className="source-card">
                  <div className="source-card-main">
                    <span className={`vault-icon ${app === App.LeetCode ? "is-leetcode" : "is-github"}`}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {getAppIcon(app)}
                      </span>
                    </span>
                    <div>
                      <div className="vault-title">{APP_LABELS[app]}</div>
                      <p className="helper-text">
                        {app === App.LeetCode
                          ? "Track solved problems and streak-based targets."
                          : "Track repository activity and GitHub contribution milestones."}
                      </p>
                    </div>
                  </div>

                  <select
                    className="source-select"
                    value={app}
                    onChange={(event) => handleAppChange(event.target.value as App)}
                  >
                    {Object.values(App).map((entry) => (
                      <option key={entry} value={entry}>
                        {APP_LABELS[entry]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="builder-step">
              <span className="builder-marker">2</span>
              <div className="builder-content panel panel-soft">
                <div className="builder-label">Trigger action</div>
                <h3>{actionLabel}</h3>
                <div className="action-grid">
                  {actions.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      className={`action-pill ${entry.value === action ? "is-active" : ""}`}
                      onClick={() => setAction(entry.value)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="builder-step">
              <span className="builder-marker">3</span>
              <div className="builder-content panel panel-soft">
                <div className="builder-label">Checkpoint count</div>
                <h3>{count} unlocks</h3>
                <div className="quantity-shell">
                  <input
                    className="quantity-input"
                    type="number"
                    min={1}
                    value={count}
                    onChange={(event) => setCount(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                  />

                  <div className="quantity-controls">
                    <button type="button" className="stepper" onClick={() => setCount((current) => current + 1)}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        add
                      </span>
                    </button>
                    <button type="button" className="stepper" onClick={() => setCount((current) => Math.max(1, current - 1))}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        remove
                      </span>
                    </button>
                  </div>
                </div>
                <p className="helper-text">Each completed checkpoint unlocks one slice of the reward path.</p>
              </div>
            </section>

            <section className="builder-step">
              <span className="builder-marker">4</span>
              <div className="builder-content panel panel-soft">
                <div className="builder-label">Locked reward</div>
                <h3>{amount ? `${formatTonAmount(amountNumber)} TON` : "Set the total reward"}</h3>
                <div className="reward-card">
                  <div className="reward-meta">
                    <span>Total amount</span>
                    <span>{rewardPerCheckpoint > 0 ? `${formatTonAmount(rewardPerCheckpoint)} TON / unlock` : "Per unlock pending"}</span>
                  </div>
                  <div className="reward-entry">
                    <input
                      className="reward-input"
                      type="number"
                      step="0.01"
                      min="0.06"
                      placeholder="25"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                    />
                    <span className="reward-badge">TON</span>
                  </div>
                  <p className="helper-text">At least 0.05 TON stays reserved for gas. The rest becomes locked reward.</p>
                </div>
              </div>
            </section>

            <section className="builder-step">
              <span className="builder-marker">5</span>
              <div className="builder-content panel panel-soft">
                <div className="builder-label">Deadline and beneficiary</div>
                <h3>Finish the contract frame</h3>
                <div className="field-grid">
                  <div className="field-panel">
                    <span className="field-label">Deadline</span>
                    <input
                      className="field-input date-field-input"
                      type="date"
                      min={minDate}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      required
                    />
                  </div>

                  <div className="field-panel">
                    <span className="field-label">Beneficiary wallet</span>
                    <input
                      className="field-input wallet-field-input"
                      type="text"
                      placeholder={userAddress || "Connect wallet first"}
                      value={whoIsPaid}
                      onChange={(event) => setWhoIsPaid(event.target.value)}
                    />
                  </div>
                </div>
                <p className="helper-text">Leave the beneficiary empty to pay the connected wallet.</p>
              </div>
            </section>

            <section className="builder-step">
              <span className="builder-marker">6</span>
              <div className="builder-content panel panel-soft">
                <div className="builder-label">Visibility</div>
                <h3>{unlisted ? "Unlisted challenge" : "Public challenge"}</h3>
                <label className={`toggle-card ${unlisted ? "is-on" : ""}`}>
                  <span className="toggle-copy">
                    <span className="toggle-title">Hide from public browse</span>
                    <span className="toggle-note">The path still works normally, but only direct visitors will see it.</span>
                  </span>
                  <span className="toggle-track" aria-hidden="true" />
                  <input
                    type="checkbox"
                    checked={unlisted}
                    onChange={(event) => setUnlisted(event.target.checked)}
                  />
                </label>
              </div>
            </section>

            <section className="builder-step">
              <span className="builder-marker">7</span>
              <div className="builder-content panel preview-card">
                <div className="builder-label">Preview</div>
                <div className="preview-top">
                  <div className="source-card-main">
                    <span className={`preview-icon ${app === App.LeetCode ? "is-leetcode" : "is-github"}`}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {getAppIcon(app)}
                      </span>
                    </span>
                    <div className="preview-title-wrap">
                      <h3 className="preview-title">{APP_LABELS[app]} reward path</h3>
                      <div className="preview-status">{unlisted ? "Unlisted" : "Public"}</div>
                    </div>
                  </div>
                </div>

                <div className="preview-path" aria-hidden="true">
                  {Array.from({ length: previewCount }, (_, index) => (
                    <span key={index} className={`preview-node ${index === 0 ? "" : "is-faded"}`} />
                  ))}
                  {overflowCount > 0 && <span className="preview-overflow">+{overflowCount}</span>}
                </div>

                <div className="preview-list">
                  <div className="preview-row">
                    <span>Goal</span>
                    <strong>
                      {count} x {actionLabel}
                    </strong>
                  </div>
                  <div className="preview-row">
                    <span>Per unlock</span>
                    <strong>{rewardPerCheckpoint > 0 ? `${formatTonAmount(rewardPerCheckpoint)} TON` : "--"}</strong>
                  </div>
                  <div className="preview-row">
                    <span>Beneficiary</span>
                    <strong>
                      {whoIsPaid
                        ? formatWalletPreview(whoIsPaid)
                        : userAddress
                          ? formatWalletPreview(userAddress)
                          : "Connect wallet"}
                    </strong>
                  </div>
                  <div className="preview-row">
                    <span>Deadline</span>
                    <strong>
                      {endDate
                        ? new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Pick a date"}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <div className="sticky-submit" style={{ display: keyboardOpen ? "none" : undefined }}>
              <div className="sticky-submit-inner">
                <div className="sticky-submit-copy">
                  <span className="sticky-submit-label">Locked now</span>
                  <span className="sticky-submit-value">
                    {amount ? `${formatTonAmount(amountNumber)} TON` : "--"}
                  </span>
                  <span className="sticky-submit-note">
                    {count} checkpoints{rewardPerCheckpoint > 0 ? ` • ${formatTonAmount(rewardPerCheckpoint)} TON each` : ""}
                  </span>
                </div>

                <button type="submit" className="primary-button" disabled={submitting}>
                  {!userAddress ? "Connect wallet" : submitting ? "Creating..." : "Deploy challenge"}
                </button>

                {submissionStatus && <div className="sticky-submit-status">{submissionStatus}</div>}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
