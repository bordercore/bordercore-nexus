const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === "production";

module.exports = defineConfig({
  plugins: [
    react({
      include: /\.(jsx|tsx)$/,
    }),
  ],
  // Base path: use /static/vite/ for production, / for dev
  base: isProduction ? "/static/vite/" : "/",
  // Root is where vite.config.js is located (bordercore directory)
  root: __dirname,
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    hmr: {
      host: "localhost",
      port: 5173,
    },
  },
  build: {
    outDir: path.resolve(__dirname, "static", "vite"),
    emptyOutDir: false,
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
        "dist/js/fitness-exercise-detail": path.resolve(__dirname, "front-end", "entries", "fitness-exercise-detail.tsx"),
        "dist/js/metric-list": path.resolve(__dirname, "front-end", "entries", "metric-list.tsx"),
        "dist/js/node-list": path.resolve(__dirname, "front-end", "entries", "node-list.tsx"),
        "dist/js/node-detail": path.resolve(__dirname, "front-end", "entries", "node-detail.tsx"),
        "dist/js/bookmark-list": path.resolve(__dirname, "front-end", "entries", "bookmark-list.tsx"),
        "dist/js/bookmark-form": path.resolve(__dirname, "front-end", "entries", "bookmark-form.tsx"),
        "dist/js/prefs": path.resolve(__dirname, "front-end", "entries", "prefs.tsx"),
        "dist/js/prefs-password": path.resolve(__dirname, "front-end", "entries", "prefs-password.tsx"),
        "dist/js/blob-list": path.resolve(__dirname, "front-end", "entries", "blob-list.tsx"),
        "dist/js/bookshelf": path.resolve(__dirname, "front-end", "entries", "bookshelf.tsx"),
        "dist/js/note-list": path.resolve(__dirname, "front-end", "entries", "note-list.tsx"),
        "dist/js/blob-detail": path.resolve(__dirname, "front-end", "entries", "blob-detail.tsx"),
        "dist/js/blob-import": path.resolve(__dirname, "front-end", "entries", "blob-import.tsx"),
        "dist/js/blob-update": path.resolve(__dirname, "front-end", "entries", "blob-update.tsx"),
        "dist/js/login": path.resolve(__dirname, "front-end", "entries", "login.tsx"),
        "dist/js/book-list": path.resolve(__dirname, "front-end", "entries", "book-list.tsx"),
      },
      output: {
        entryFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
        manualChunks: {
          "react-select": ["react-select"],
        },
      },
    },
  },
});
