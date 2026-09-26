"use client";
import { useEffect } from "react";
export default function PwaRegister() {
  useEffect(() => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
