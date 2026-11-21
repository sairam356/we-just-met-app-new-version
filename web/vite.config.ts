import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "We Just Met", short_name: "WeJustMet", theme_color: "#4f46e5", background_color: "#f1f5f9",
        display: "standalone", start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith("/api/"), handler: "NetworkFirst" }],
      },
    }),
  ],
  server: { port: 5173, host: true, proxy: { "/api": "http://localhost:4000" } },
});
