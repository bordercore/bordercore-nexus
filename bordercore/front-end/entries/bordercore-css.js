// Small entry that imports the main SCSS so Vite can emit a CSS asset.
// Tailwind is imported FIRST so that Bootstrap (loaded by bordercore.scss)
// wins source-order conflicts for class names that exist in both frameworks
// during the Phase 0 coexistence period. See tailwind.config.js for details.
import "../../static/scss/tailwind.css";
import "../../static/scss/bordercore.scss";
import "animate.css";

// Export nothing; rollup will generate a corresponding CSS asset
export default {};
