import { useEffect, useRef } from "react";

/**
 * Returns a stable function that defers invocations of `callback` by `delayMs`.
 * Each new call resets the timer. The latest `callback` reference is captured
 * via a ref so consumers can pass an inline arrow without re-creating the hook.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (...args: Args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delayMs);
  };
}
