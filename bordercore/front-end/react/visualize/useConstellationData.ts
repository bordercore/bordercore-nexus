import { useEffect, useState } from "react";
import axios from "axios";
import type { GraphPayload, Layer } from "./types";

export type FetchStatus = "loading" | "ready" | "error";

interface UseConstellationDataResult {
  status: FetchStatus;
  data: GraphPayload | null;
  error: string | null;
  reload: () => void;
}

export function useConstellationData(
  graphUrl: string,
  layers: Set<Layer>
): UseConstellationDataResult {
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [data, setData] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const layersKey = [...layers].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    const params = new URLSearchParams();
    params.set("layers", layersKey || "direct,tags");

    axios
      .get<GraphPayload>(`${graphUrl}?${params.toString()}`)
      .then(response => {
        if (cancelled) return;
        setData(response.data);
        setStatus("ready");
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load graph");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [graphUrl, layersKey, reloadTick]);

  return {
    status,
    data,
    error,
    reload: () => setReloadTick(tick => tick + 1),
  };
}
