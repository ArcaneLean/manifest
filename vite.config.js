import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base: "./" keeps built asset paths relative, so the same build works
// unmodified whether it's served from a GitHub Pages project subpath or
// any other static host.
//
// VITE_CHANNEL is set by deploy.yml: unset/"main" for the real app at the
// site root, "pr-<n>" for a PR preview built into <root>/preview/pr-<n>/ —
// see src/lib/channel.js and ARCHITECTURE.md §7 ("PR previews").
const channel = process.env.VITE_CHANNEL || "main";
const isPreview = channel !== "main";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: isPreview ? `Manifest (${channel})` : "Manifest",
        short_name: isPreview ? channel : "Manifest",
        description: "Local-first personal productivity PWA",
        theme_color: "#0d0d0c",
        background_color: "#0d0d0c",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
        // Main's service worker scope covers the preview/ subfolders too, and
        // its SPA fallback would answer a preview's navigation with main's
        // cached index.html — let those through to the network instead.
        // (Each preview registers its own, narrower-scoped worker.)
        navigateFallbackDenylist: isPreview ? [] : [/\/preview\//],
      },
    }),
  ],
});
