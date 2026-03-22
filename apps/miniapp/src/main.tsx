import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { CreateChallenge } from "./pages/CreateChallenge";
import { ChallengeDetail } from "./pages/ChallengeDetail";
import { Home } from "./pages/Home";
import { ChallengeCacheProvider } from "./challenge-cache";
import { useEffect } from "react";
import "./index.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
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
