// push-dispatch: sends queued push messages (public.outbox) through Expo's push service.
// Called every minute by pg_cron (see migrations/20261126000003_push_dispatch_secret.sql)
// with a shared secret. Uses only the service role; never sees anyone's location.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Claimed = { id: number; title: string; body: string; data: Record<string, unknown>; tokens: string[] };
type Ticket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request

Deno.serve(async (req) => {
  // Only pg_cron may call this. It sends a shared secret kept in Vault (fff_dispatch_secret)
  // and in this function's secrets (FFF_DISPATCH_SECRET). We don't compare against the
  // injected service role key: the platform may inject a different key format than the
  // one stored in Vault (it did: every call got 403 and no pushes went out).
  const expected = Deno.env.get('FFF_DISPATCH_SECRET') ?? '';
  const given = req.headers.get('x-dispatch-secret') ?? '';
  if (!expected || given !== expected) return new Response('forbidden', { status: 403 });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false },
    db: { schema: 'fff' },
  });
  const { data, error } = await db.rpc('claim_outbox', { p_limit: 500 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as Claimed[];

  // One Expo message per device token; remember which outbox row it belongs to.
  const messages: { outboxId: number; token: string; payload: Record<string, unknown> }[] = [];
  const noDevice: number[] = [];
  for (const r of rows) {
    if (r.tokens.length === 0) noDevice.push(r.id);
    for (const token of r.tokens) {
      messages.push({
        outboxId: r.id,
        token,
        payload: { to: token, title: r.title, body: r.body, data: r.data, sound: 'default', priority: 'high' },
      });
    }
  }

  const sent = new Set<number>(noDevice); // nothing to deliver to: done
  const failed: { id: number; error: string }[] = [];
  const dead: string[] = [];
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN'); // optional: only if push security is on in Expo

  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(chunk.map((m) => m.payload)),
      });
      const json = await res.json();
      const tickets: Ticket[] = json.data ?? [];
      chunk.forEach((m, j) => {
        const t = tickets[j];
        if (t?.status === 'ok') sent.add(m.outboxId);
        else {
          if (t?.details?.error === 'DeviceNotRegistered') {
            dead.push(m.token);
            sent.add(m.outboxId);
          } else failed.push({ id: m.outboxId, error: t?.message ?? `HTTP ${res.status}` });
        }
      });
    } catch (e) {
      chunk.forEach((m) => failed.push({ id: m.outboxId, error: String(e) }));
    }
  }

  const { error: finishError } = await db.rpc('finish_outbox', {
    p_sent: [...sent],
    p_failed: failed.filter((f) => !sent.has(f.id)),
    p_dead_tokens: dead,
  });
  if (finishError) return Response.json({ error: finishError.message }, { status: 500 });
  return Response.json({ claimed: rows.length, messages: messages.length, sent: sent.size, failed: failed.length });
});
