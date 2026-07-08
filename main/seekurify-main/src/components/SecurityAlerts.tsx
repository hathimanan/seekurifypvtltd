// SecurityAlert.tsx
import { useEffect } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

interface SecurityAlertProps {
  userId: string;
}

export default function SecurityAlert({ userId }: SecurityAlertProps) {
  useEffect(() => {
    const token = localStorage.getItem("token") || "";

    const socket: Socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: { token },
      transports: ["polling", "websocket"], // polling first helps through proxies/firewalls
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      autoConnect: true,
    });

    // ✅ On successful connection
    socket.on("connect", () => {
      console.log("✅ Connected to socket:", socket.id);
      socket.emit("registerUser", userId);
    });

    // ⚠️ Handle connection errors and fallback
    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection failed:", err.message);

const transports = socket.io?.opts?.transports as ("polling" | "websocket")[] | undefined;

if (transports?.includes("websocket")) {
  console.warn("⚡ Switching transport from websocket → polling and retrying...");
  socket.io.opts.transports = ["polling"];
  socket.connect();
}

    });

    // 🔔 Alert handler
    const onAlert = (data: any) => {
      window.dispatchEvent(new CustomEvent("SECURITY_ALERT", { detail: data }));
    };

    socket.on("suspiciousLogin", onAlert);

    // 🧹 Cleanup on unmount
    return () => {
      socket.off("suspiciousLogin", onAlert);
      socket.disconnect();
    };
  }, [userId]);

  return null;
}
