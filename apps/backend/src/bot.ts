import { addChallengeGroup, getChallengeGroups } from "./store.js";
import { getChallenge } from "./chain.js";
import { sendTelegramMessage, formatGroupIntro } from "./telegram.js";

const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function getMiniAppUrl(): string {
  return process.env.PUBLIC_URL || "https://motivaton-backend-production.up.railway.app";
}

async function botApi(method: string, body: Record<string, unknown>): Promise<any> {
  const token = getBotToken();
  if (!token) return null;

  const resp = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.error(`[bot] ${method} failed: ${resp.status} ${await resp.text()}`);
    return null;
  }
  return resp.json();
}

let _botId: number | null = null;

export async function handleBotUpdate(update: any): Promise<void> {
  // Handle bot added to group
  if (update.my_chat_member) {
    const member = update.my_chat_member;
    const chatId = String(member.chat.id);
    const chatType = member.chat.type;
    const newStatus = member.new_chat_member?.status;

    if ((chatType === "group" || chatType === "supergroup") && (newStatus === "member" || newStatus === "administrator")) {
      console.log(`[bot] Added to group ${chatId}`);
      await botApi("sendMessage", {
        chat_id: chatId,
        text: "I'm Motivaton. Use <code>/track 0</code> to start tracking a challenge in this group (replace 0 with the challenge number).",
        parse_mode: "HTML",
      });
    }
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const chatType = message.chat.type;
  const text = (message.text || "").trim();

  // Handle /start in private chat
  if (chatType === "private" && (text === "/start" || text.startsWith("/start "))) {
    const param = text.split(" ")[1] || "";
    const walletAddress = param.startsWith("wallet_") ? param.slice(7) : null;

    if (walletAddress) {
      const { setTelegramChatId } = await import("./store.js");
      setTelegramChatId(walletAddress, chatId);
      console.log(`[bot] Registered chatId=${chatId} for wallet ${walletAddress.slice(0, 12)}... via /start deep link`);
    }

    await botApi("sendMessage", {
      chat_id: chatId,
      text: "Welcome to Motivaton.\n\nLock TON behind productivity checkpoints. Track real activity. Claim rewards automatically.",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Motivaton",
              web_app: { url: getMiniAppUrl() },
            },
          ],
        ],
      },
    });
    return;
  }

  // Handle /track <challengeIdx> in group chats
  if ((chatType === "group" || chatType === "supergroup") && text.startsWith("/track")) {
    const parts = text.split(/\s+/);
    const rawIdx = parts[1];
    const challengeIdx = rawIdx ? parseInt(rawIdx, 10) : NaN;

    if (isNaN(challengeIdx)) {
      await botApi("sendMessage", {
        chat_id: chatId,
        text: "Usage: <code>/track 0</code> (replace 0 with the challenge number from the app)",
        parse_mode: "HTML",
      });
      return;
    }

    try {
      const challenge = await getChallenge(challengeIdx);
      if (!challenge) {
        await botApi("sendMessage", {
          chat_id: chatId,
          text: `Challenge #${challengeIdx} not found on-chain.`,
        });
        return;
      }

      addChallengeGroup(challengeIdx, chatId);
      const [app, action] = challenge.challengeId.split(":");
      const endDate = new Date(challenge.endDate * 1000).toLocaleDateString();
      const tonAmount = Number(challenge.totalDeposit) / 1e9;

      await sendTelegramMessage(chatId, formatGroupIntro({
        challengeIdx,
        totalCheckpoints: challenge.totalCheckpoints,
        app,
        action,
        endDate,
        tonAmount,
      }));
      console.log(`[bot] Linked challenge #${challengeIdx} to group ${chatId}`);
    } catch (err) {
      console.error(`[bot] Failed to link challenge #${challengeIdx} to group:`, err);
      await botApi("sendMessage", {
        chat_id: chatId,
        text: `Failed to load challenge #${challengeIdx}. Try again later.`,
      });
    }
    return;
  }
}

export async function setupWebhook(): Promise<void> {
  const token = getBotToken();
  if (!token) {
    console.log("[bot] No TELEGRAM_BOT_TOKEN set, bot disabled");
    return;
  }

  const publicUrl = process.env.PUBLIC_URL;
  if (!publicUrl) {
    console.log("[bot] No PUBLIC_URL set, cannot setup webhook");
    return;
  }

  const webhookUrl = `${publicUrl}/api/bot/webhook`;
  const result = await botApi("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "my_chat_member"],
  });
  if (result?.ok) {
    console.log(`[bot] Webhook set to ${webhookUrl}`);
  }

  const me = await botApi("getMe", {});
  if (me?.result?.username) {
    process.env.TELEGRAM_BOT_USERNAME = me.result.username;
    _botId = me.result.id;
    console.log(`[bot] Bot username: @${me.result.username}`);
  }

  await botApi("setMyCommands", {
    commands: [
      { command: "start", description: "Open Motivaton" },
    ],
  });

  // Group-specific commands
  await botApi("setMyCommands", {
    commands: [
      { command: "track", description: "Track a challenge in this group" },
    ],
    scope: { type: "all_group_chats" },
  });

  await botApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open App",
      web_app: { url: publicUrl },
    },
  });
}
