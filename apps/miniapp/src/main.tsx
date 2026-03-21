import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { CreateChallenge } from "./pages/CreateChallenge";
import { ChallengeDetail } from "./pages/ChallengeDetail";
import { Home } from "./pages/Home";
import "./index.css";

const MANIFEST_URL = "https://hedikharouf0.github.io/motivaton/tonconnect-manifest.json";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateChallenge />} />
          <Route path="/challenge/:id" element={<ChallengeDetail />} />
        </Routes>
      </BrowserRouter>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
