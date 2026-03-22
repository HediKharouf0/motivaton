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

export async function handleBotUpdate(update: any): Promise<void> {
  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const chatType = message.chat.type; // "private", "group", "supergroup"
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

  // Handle /start in group chat — link challenge to group
  if ((chatType === "group" || chatType === "supergroup") && (text === "/start" || text.startsWith("/start "))) {
    const param = text.split(" ")[1] || "";
    const challengeIdx = param.startsWith("challenge_") ? parseInt(param.slice(10), 10) : NaN;

    if (!isNaN(challengeIdx)) {
      try {
        const challenge = await getChallenge(challengeIdx);
        if (challenge) {
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
        }
      } catch (err) {
        console.error(`[bot] Failed to link challenge #${challengeIdx} to group:`, err);
      }
    } else {
      await botApi("sendMessage", {
        chat_id: chatId,
        text: "Add me to a group via a challenge share link to track progress here.",
      });
    }
    return;
  }

  // Handle bot added to group (no /start command, just added)
  if (message.new_chat_members) {
    const botToken = getBotToken();
    if (!botToken) return;
    const botInfo = await botApi("getMe", {});
    const botId = botInfo?.result?.id;
    const wasAdded = message.new_chat_members.some((m: any) => m.id === botId);
    if (wasAdded) {
      await botApi("sendMessage", {
        chat_id: chatId,
        text: "I'm Motivaton. Share a challenge link with /start to track it in this group.",
      });
    }
  }
}

export function getBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
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
  const result = await botApi("setWebhook", { url: webhookUrl });
  if (result?.ok) {
    console.log(`[bot] Webhook set to ${webhookUrl}`);
  }

  // Get and store bot username
  const me = await botApi("getMe", {});
  if (me?.result?.username) {
    process.env.TELEGRAM_BOT_USERNAME = me.result.username;
    console.log(`[bot] Bot username: @${me.result.username}`);
  }

  await botApi("setMyCommands", {
    commands: [
      { command: "start", description: "Open Motivaton" },
    ],
  });

  await botApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open App",
      web_app: { url: publicUrl },
    },
  });
}
