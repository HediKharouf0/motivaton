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
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start" || text.startsWith("/start ")) {
    // Extract wallet address from deep link if present: /start wallet_<address>
    const param = text.split(" ")[1] || "";
    const walletAddress = param.startsWith("wallet_") ? param.slice(7) : null;

    if (walletAddress) {
      // Auto-register chat ID with wallet
      const { setTelegramChatId } = await import("./store.js");
      setTelegramChatId(walletAddress, String(chatId));
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

  // Set bot menu button to open the miniapp
  await botApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open App",
      web_app: { url: publicUrl },
    },
  });
}
