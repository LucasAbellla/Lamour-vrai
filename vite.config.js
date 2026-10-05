import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png"
      ],
      manifest: {
        id: "./",
        name: "L'amour vrai — Nosso arquivo afetivo",
        short_name: "L'amour vrai",
        description: "Um espaço particular para guardar memórias, cartas, sonhos e cápsulas do tempo.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        background_color: "#090507",
        theme_color: "#0b0709",
        categories: ["lifestyle", "photo"],
        prefer_related_applications: false,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          {
            name: "Guardar uma memória",
            short_name: "Nova memória",
            description: "Abrir o álbum para guardar uma nova lembrança.",
            url: "./#memorias",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Nossa constelação",
            short_name: "Constelação",
            description: "Revisitar as estrelas formadas pelas memórias.",
            url: "./#constelacao",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,png,svg,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022"
  },
  server: {
    host: "127.0.0.1",
    port: 4173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  }
});
