import type { OnChainChallenge } from "./chain.js";
import {
  getChallengeProgress,
  getChallengeGroups,
  isChallengeClaimed,
  hasNotificationBeenSent,
  markNotificationSent,
  getChallengeEvents,
} from "./store.js";
import {
  sendToGroups,
  formatProgressMilestone,
  formatNewCheckpoint,
  formatInactivityWarning,
  formatDeadlineWarning,
  formatTrashTalk,
} from "./telegram.js";

type ActiveChallenge = OnChainChallenge & { index: number };

export async function groupNotificationJob(challenges: ActiveChallenge[]) {
  const now = Date.now() / 1000;

  for (const c of challenges) {
    const groups = getChallengeGroups(c.index);
    if (groups.length === 0) continue;
    if (isChallengeClaimed(c.index)) continue;
    if (!c.active) continue;

    const progress = getChallengeProgress(c.index);
    const [app, action] = c.challengeId.split(":");
    const pct = Math.round((progress / c.totalCheckpoints) * 100);
    const hoursLeft = Math.max(0, Math.round((c.endDate - now) / 3600));
    const daysLeft = Math.max(0, Math.round((c.endDate - now) / 86400));

    // --- Progress milestones (25%, 50%, 75%) ---
    for (const milestone of [25, 50, 75]) {
      const key = `milestone_${milestone}`;
      if (pct >= milestone && !hasNotificationBeenSent(c.index, key)) {
        markNotificationSent(c.index, key);
        await sendToGroups(groups, formatProgressMilestone({
          challengeIdx: c.index,
          progress,
          totalCheckpoints: c.totalCheckpoints,
          pct: milestone,
          app,
          action,
        }));
      }
    }

    // --- Deadline warning (24h before) ---
    if (hoursLeft > 0 && hoursLeft <= 24 && !hasNotificationBeenSent(c.index, "deadline_24h")) {
      markNotificationSent(c.index, "deadline_24h");
      await sendToGroups(groups, formatDeadlineWarning({
        challengeIdx: c.index,
        progress,
        totalCheckpoints: c.totalCheckpoints,
        hoursLeft,
        app,
        action,
      }));
    }

    // --- Inactivity warning (no new events in 24h) ---
    if (progress > 0 && progress < c.totalCheckpoints && c.endDate > now) {
      const events = getChallengeEvents(c.index);
      // Check if we've sent an inactivity warning in the last 24h
      const inactivityKey = `inactivity_${Math.floor(now / 86400)}`;
      if (!hasNotificationBeenSent(c.index, inactivityKey)) {
        // Simple heuristic: if progress hasn't changed, send warning
        // We check by looking at the last notification time
        const lastProgressKey = `last_progress_${progress}`;
        if (hasNotificationBeenSent(c.index, lastProgressKey)) {
          // Progress hasn't changed since we last noted it — send inactivity
          markNotificationSent(c.index, inactivityKey);
          await sendToGroups(groups, formatInactivityWarning({
            challengeIdx: c.index,
            progress,
            totalCheckpoints: c.totalCheckpoints,
            hoursInactive: 24,
            app,
            action,
          }));
        } else {
          // Record current progress level
          markNotificationSent(c.index, lastProgressKey);
        }
      }
    }

    // --- Trash talk (daily, when behind schedule) ---
    if (daysLeft > 0 && daysLeft <= 7 && progress < c.totalCheckpoints) {
      const trashKey = `trash_day_${daysLeft}`;
      if (!hasNotificationBeenSent(c.index, trashKey)) {
        const expectedPct = Math.round(((c.endDate - c.createdAt - daysLeft * 86400) / (c.endDate - c.createdAt)) * 100);
        // Only trash talk if behind schedule
        if (pct < expectedPct) {
          markNotificationSent(c.index, trashKey);
          await sendToGroups(groups, formatTrashTalk({
            challengeIdx: c.index,
            progress,
            totalCheckpoints: c.totalCheckpoints,
            daysLeft,
            action,
          }));
        }
      }
    }
  }
}
