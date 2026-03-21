import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ["buffer"] })],
  base: process.env.GITHUB_PAGES ? "/motivaton/" : "/",
  envDir: path.resolve(__dirname, "../.."),
  server: {
    port: 5173,
  },
});
