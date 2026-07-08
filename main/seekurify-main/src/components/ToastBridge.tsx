import { useEffect, useState } from "react";

type AlertData = {
  message: string;
  ip: string;
  at: string;
  location: string;
};



export default function ToastBridge() {
  const [alert, setAlert] = useState<AlertData | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<AlertData>) => {
      const d = e.detail;
setAlert({
  message: d?.message || "Suspicious activity detected on your account.",
  ip: d?.ip || "Unknown",
  at: d?.at || new Date().toISOString(),   // ✅ fallback guarantees string
  location: d?.location || "Unknown",
});

      // Auto-dismiss after 10 seconds
      setTimeout(() => setAlert(null), 10000);
    };

    window.addEventListener("SECURITY_ALERT", handler as EventListener);
    return () => {
      window.removeEventListener("SECURITY_ALERT", handler as EventListener);
    };
  }, []);

  if (!alert) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
      <div className="bg-red-600 text-white shadow-lg rounded-xl p-4 animate-bounce">
        <h2 className="font-bold text-lg">⚠ Security Alert</h2>
        <p className="text-sm">{alert.message}</p>
        <p className="text-xs mt-2 opacity-80">
          IP: {alert.ip} <br />
          Location: {alert.location} <br />
At: {new Date(alert.at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
