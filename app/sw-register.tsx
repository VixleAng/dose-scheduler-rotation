"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        // Register at root scope
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // If there's an updated SW waiting, activate it on refresh
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            // You can later show a toast "Update available — refresh"
          });
        });
      } catch (e) {
        // Silent fail: don't break app if SW fails
        console.warn("SW registration failed", e);
      }
    };

    register();
  }, []);

  return null;
}