import React from "react";
import { createRoot } from "react-dom/client";

import Card from "../react/common/Card";

const App = () => (
  <div>
  </div>
);

const container = document.getElementById("react-root");
if (container) {
  createRoot(container).render(<App />);
}
