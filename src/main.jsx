import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import "./styles/global.css";
import "./styles/fit-screen.css";
import { initializeAnalyticsFromSavedConsent, track } from "./lib/analytics.js";

const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";
if (!isAdminRoute) {
  const savedConsent = initializeAnalyticsFromSavedConsent();
  if (savedConsent === "accepted") track("game_page_viewed", { page: "home" });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </React.StrictMode>,
);
