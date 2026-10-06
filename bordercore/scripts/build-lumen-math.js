// Commit this self-contained bundle so Django workers do not need Node at runtime.
const esbuild = require("esbuild");
const fs = require("node:fs");
const { gzipSync } = require("node:zlib");
const result = esbuild.buildSync({
  entryPoints: ["front-end/lumen-math.js"],
  write: false,
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  define: { global: "globalThis" },
  // MathJax 3's legacy AsciiMath implementation uses arguments.callee.
  tsconfigRaw: { compilerOptions: { alwaysStrict: false } },
  legalComments: "none",
});
fs.writeFileSync("lumen/vendor/mathjax.js.gz", gzipSync(result.outputFiles[0].contents));
fs.copyFileSync("node_modules/mathjax-full/LICENSE", "lumen/vendor/MathJax-LICENSE");
