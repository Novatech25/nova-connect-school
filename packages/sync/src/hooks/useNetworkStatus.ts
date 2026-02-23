import { useState, useEffect } from "react";

export type NetworkStatus = {
  online: boolean;
  since: Date | null;
  downlink: number | null;
  effectiveType: string | null;
  rtt: number | null;
};

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    online: typeof window !== "undefined" ? navigator.onLine : true,
    since: null,
    downlink: null,
    effectiveType: null,
    rtt: null,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateOnlineStatus = () => {
      const connection = (navigator as unknown as { connection?: NetworkInformation }).connection;

      setStatus((prev) => ({
        online: navigator.onLine,
        since: prev.online !== navigator.onLine ? new Date() : prev.since,
        downlink: connection?.downlink ?? null,
        effectiveType: connection?.effectiveType ?? null,
        rtt: connection?.rtt ?? null,
      }));
    };

    // Listen for online/offline events
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    // Listen for network connection changes (if supported)
    const connection = (navigator as unknown as { connection?: NetworkInformation }).connection;
    if (connection) {
      connection.addEventListener("change", updateOnlineStatus);
    }

    // Initial status
    updateOnlineStatus();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);

      if (connection) {
        connection.removeEventListener("change", updateOnlineStatus);
      }
    };
  }, []);

  return status;
}
