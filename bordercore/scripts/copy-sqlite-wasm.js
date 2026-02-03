/**
 * Copy sqlite3.wasm from @sqlite.org/sqlite-wasm to static/ for Django to serve.
 * Run via: node scripts/copy-sqlite-wasm.js (or npm run copy-sqlite-wasm).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(
  root,
  "node_modules",
  "@sqlite.org",
  "sqlite-wasm",
  "sqlite-wasm",
  "jswasm",
  "sqlite3.wasm"
);
const dest = path.join(root, "static", "sqlite3.wasm");

if (!fs.existsSync(src)) {
  console.warn("copy-sqlite-wasm: source not found, skipping:", src);
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log("copy-sqlite-wasm: copied sqlite3.wasm to static/");
