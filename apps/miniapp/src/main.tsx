import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { CreateChallenge } from "./pages/CreateChallenge";
import { ChallengeDetail } from "./pages/ChallengeDetail";
import { Home } from "./pages/Home";
import { ChallengeCacheProvider } from "./challenge-cache";
import { backendApi } from "./api";
import { useEffect } from "react";
import "./index.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Cache or clear group chat ID from Telegram startapp deep link
const GROUP_CHAT_KEY = "motivaton_group_chat_id";
try {
  const tg = (window as any).Telegram?.WebApp;
  const startParam: string = tg?.initDataUnsafe?.start_param || "";
  if (startParam.startsWith("g")) {
    const groupId = `-${startParam.slice(1)}`;
    sessionStorage.setItem(GROUP_CHAT_KEY, groupId);
    backendApi.logEvent({ event: "open_from_group", groupChatId: groupId }).catch(() => {});
  } else {
    sessionStorage.removeItem(GROUP_CHAT_KEY);
  }
} catch {
  sessionStorage.removeItem(GROUP_CHAT_KEY);
}

const MANIFEST_URL =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL ||
  new URL(`${import.meta.env.BASE_URL}tonconnect-manifest.json`, window.location.origin).toString();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <ChallengeCacheProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateChallenge />} />
            <Route path="/challenge/:id" element={<ChallengeDetail />} />
          </Routes>
        </BrowserRouter>
      </ChallengeCacheProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
