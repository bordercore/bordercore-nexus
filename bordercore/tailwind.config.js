/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./front-end/**/*.{ts,tsx,js,jsx}",
    "./templates/**/*.html",
  ],
  // Phase 0 of the Bootstrap → Tailwind migration.
  // - Preflight is disabled so Tailwind's CSS reset doesn't compete with
  //   Bootstrap's reboot; the goal of this phase is zero visual change.
  // - The Tailwind stylesheet is imported BEFORE bordercore.scss in
  //   front-end/entries/bordercore-css.js, so for any class name that exists
  //   in both frameworks (e.g. .container), Bootstrap wins by source order.
  //   Class names unique to Tailwind (e.g. bg-red-500) work as expected.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
