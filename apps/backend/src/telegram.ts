const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function getOpenAppMarkup(chatId?: string): object {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) return {};
  const param = chatId ? `g${chatId.replace("-", "")}` : "";
  return {
    inline_keyboard: [[{ text: "Open Motivaton", url: `https://t.me/${botUsername}?startapp=${param}` }]],
  };
}

export async function sendTelegramMessage(chatId: string, text: string, parseMode: "HTML" | "Markdown" = "HTML", replyMarkup?: object): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    console.log("[telegram] No TELEGRAM_BOT_TOKEN set, skipping");
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_notification: false,
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    const markup = getOpenAppMarkup(chatId);
    await sendTelegramMessage(chatId, text, "HTML", markup);
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

// Trash talk lines grouped by severity tier. Higher tier = harsher.
// Within each tier, a random line is picked.

const TRASH_ZERO_PROGRESS_MILD: string[] = [
  "Zero. Absolutely nothing. The blockchain is judging you.",
  "Day one energy, except it's not day one anymore.",
  "Your progress bar is a flatline.",
  "Somewhere, a compiler is doing more work than you.",
  "Even a random number generator would have made more progress by accident.",
  "The contract is collecting dust. Digital dust.",
  "Nothing. Nada. Zilch. The TON is getting comfortable where it is.",
  "Your challenge has the same progress as an unplugged computer.",
  "Achievement unlocked: do absolutely nothing for multiple days.",
  "At this rate, heat death of the universe comes first.",
];

const TRASH_ZERO_PROGRESS_HARSH: string[] = [
  "Still at zero. The TON might as well be burned.",
  "You locked real money behind a promise you clearly didn't mean.",
  "This challenge is starting to look like a donation to the void.",
  "Zero progress. The smart contract is smarter than you right now.",
  "Your locked TON has more patience than anyone watching this.",
  "Even a broken clock is right twice a day. You're at zero, all day.",
  "The contract doesn't feel pity. Neither do I. Move.",
  "There are people mining bitcoin with a calculator making more progress.",
  "Your TON is just sitting there, watching you do nothing. Awkward.",
  "At this point the blockchain is your most expensive screensaver.",
];

const TRASH_ZERO_PROGRESS_BRUTAL: string[] = [
  "Still zero. You paid money to prove you can't follow through.",
  "Congratulations, you invented a new way to lose money: voluntary paralysis.",
  "The TON you locked is now a monument to inaction.",
  "Your challenge is a public record of failure. On-chain. Forever.",
  "This is genuinely embarrassing. The whole network can see this.",
  "You're not behind schedule. You never started.",
  "The contract will outlast your motivation. It already has.",
  "Even your wallet is disappointed.",
  "This challenge has the energy of a New Year's resolution on January 3rd.",
  "If quitting was a checkpoint, you'd have completed this twice over.",
];

const TRASH_LOW_PROGRESS_MILD: string[] = [
  "Off to a slow start. Very slow. Concerningly slow.",
  "Some progress exists, technically. Barely.",
  "You started. That's... something. Not enough, but something.",
  "The pace suggests you think deadlines are suggestions.",
  "At this speed, turtles are lapping you.",
  "Progress: visible under a microscope.",
  "You've done the bare minimum to not be at zero. Congratulations?",
  "The progress bar moved. Squint hard enough and you'll see it.",
  "If this were a race, you'd still be tying your shoes.",
  "Your momentum could be outrun by continental drift.",
];

const TRASH_LOW_PROGRESS_HARSH: string[] = [
  "This pace is not going to cut it. Not even close.",
  "You're treating this challenge like it's optional. It's not — your money is in there.",
  "The math doesn't work. You need to move faster. Much faster.",
  "At this rate, you'll finish sometime around never.",
  "Your progress graph looks like a flat tire.",
  "You've done just enough to make the eventual failure sting more.",
  "The deadline doesn't care about your schedule. Speed up.",
  "This is the part where people usually give up. Prove me wrong.",
  "Your TON is watching your progress and filing for divorce.",
  "The gap between where you are and where you need to be is growing.",
];

const TRASH_LOW_PROGRESS_BRUTAL: string[] = [
  "You're going to lose this money. That's not trash talk, that's math.",
  "This is what giving up looks like in slow motion.",
  "Your challenge is a cautionary tale for everyone else in this group.",
  "The blockchain will remember this long after you've tried to forget it.",
  "At this pace, your locked TON is basically a charitable donation to yourself that you'll never collect.",
  "You had a plan. The plan had a flaw. The flaw was you.",
  "Every day you don't catch up, recovery gets exponentially harder. You're in the exponential zone.",
  "This challenge is the digital equivalent of a gym membership you never use.",
  "If effort were a token, you'd have zero liquidity.",
  "Your progress-to-deadline ratio is a war crime against productivity.",
];

const TRASH_MID_PROGRESS_MILD: string[] = [
  "Halfway there... ish. The clock disagrees with your optimism.",
  "Not terrible. Not good either. Just... existing.",
  "You could still pull this off. Emphasis on 'could.'",
  "The progress is there, but the urgency isn't.",
  "You're in the danger zone where it still feels possible but barely is.",
  "Decent work so far. Now do more of it. Faster.",
  "You're behind where you should be, but not catastrophically. Yet.",
  "The finish line is visible if you squint. Start running.",
  "Momentum exists. It's just not enough momentum.",
  "You're in the middle of the pack in a race against yourself. Think about that.",
];

const TRASH_MID_PROGRESS_HARSH: string[] = [
  "You've done half the work in most of the time. The math is not mathing.",
  "Still possible, but only if you stop whatever else you're doing and focus.",
  "The comfortable middle is where challenges go to die.",
  "You need to double your pace starting right now. Not tomorrow. Now.",
  "Halfway done but the easy half is over.",
  "Your remaining time-to-work ratio is brutal. Act accordingly.",
  "Every checkpoint you miss from here is TON you're leaving on the table.",
  "You're coasting. The deadline is not coasting. It's sprinting toward you.",
  "The second half is always harder. You're not ready for harder.",
  "This is the point where discipline separates from wishful thinking.",
];

const TRASH_HIGH_PROGRESS_MILD: string[] = [
  "Close. But close only counts in horseshoes and hand grenades, not smart contracts.",
  "Almost there. Don't get lazy now.",
  "You can see the finish line. So can everyone watching you potentially choke.",
  "The home stretch. This is where heroes are made or excuses are born.",
  "So close. It would be really embarrassing to fail now.",
  "A few more and you're done. Unless you stop. Don't stop.",
  "Nearly there. The only thing between you and your TON is effort.",
  "You've come too far to fumble this. Keep going.",
  "The hard part is done. The rest is just showing up.",
  "Finish this and you never have to hear from me again. Motivation enough?",
];

const TRASH_HIGH_PROGRESS_HARSH: string[] = [
  "Don't choke. Seriously. The group is watching.",
  "You're this close and time is this short. No more breaks.",
  "Failing now would be peak comedy for everyone except you.",
  "The TON is right there. Reach out and take it or watch it expire.",
  "Almost done but 'almost' doesn't trigger the payout.",
  "The worst kind of failure is the kind that happens at 80%.",
  "You can rest when the contract pays out. Not before.",
  "Every hour you waste now is a checkpoint you might not get back.",
  "You didn't come this far to only come this far.",
  "Close doesn't earn TON. Done earns TON. Get it done.",
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
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
  const prefix = `<b>Challenge #${params.challengeIdx}</b> — ${params.daysLeft}d left, ${params.progress}/${params.totalCheckpoints}\n\n`;

  if (params.progress === 0) {
    const line = params.daysLeft <= 2 ? pick(TRASH_ZERO_PROGRESS_BRUTAL)
      : params.daysLeft <= 4 ? pick(TRASH_ZERO_PROGRESS_HARSH)
      : pick(TRASH_ZERO_PROGRESS_MILD);
    return prefix + line;
  }

  if (pct < 25) {
    const line = params.daysLeft <= 2 ? pick(TRASH_LOW_PROGRESS_BRUTAL)
      : params.daysLeft <= 4 ? pick(TRASH_LOW_PROGRESS_HARSH)
      : pick(TRASH_LOW_PROGRESS_MILD);
    return prefix + line;
  }

  if (pct < 50) {
    const line = params.daysLeft <= 3 ? pick(TRASH_MID_PROGRESS_HARSH)
      : pick(TRASH_MID_PROGRESS_MILD);
    return prefix + line;
  }

  const line = params.daysLeft <= 2 ? pick(TRASH_HIGH_PROGRESS_HARSH)
    : pick(TRASH_HIGH_PROGRESS_MILD);
  return prefix + line;
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
