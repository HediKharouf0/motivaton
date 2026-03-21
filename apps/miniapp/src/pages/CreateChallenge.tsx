import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import {
  App,
  APP_ACTIONS,
  APP_LABELS,
  type AppAction,
  buildChallengeId,
} from "../types/challenge";
import { buildCreateChallengeBody, CONTRACT_ADDRESS, toNano } from "../contract";

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
  const [submitting, setSubmitting] = useState(false);

  const actions = useMemo(() => APP_ACTIONS[app], [app]);

  function handleAppChange(newApp: App) {
    setApp(newApp);
    setAction(APP_ACTIONS[newApp][0].value);
  }

  const challengeId = useMemo(() => buildChallengeId(app, action, count), [app, action, count]);

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
    try {
      const beneficiary = whoIsPaid || userAddress;
      const endTimestamp = Math.floor(
        new Date(`${endDate}T23:59:59`).getTime() / 1000,
      );
      const totalCheckpoints = count;

      const body = buildCreateChallengeBody(beneficiary, challengeId, totalCheckpoints, endTimestamp);

      // Send transaction via TON Connect
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

      // After successful transaction, navigate to home to see the new challenge
      navigate("/");
    } catch (err: any) {
      if (err.message?.includes("Cancelled") || err.message?.includes("canceled")) {
        // User cancelled — do nothing
      } else {
        alert(err.message || "Failed to create challenge.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const actionLabel = actions.find((a) => a.value === action)?.label ?? action;

  return (
    <div className="page">
      <h1 className="page-title">Create Challenge</h1>

      <form onSubmit={handleSubmit}>
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

        <div className="form-group">
          <label className="form-label">Times to Complete</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

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
          <span style={{ fontSize: 12, color: "var(--tg-theme-hint-color)" }}>
            0.05 TON reserved for gas; rest is escrowed
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Who Gets Paid (TON address, leave empty for self)</label>
          <input
            className="form-input"
            type="text"
            placeholder={userAddress || "Connect wallet first"}
            value={whoIsPaid}
            onChange={(e) => setWhoIsPaid(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Deadline Date</label>
          <input
            className="form-input"
            type="date"
            min={minDate}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>


        {app === App.Duolingo && (
          <div className="form-group">
            <label className="form-label">Duolingo Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="Your Duolingo username"
              value={duolingoUsername}
              onChange={(e) => setDuolingoUsername(e.target.value)}
            />
          </div>
        )}

        {amount && endDate && (
          <div className="challenge-summary">
            <h3>Challenge Summary</h3>
            <div className="summary-row">
              <span className="summary-label">Challenge ID</span>
              <span>{challengeId}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Goal</span>
              <span>
                {count}x {actionLabel} on {APP_LABELS[app]}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Stake</span>
              <span>{amount} TON</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Deadline</span>
              <span>{new Date(endDate).toLocaleDateString()}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Payer</span>
              <span>{userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Not connected"}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Beneficiary</span>
              <span>
                {whoIsPaid
                  ? `${whoIsPaid.slice(0, 6)}...${whoIsPaid.slice(-4)}`
                  : userAddress
                    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)} (self)`
                    : "Not connected"}
              </span>
            </div>
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={submitting}>
          {!userAddress ? "Connect Wallet" : submitting ? "Creating..." : "Create Challenge"}
        </button>
      </form>

      <button
        onClick={() => navigate("/")}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 14,
          border: "1px solid #ddd",
          borderRadius: 10,
          fontSize: 16,
          background: "transparent",
          color: "var(--tg-theme-text-color)",
          cursor: "pointer",
        }}
      >
        Back
      </button>
    </div>
  );
}
