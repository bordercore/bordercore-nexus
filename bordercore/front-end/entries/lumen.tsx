import React from "react";
import { createRoot } from "react-dom/client";
import LumenPage from "../react/lumen/LumenPage";
import "../react/lumen/lumen.css";

const root = document.getElementById("lumen-root");
const config = document.getElementById("lumen-config");
if (root && config)
  createRoot(root).render(<LumenPage {...JSON.parse(config.textContent || "{}")} />);
