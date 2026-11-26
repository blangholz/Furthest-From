// The player's status (streak, open ping, Extra Fries...), shared by every screen.
import { useEffect, useSyncExternalStore } from 'react';
import { api, type Status } from './api';

// Give up on a status request after this long, so a dead connection shows an error
// screen instead of hanging on a blank one.
const TIMEOUT_MS = 15_000;

type Snapshot = { status: Status | null; error: unknown };
let snap: Snapshot = { status: null, error: null };
let inflight: Promise<Status | null> | null = null;
const listeners = new Set<() => void>();
const set = (next: Snapshot) => {
  snap = next; // a new object, so useSyncExternalStore re-renders on errors too
  listeners.forEach((l) => l());
};

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Couldn't reach the server.")), TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function refreshStatus(): Promise<Status | null> {
  if (!inflight) {
    inflight = withTimeout(api.status())
      .then((s) => {
        set({ status: s, error: null });
        return s;
      })
      .catch((e) => {
        // Keep the last good status (screens keep working); only surface the error.
        set({ status: snap.status, error: e });
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function clearStatus() {
  set({ status: null, error: null });
}

export function subscribeStatus(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export const statusSnapshot = () => snap;

export function useStatus() {
  const s = useSyncExternalStore(subscribeStatus, statusSnapshot);
  useEffect(() => {
    if (!snap.status) refreshStatus();
  }, []);
  return { status: s.status, error: s.error, refresh: refreshStatus };
}
