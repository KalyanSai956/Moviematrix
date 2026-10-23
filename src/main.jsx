import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/global.css";
import "./styles/fit-screen.css";
import "./styles/games.css";
import { initializeAnalyticsFromSavedConsent, track } from "./lib/analytics.js";

const savedConsent = initializeAnalyticsFromSavedConsent();
if (savedConsent === "accepted") track("game_page_viewed", { page: "home" });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
