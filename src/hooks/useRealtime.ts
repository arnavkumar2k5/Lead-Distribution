"use client";

import { useEffect, useCallback, useRef } from "react";

interface UseRealtimeOptions {
  onLeadAssigned?: (data: unknown) => void;
  onQuotaReset?: (data: unknown) => void;
}

export function useRealtime({ onLeadAssigned, onQuotaReset }: UseRealtimeOptions) {
  const esRef = useRef<EventSource | null>(null);
  const retryDelay = useRef(1000);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    const es = new EventSource("/api/poll/stream");
    esRef.current = es;

    es.addEventListener("connected", () => {
      retryDelay.current = 1000;
    });

    es.addEventListener("lead:assigned", (e) => {
      onLeadAssigned?.(JSON.parse(e.data));
    });

    es.addEventListener("quota:reset", (e) => {
      onQuotaReset?.(JSON.parse(e.data));
    });

    es.onerror = () => {
      es.close();
      if (isMounted.current) {
        const delay = Math.min(retryDelay.current, 30_000);
        retryDelay.current = delay * 2;
        setTimeout(connect, delay);
      }
    };
  }, [onLeadAssigned, onQuotaReset]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      esRef.current?.close();
    };
  }, [connect]);
}
