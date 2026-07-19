/* global AbortSignal, console, fetch, process, setTimeout */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = 'http://127.0.0.1:4321/';
const stateUrl = `${url}api/state`;
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(moduleDirectory, '../../../..');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function probe() {
  try {
    const response = await fetch(stateUrl, { signal: AbortSignal.timeout(900) });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return { kind: 'occupied', detail: `HTTP ${response.status}` };
    }
    const payload = await response.json();
    return Array.isArray(payload.drafts)
      ? { kind: 'ready' }
      : { kind: 'occupied', detail: 'unexpected JSON response' };
  } catch (error) {
    const code = error?.cause?.code;
    if (code === 'ECONNREFUSED' || code === 'UND_ERR_CONNECT_TIMEOUT') {
      return { kind: 'stopped' };
    }
    if (error?.name === 'TimeoutError') return { kind: 'occupied', detail: 'request timed out' };
    throw error;
  }
}

const initial = await probe();
if (initial.kind === 'ready') {
  console.log(JSON.stringify({ url, started: false, status: 'ready' }));
  process.exit(0);
}
if (initial.kind === 'occupied') {
  throw new Error(`Port 4321 is responding but is not Writer Studio (${initial.detail}).`);
}

const child = spawn(process.execPath, ['tools/writer-studio/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
});
const childDone = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});

process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));

for (let attempt = 0; attempt < 40; attempt += 1) {
  await wait(150);
  const result = await probe();
  if (result.kind === 'ready') {
    console.log(JSON.stringify({ url, started: true, status: 'ready' }));
    process.exitCode = await childDone;
    process.exit();
  }
  if (result.kind === 'occupied') {
    throw new Error(`Port 4321 became occupied by another service (${result.detail}).`);
  }
}

child.kill();
throw new Error('Writer Studio did not become ready within 6 seconds.');
