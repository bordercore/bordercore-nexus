import React from "react";
import { createRoot } from "react-dom/client";
import GalleryPage from "../react/homepage/GalleryPage";

const container = document.getElementById("react-root");
if (container) {
  const root = createRoot(container);
  root.render(<GalleryPage />);
}
