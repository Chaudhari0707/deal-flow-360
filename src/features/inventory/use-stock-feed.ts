"use client";

import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";

export function useStockFeed() {
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState("Connecting");
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const connect = () => {
      socket = new WebSocket(
        `ws://${window.location.hostname}:${Number(window.location.port || 3000) + 101}/stock`,
      );
      socket.onopen = () => {
        attempts = 0;
        setStatus("Live stock");
      };
      socket.onmessage = () => {
        void mutate(
          (key) =>
            typeof key === "string" &&
            (key.startsWith("/api/v1/inventory") ||
              key.startsWith("/api/v1/fulfillment") ||
              key === "/api/v1/workspace"),
        );
      };
      socket.onclose = (event) => {
        if (stopped) return;
        if (event.code === 1008) {
          setStatus("Session expired — sign in again");
          return;
        }
        setStatus("Reconnecting — refresh available");
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 15000));
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [mutate]);
  if (status === "Connecting" || status === "Reconnecting — refresh available") return null;
  return status;
}
