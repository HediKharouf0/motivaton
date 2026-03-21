import { config } from "dotenv";
import { resolve } from "path";

// In production, env vars are set by Railway; locally, load from .env.local
if (process.env.NODE_ENV !== "production") {
  config({ path: resolve(import.meta.dirname, "../../.env.local") });
}

import express from "express";
import cors from "cors";
import { verifyRouter } from "./routes/verify.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

app.use("/api/verify", verifyRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serve frontend static files in production
const frontendDist = resolve(import.meta.dirname, "../../miniapp/dist");
app.use(express.static(frontendDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(resolve(frontendDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Motivaton backend running on http://localhost:${PORT}`);
});
