import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(fn: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", fn);
  return () => media?.removeEventListener("change", fn);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, () => !!window.matchMedia?.(QUERY).matches);
}
