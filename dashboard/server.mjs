// Local dashboard for running the Center App Playwright tests.
// Start with: npm run dashboard  →  http://localhost:4321
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DASHBOARD_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DASHBOARD_DIR, '..');
const TESTS_DIR = path.join(ROOT, 'tests', 'center-app');
const RESULTS_FILE = path.join(DASHBOARD_DIR, 'results.json');
const PORT = Number(process.env.DASHBOARD_PORT) || 4321;

// ---------- results (persisted so they survive restarts and can be read by Claude) ----------

function loadResults() {
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8')); } catch { return {}; }
}
const results = loadResults();
function saveResults() {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

// ---------- test discovery ----------

function describe(filePath) {
  const src = fs.readFileSync(filePath, 'utf-8');
  const desc = src.match(/^\s*\/\/\s*Description:\s*(.+)$/m);
  const titles = [...src.matchAll(/\btest(?:\.only)?\(\s*(['"`])(.+?)\1/g)].map((m) => m[2]);
  return { description: desc ? desc[1].trim() : (titles[0] ?? ''), titles };
}

// mission-history → Mission History
function displayName(dirName) {
  return dirName.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// Builds a folder tree of every directory under tests/center-app (empty folders included, so new ones show up right away).
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tests = entries
    .filter((e) => e.isFile() && e.name.endsWith('.spec.js'))
    .map((e) => {
      const abs = path.join(dir, e.name);
      const rel = path.relative(ROOT, abs);
      return { file: rel, abs, name: e.name.replace(/\.spec\.js$/, ''), ...describe(abs), result: results[rel] ?? null };
    });

  const folders = entries
    .filter((e) => e.isDirectory())
    .map((e) => scanDir(path.join(dir, e.name)))
    .filter(Boolean);

  // A folder that only wraps a single subfolder is collapsed into it (mission-history/Mission History → Mission History)
  if (!tests.length && folders.length === 1) return folders[0];

  return { name: displayName(path.basename(dir)), path: path.relative(ROOT, dir), tests, folders };
}

function scan() {
  const tree = fs.existsSync(TESTS_DIR) ? scanDir(TESTS_DIR) : null;
  // The tests/center-app root itself is the page; its children are the top-level folders
  if (!tree) return { folders: [], tests: [] };
  if (tree.path === path.relative(ROOT, TESTS_DIR)) return { folders: tree.folders, tests: tree.tests };
  return { folders: [tree], tests: [] };
}

function allTestFiles(node, out = new Set()) {
  for (const t of node.tests) out.add(t.file);
  for (const f of node.folders) allTestFiles(f, out);
  return out;
}

// ---------- live updates (server-sent events) ----------

const clients = new Set();
function broadcast(event, data = {}) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

let watchTimer = null;
if (fs.existsSync(TESTS_DIR)) {
  fs.watch(TESTS_DIR, { recursive: true }, () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => broadcast('tree'), 300);
  });
}

// ---------- running tests (one at a time — the tests share one browser profile) ----------

const queue = [];
let running = null;

function enqueue(file) {
  if (running === file || queue.includes(file)) return;
  queue.push(file);
  results[file] = { ...(results[file] ?? {}), status: 'queued' };
  broadcast('result', { file, result: results[file] });
  runNext();
}

function firstError(report) {
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) {
          const err = r.errors?.[0] ?? r.error;
          if (err) return (err.message ?? String(err)).replace(/\x1b\[[0-9;]*m/g, '');
        }
      }
    }
    for (const child of suite.suites ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const s of report.suites ?? []) {
    const found = walk(s);
    if (found) return found;
  }
  return report.errors?.[0]?.message?.replace(/\x1b\[[0-9;]*m/g, '') ?? null;
}

function runNext() {
  if (running || !queue.length) return;
  const file = queue.shift();
  running = file;
  const startedAt = new Date().toISOString();
  results[file] = { ...(results[file] ?? {}), status: 'running', startedAt };
  broadcast('result', { file, result: results[file] });

  const jsonOut = path.join(os.tmpdir(), `pw-dashboard-${Date.now()}.json`);
  const child = spawn('npx', ['playwright', 'test', file, '--workers=1', '--reporter=json'], {
    cwd: ROOT,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonOut, FORCE_COLOR: '0' },
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdout.resume();

  child.on('close', (code) => {
    let error = null;
    let durationMs = Date.now() - Date.parse(startedAt);
    try {
      const report = JSON.parse(fs.readFileSync(jsonOut, 'utf-8'));
      error = firstError(report);
      if (report.stats?.duration) durationMs = Math.round(report.stats.duration);
      fs.unlinkSync(jsonOut);
    } catch {
      if (code !== 0) error = stderr.trim().slice(-2000) || `Playwright exited with code ${code}`;
    }
    results[file] = {
      status: code === 0 ? 'passed' : 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      error: code === 0 ? null : error,
    };
    saveResults();
    running = null;
    broadcast('result', { file, result: results[file] });
    runNext();
  });
}

// Runs interrupted by a server restart are no longer running
for (const [file, r] of Object.entries(results)) {
  if (r.status === 'running' || r.status === 'queued') results[file] = { ...r, status: null };
}

// ---------- http ----------

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(DASHBOARD_DIR, 'index.html')));
  }

  if (req.method === 'GET' && url.pathname === '/api/tests') {
    return sendJson(res, 200, scan());
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('event: hello\ndata: {}\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    const { files } = await readBody(req);
    // Only files that discovery actually found may be run
    const known = allTestFiles(scan());
    const toRun = (Array.isArray(files) ? files : []).filter((f) => known.has(f));
    if (!toRun.length) return sendJson(res, 400, { error: 'No known test files given' });
    toRun.forEach(enqueue);
    return sendJson(res, 200, { queued: toRun });
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Automation Tests - Center App → ${url}`);
  if (!process.env.NO_OPEN) execFile('open', [url]);
});
