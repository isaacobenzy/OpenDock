import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import { App, type WindowKind } from "./app/App";

function windowKind(): WindowKind {
  if (isTauri()) {
    const label = getCurrentWindow().label;
    if (label === "hub" || label === "flyout" || label === "toast") return label;
    return "main";
  }
  const requested = new URLSearchParams(window.location.search).get("window");
  return requested === "hub" || requested === "flyout" || requested === "toast" ? requested : "main";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App kind={windowKind()} />
  </React.StrictMode>,
);
