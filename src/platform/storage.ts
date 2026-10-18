import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function useStoredState<T>(
  key: string,
  initial: T,
  revive?: (value: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof localStorage === 'undefined') return structuredClone(initial);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(initial);
      const parsed: unknown = JSON.parse(raw);
      const revived = revive ? revive(parsed) : (parsed as T);
      return revived ?? structuredClone(initial);
    } catch {
      return structuredClone(initial);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* Private mode or a full quota should not break the calculator. */
    }
  }, [key, state]);

  const reset = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setState(structuredClone(initial));
  };

  return [state, setState, reset];
}
