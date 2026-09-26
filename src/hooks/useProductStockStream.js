import { useEffect, useRef } from "react";
import { API_URL } from "../utils/api";

export default function useProductStockStream(onChange) {
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const stream = new EventSource(`${API_URL}/api/products/stream`, { withCredentials: false });

    const handleStock = (event) => {
      try {
        callbackRef.current?.(JSON.parse(event.data || "{}"));
      } catch {
        // Ignore malformed events and let EventSource reconnect normally.
      }
    };

    stream.addEventListener("stock:changed", handleStock);
    return () => stream.close();
  }, []);
}
