/// <reference types="vitest" />
const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === "production";
const vitePort = Number(process.env.VITE_PORT || 5174);

module.exports = defineConfig({
  plugins: [
    react({
      include: /\.(jsx|tsx)$/,
    }),
    // PrismJS language components are CJS modules that reference the global
    // `Prism` at evaluation time.  Vite 6's CJS-to-ESM interop wraps the
    // core in a lazy getter so the global is never set.  This plugin patches
    // the prismjs output chunk to export AND set the global in one step.
    {
      name: "prismjs-global",
      renderChunk(code, chunk) {
        if (chunk.name !== "prismjs") return;
        // The chunk exports the Prism object.  Find the export and add a
        // globalThis assignment so the global is available to language chunks
        // that are evaluated later in the same import graph.
        const exportMatch = code.match(/export\s*\{([^}]*)\}/);
        if (!exportMatch) return;
        // Find the Prism export name (the local binding)
        const exports = exportMatch[1].split(",").map(s => s.trim());
        const prismExport = exports.find(e =>
          e.includes(" as P") || e.match(/^P$/)
        );
        if (!prismExport) return;
        const localName = prismExport.split(" as ")[0].trim();
        // Prepend the global assignment just before the export statement
        return code.replace(
          exportMatch[0],
          `globalThis.Prism=${localName};${exportMatch[0]}`
        );
      },
    },
  ],
  // Base path: use /static/vite/ for production, / for dev
  base: isProduction ? "/static/vite/" : "/",
  // Root is where vite.config.js is located (bordercore directory)
  root: __dirname,
  server: {
    port: vitePort,
    strictPort: true,
    cors: true,
    hmr: {
      host: "localhost",
      port: vitePort,
    },
  },
  build: {
    outDir: path.resolve(__dirname, "static", "vite"),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        "dist/css/bordercore": path.resolve(__dirname, "front-end", "entries", "bordercore-css.js"),
        "dist/js/base-react": path.resolve(__dirname, "front-end", "entries", "base-react.tsx"),
        "dist/js/reminders": path.resolve(__dirname, "front-end", "entries", "reminders.tsx"),
        "dist/js/reminder-detail": path.resolve(__dirname, "front-end", "entries", "reminder-detail.tsx"),
        "dist/js/reminder-form": path.resolve(__dirname, "front-end", "entries", "reminder-form.tsx"),
        "dist/js/reminder-delete": path.resolve(__dirname, "front-end", "entries", "reminder-delete.tsx"),
        "dist/js/album-detail": path.resolve(__dirname, "front-end", "entries", "album-detail.tsx"),
        "dist/js/artist-detail": path.resolve(__dirname, "front-end", "entries", "artist-detail.tsx"),
        "dist/js/music-dashboard": path.resolve(__dirname, "front-end", "entries", "music-dashboard.tsx"),
        "dist/js/song-edit": path.resolve(__dirname, "front-end", "entries", "song-edit.tsx"),
        "dist/js/song-create": path.resolve(__dirname, "front-end", "entries", "song-create.tsx"),
        "dist/js/playlist-detail": path.resolve(__dirname, "front-end", "entries", "playlist-detail.tsx"),
        "dist/js/tag-search": path.resolve(__dirname, "front-end", "entries", "tag-search.tsx"),
        "dist/js/artist-list": path.resolve(__dirname, "front-end", "entries", "artist-list.tsx"),
        "dist/js/album-list": path.resolve(__dirname, "front-end", "entries", "album-list.tsx"),
        "dist/js/album-create": path.resolve(__dirname, "front-end", "entries", "album-create.tsx"),
        "dist/js/collection-list": path.resolve(__dirname, "front-end", "entries", "collection-list.tsx"),
        "dist/js/collection-detail": path.resolve(__dirname, "front-end", "entries", "collection-detail.tsx"),
        "dist/js/todos": path.resolve(__dirname, "front-end", "entries", "todos.tsx"),
        "dist/js/search": path.resolve(__dirname, "front-end", "entries", "search.tsx"),
        "dist/js/tag-detail": path.resolve(__dirname, "front-end", "entries", "tag-detail.tsx"),
        "dist/js/homepage": path.resolve(__dirname, "front-end", "entries", "homepage.tsx"),
        "dist/js/gallery": path.resolve(__dirname, "front-end", "entries", "gallery.tsx"),
        "dist/js/sql": path.resolve(__dirname, "front-end", "entries", "sql.tsx"),
        "dist/js/feed": path.resolve(__dirname, "front-end", "entries", "feed.tsx"),
        "dist/js/tag-list": path.resolve(__dirname, "front-end", "entries", "tag-list.tsx"),
        "dist/js/drill-list": path.resolve(__dirname, "front-end", "entries", "drill-list.tsx"),
        "dist/js/drill-question": path.resolve(__dirname, "front-end", "entries", "drill-question.tsx"),
        "dist/js/drill-question-edit": path.resolve(__dirname, "front-end", "entries", "drill-question-edit.tsx"),
        "dist/js/fitness-summary": path.resolve(__dirname, "front-end", "entries", "fitness-summary.tsx"),
        "dist/js/habit-list": path.resolve(__dirname, "front-end", "entries", "habit-list.tsx"),
        "dist/js/habit-detail": path.resolve(__dirname, "front-end", "entries", "habit-detail.tsx"),
        "dist/js/fitness-exercise-detail": path.resolve(__dirname, "front-end", "entries", "fitness-exercise-detail.tsx"),
        "dist/js/metric-list": path.resolve(__dirname, "front-end", "entries", "metric-list.tsx"),
        "dist/js/node-list": path.resolve(__dirname, "front-end", "entries", "node-list.tsx"),
        "dist/js/node-detail": path.resolve(__dirname, "front-end", "entries", "node-detail.tsx"),
        "dist/js/bookmark-list": path.resolve(__dirname, "front-end", "entries", "bookmark-list.tsx"),
        "dist/js/bookmark-form": path.resolve(__dirname, "front-end", "entries", "bookmark-form.tsx"),
        "dist/js/bookmark-edit": path.resolve(__dirname, "front-end", "entries", "bookmark-edit.tsx"),
        "dist/js/prefs": path.resolve(__dirname, "front-end", "entries", "prefs.tsx"),
        "dist/js/prefs-password": path.resolve(__dirname, "front-end", "entries", "prefs-password.tsx"),
        "dist/js/blob-list": path.resolve(__dirname, "front-end", "entries", "blob-list.tsx"),
        "dist/js/bookshelf": path.resolve(__dirname, "front-end", "entries", "bookshelf.tsx"),
        "dist/js/notes-landing": path.resolve(__dirname, "front-end", "entries", "notes-landing.tsx"),
        "dist/js/blob-detail": path.resolve(__dirname, "front-end", "entries", "blob-detail.tsx"),
        "dist/js/blob-import": path.resolve(__dirname, "front-end", "entries", "blob-import.tsx"),
        "dist/js/blob-update": path.resolve(__dirname, "front-end", "entries", "blob-update.tsx"),
        "dist/js/login": path.resolve(__dirname, "front-end", "entries", "login.tsx"),
        "dist/js/book-list": path.resolve(__dirname, "front-end", "entries", "book-list.tsx"),
        "dist/js/visualize": path.resolve(__dirname, "front-end", "entries", "visualize.tsx"),
      },
      output: {
        entryFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("prismjs/components/")) {
            return "prism-languages";
          }
          if (id.includes("node_modules/prismjs")) {
            return "prismjs";
          }
          if (id.includes("node_modules/react-select")) {
            return "react-select";
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./front-end/react/test/setup.ts"],
    include: ["front-end/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    coverage: {
      provider: "v8",
      include: ["front-end/**"],
      exclude: [
        "front-end/**/*.{test,spec}.{ts,tsx,js,jsx}",
        "front-end/react/test/**",
      ],
    },
  },
});
