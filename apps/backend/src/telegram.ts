const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export async function sendTelegramMessage(chatId: string, text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    console.log("[telegram] No TELEGRAM_BOT_TOKEN set, skipping");
    return false;
  }

  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_notification: false,
      }),
    });
    if (!resp.ok) {
      console.error(`[telegram] sendMessage failed: ${resp.status} ${await resp.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return false;
  }
}

export async function sendToGroups(chatIds: string[], text: string): Promise<void> {
  for (const chatId of chatIds) {
    await sendTelegramMessage(chatId, text);
  }
}

// --- Message templates ---

export function formatClaimNotification(params: {
  challengeIdx: number;
  earnedCount: number;
  totalCheckpoints: number;
  payoutTon: number;
  app: string;
  action: string;
}): string {
  return [
    `<b>Reward claimed</b>`,
    ``,
    `Challenge #${params.challengeIdx}`,
    `${params.app} / ${params.action}`,
    `Checkpoints: ${params.earnedCount}/${params.totalCheckpoints}`,
    `Payout: <b>${params.payoutTon.toFixed(4)} TON</b>`,
  ].join("\n");
}

export function formatGroupClaimMessage(params: {
  challengeIdx: number;
  totalCheckpoints: number;
  payoutTon: number;
  app: string;
  action: string;
}): string {
  return [
    `<b>Challenge #${params.challengeIdx} completed</b>`,
    ``,
    `All ${params.totalCheckpoints} checkpoints matched.`,
    `<b>${params.payoutTon.toFixed(4)} TON</b> released.`,
    ``,
    `${params.app} / ${params.action}`,
  ].join("\n");
}

export function formatProgressMilestone(params: {
  challengeIdx: number;
  progress: number;
  totalCheckpoints: number;
  pct: number;
  app: string;
  action: string;
}): string {
  const cheers = params.pct >= 75 ? "Almost there!" : params.pct >= 50 ? "Halfway mark." : "Warming up.";
  return [
    `<b>${params.pct}% checkpoint milestone</b>`,
    ``,
    `Challenge #${params.challengeIdx}: ${params.progress}/${params.totalCheckpoints}`,
    `${params.app} / ${params.action}`,
    ``,
    cheers,
  ].join("\n");
}

export function formatNewCheckpoint(params: {
  challengeIdx: number;
  progress: number;
  totalCheckpoints: number;
  action: string;
  count: number;
}): string {
  return `Challenge #${params.challengeIdx}: <b>+${params.count} ${params.action}</b> — ${params.progress}/${params.totalCheckpoints} checkpoints`;
}

export function formatInactivityWarning(params: {
  challengeIdx: number;
  progress: number;
  totalCheckpoints: number;
  hoursInactive: number;
  app: string;
  action: string;
}): string {
  const remaining = params.totalCheckpoints - params.progress;
  return [
    `<b>No activity in ${params.hoursInactive}h</b>`,
    ``,
    `Challenge #${params.challengeIdx}: ${params.progress}/${params.totalCheckpoints}`,
    `${remaining} more ${params.action.toLowerCase()} needed.`,
    ``,
    `The clock is ticking.`,
  ].join("\n");
}

export function formatDeadlineWarning(params: {
  challengeIdx: number;
  progress: number;
  totalCheckpoints: number;
  hoursLeft: number;
  app: string;
  action: string;
}): string {
  const remaining = params.totalCheckpoints - params.progress;
  if (params.progress >= params.totalCheckpoints) {
    return `Challenge #${params.challengeIdx}: All checkpoints done. Reward will auto-claim when the deadline passes.`;
  }
  return [
    `<b>⏰ ${params.hoursLeft}h until deadline</b>`,
    ``,
    `Challenge #${params.challengeIdx}: ${params.progress}/${params.totalCheckpoints}`,
    `${remaining} more ${params.action.toLowerCase()} needed.`,
    ``,
    `${params.progress === 0 ? "Nothing tracked yet. Move." : "Don't stop now."}`,
  ].join("\n");
}

export function formatTrashTalk(params: {
  challengeIdx: number;
  progress: number;
  totalCheckpoints: number;
  daysLeft: number;
  action: string;
}): string {
  const remaining = params.totalCheckpoints - params.progress;
  const pct = Math.round((params.progress / params.totalCheckpoints) * 100);

  if (params.progress === 0) {
    return `Challenge #${params.challengeIdx}: ${params.daysLeft} days left. Zero ${params.action.toLowerCase()}s. The TON stays locked at this rate.`;
  }
  if (pct < 25) {
    return `Challenge #${params.challengeIdx}: ${params.daysLeft} days left, ${pct}% done. ${remaining} more to go. This is not looking good.`;
  }
  if (pct < 50) {
    return `Challenge #${params.challengeIdx}: ${params.daysLeft} days, ${remaining} ${params.action.toLowerCase()}s to go. Possible, but only if you actually do it.`;
  }
  return `Challenge #${params.challengeIdx}: ${remaining} left, ${params.daysLeft} days. You're close. Don't choke.`;
}

export function formatGroupIntro(params: {
  challengeIdx: number;
  totalCheckpoints: number;
  app: string;
  action: string;
  endDate: string;
  tonAmount: number;
}): string {
  return [
    `<b>Challenge #${params.challengeIdx} is now tracked in this group</b>`,
    ``,
    `Goal: ${params.totalCheckpoints} ${params.action.toLowerCase()}s on ${params.app}`,
    `Reward: <b>${params.tonAmount.toFixed(2)} TON</b>`,
    `Deadline: ${params.endDate}`,
    ``,
    `I'll post progress updates, milestones, and call out inactivity.`,
  ].join("\n");
}
