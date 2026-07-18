/**
 * Public PocketFlowFinal entry.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { resetPublicReleaseBrowserState } from "./utils/publicRelease";
import "./index.css";

resetPublicReleaseBrowserState();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
