import React from "react";
import { createRoot } from "react-dom/client";
import QuantifiedSelfPage from "../react/quantified-self/QuantifiedSelfPage";
const container = document.getElementById("react-root");
if (container)
  createRoot(container).render(
    <QuantifiedSelfPage root={container.dataset.apiRoot || "/quantified-self/"} />
  );
