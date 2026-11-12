// A log made inside the window must never be lost (spec 9). If the upload fails
// for lack of signal, the log waits here, on this phone only, with the time it
// was made, and uploads on the next launch or return to the app. The server
// accepts it if that time was inside the window. Removed as soon as it uploads.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, type LogKind, type LogResult } from './api';

const KEY = 'fff-pending-logs-v1';
type Pending = { lat: number; lon: number; kind: LogKind; loggedAt: string; extremeId?: number };

async function read(): Promise<Pending[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  } catch {
    return [];
  }
}
const write = (items: Pending[]) => AsyncStorage.setItem(KEY, JSON.stringify(items));

/** Submit now; on a network failure keep it for later and rethrow so the UI can say so. */
export async function submitOrQueue(p: Omit<Pending, 'loggedAt'>): Promise<LogResult> {
  const item: Pending = { ...p, loggedAt: new Date().toISOString() };
  try {
    return await api.submitLog(item);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'network') await write([...(await read()), item]);
    throw e;
  }
}

/** Try every waiting log. Drops ones the server rejects for good (too old, already used). */
export async function flushQueue(): Promise<LogResult[]> {
  const items = await read();
  if (!items.length) return [];
  const keep: Pending[] = [];
  const done: LogResult[] = [];
  for (const it of items) {
    try {
      done.push(await api.submitLog(it));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network') keep.push(it);
    }
  }
  await write(keep);
  return done;
}

export async function pendingCount() {
  return (await read()).length;
}
