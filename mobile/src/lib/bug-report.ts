// Shake to report (Decision #42): the tester-only setting, the shake detector and a
// trigger the DEV section can fire by hand. The UI lives in src/ui/BugReporter.tsx.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'dev.shakeToReport';

// --- Setting (persisted on the phone, shared by every component that reads it) ---
let enabled = false;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();

export function useShakeToReport(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    listeners.add(setOn);
    if (!loaded) {
      AsyncStorage.getItem(KEY).then((v) => {
        loaded = true;
        enabled = v === '1';
        listeners.forEach((l) => l(enabled));
      }).catch(() => {});
    }
    return () => { listeners.delete(setOn); };
  }, []);
  const set = (next: boolean) => {
    enabled = next;
    loaded = true;
    listeners.forEach((l) => l(next));
    AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => {});
  };
  return [on, set];
}

// --- Manual trigger ("Report a bug now" in DEV) ---
const triggers = new Set<() => void>();
export const onReportRequested = (fn: () => void) => {
  triggers.add(fn);
  return () => { triggers.delete(fn); };
};
export const requestReport = () => triggers.forEach((t) => t());

// --- Shake detection ---
// Accelerometer samples are in g and include gravity, so a phone at rest reads ~1.
// A jolt is a sample far from 1 g; a shake is JOLTS jolts within WINDOW_MS. After a
// shake nothing fires for COOLDOWN_MS, so one long shake opens one report.
export const SHAKE = { threshold: 1.4, jolts: 4, windowMs: 1000, cooldownMs: 2500 };
export type ShakeState = { jolts: number[]; lastShake: number };
export const newShakeState = (): ShakeState => ({ jolts: [], lastShake: -Infinity });

export function feedShake(state: ShakeState, s: { x: number; y: number; z: number }, now: number): boolean {
  if (now - state.lastShake < SHAKE.cooldownMs) return false;
  const g = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
  if (Math.abs(g - 1) < SHAKE.threshold) return false;
  // Count at most one jolt per 100 ms so a single hard bump spread over several samples is one jolt.
  const last = state.jolts[state.jolts.length - 1];
  if (last !== undefined && now - last < 100) return false;
  state.jolts = [...state.jolts.filter((t) => now - t < SHAKE.windowMs), now];
  if (state.jolts.length < SHAKE.jolts) return false;
  state.jolts = [];
  state.lastShake = now;
  return true;
}

// --- Upload helper: base64 (from react-native-view-shot) to bytes for Supabase Storage ---
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12)
      | ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) | (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}
