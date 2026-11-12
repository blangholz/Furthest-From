// The player's status (streak, open ping, Extra Fries...), shared by every screen.
import { useEffect, useSyncExternalStore } from 'react';
import { api, type Status } from './api';

let current: Status | null = null;
let error: unknown = null;
let inflight: Promise<Status | null> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function refreshStatus(): Promise<Status | null> {
  if (!inflight) {
    inflight = api
      .status()
      .then((s) => {
        current = s;
        error = null;
        return s;
      })
      .catch((e) => {
        error = e;
        return null;
      })
      .finally(() => {
        inflight = null;
        emit();
      });
  }
  return inflight;
}

export function clearStatus() {
  current = null;
  emit();
}

export function useStatus() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  useEffect(() => {
    if (!current) refreshStatus();
  }, []);
  return { status: s, error, refresh: refreshStatus };
}
