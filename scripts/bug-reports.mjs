#!/usr/bin/env node
// Pulls shake-to-report bug reports (Decision #42) from Supabase for Claude to work on.
//
//   node scripts/bug-reports.mjs              list new reports, download screenshots to .bug-reports/
//   node scripts/bug-reports.mjs --hook       same, phrased for the Claude Code SessionStart hook
//   node scripts/bug-reports.mjs --watch      poll every 45 s, print one line per new report
//   node scripts/bug-reports.mjs --mark seen 3 4   set status (seen | fixed | wontfix | new)
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.bug-reports');
const args = process.argv.slice(2);
const mode = args[0] ?? '';

function loadEnv() {
  const env = { ...process.env };
  const file = join(root, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  if (mode === '--hook') process.exit(0); // stay quiet at session start
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'fff', 'Content-Profile': 'fff' };

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function newReports() {
  const rows = await rest('bug_reports?status=eq.new&order=created_at.asc&select=*');
  if (rows.length) {
    const ids = [...new Set(rows.map((r) => r.user_id))].join(',');
    const people = await rest(`profiles?id=in.(${ids})&select=id,display_name,username`);
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    for (const r of rows) r.who = byId[r.user_id]?.display_name || byId[r.user_id]?.username || r.user_id.slice(0, 8);
  }
  return rows;
}

async function download(r) {
  if (!r.screenshot_path) return null;
  const ext = r.screenshot_path.split('.').pop();
  const file = join(outDir, `${r.id}.${ext}`);
  if (existsSync(file)) return file;
  const res = await fetch(`${url}/storage/v1/object/fff-bug-reports/${r.screenshot_path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

function describe(r, file) {
  const c = r.context ?? {};
  const where = [c.route, c.platform && `${c.platform} ${c.osVersion ?? ''}`.trim(), c.device, c.appVersion && `v${c.appVersion}`, c.runtime]
    .filter(Boolean).join(' · ');
  const when = new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' });
  return `#${r.id} · ${when} PT · ${r.who}${where ? ` · ${where}` : ''}\n  Note: ${r.note ? JSON.stringify(r.note) : '(none)'}\n  Screenshot: ${file ?? '(none)'}`;
}

async function list(hook) {
  const rows = await newReports();
  if (!rows.length) {
    if (hook) console.log('McFarthest bug reports: none new. Start the live watcher (Monitor: `node scripts/bug-reports.mjs --watch`, 30 min timeout, re-arm on expiry).');
    else console.log('No new bug reports.');
    return;
  }
  const lines = [];
  for (const r of rows) lines.push(describe(r, await download(r)));
  if (hook) {
    console.log(`McFarthest: ${rows.length} new shake-to-report bug report${rows.length === 1 ? '' : 's'} from the app. ` +
      'Before anything else this session: Read each screenshot, then tell Ben what each report is about and ask any questions you have, ' +
      'then mark them with `node scripts/bug-reports.mjs --mark seen <ids>`. Also start the live watcher (Monitor: ' +
      '`node scripts/bug-reports.mjs --watch`, 30 min timeout, re-arm on expiry).\n');
  }
  console.log(lines.join('\n\n'));
}

async function watch() {
  const seen = new Set();
  let first = true;
  for (;;) {
    try {
      const rows = await newReports();
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        // Reports that were already new at startup came in through the session-start list.
        if (!first) console.log(`New bug report ${describe(r, await download(r)).replace(/\n\s*/g, ' | ')}`);
      }
      first = false;
    } catch (e) {
      console.log(`bug-report watcher error (will retry): ${String(e.message).slice(0, 200)}`);
    }
    await new Promise((res) => setTimeout(res, 45_000));
  }
}

async function mark(status, ids) {
  if (!['seen', 'fixed', 'wontfix', 'new'].includes(status) || !ids.length) {
    console.error('Usage: --mark seen|fixed|wontfix|new <id> [id...]');
    process.exit(1);
  }
  const body = { status, ...(status === 'seen' ? { seen_at: new Date().toISOString() } : {}) };
  const rows = await rest(`bug_reports?id=in.(${ids.join(',')})`, {
    method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
  console.log(`Marked ${rows.map((r) => `#${r.id}`).join(', ') || 'nothing'} as ${status}.`);
}

try {
  if (mode === '--watch') await watch();
  else if (mode === '--mark') await mark(args[1], args.slice(2));
  else await list(mode === '--hook');
} catch (e) {
  if (mode === '--hook') console.log(`McFarthest bug reports: could not check (${String(e.message).slice(0, 200)}).`);
  else { console.error(e.message); process.exit(1); }
}
