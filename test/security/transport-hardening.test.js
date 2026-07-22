// [HEADERS] [ABUSE] Transport / CORS / body-size hardening checks.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from '../helpers/testServer.js';
import { authHeaders, fetchJson } from '../helpers/attacks.js';

let ctx;
let user;

before(async () => {
  process.env.CLIENT_URL = 'http://localhost:5173,http://localhost:5175';
  ctx = await startTestServer();
  user = await registerUser(ctx.base, `transport_${Date.now()}`);
});

after(async () => {
  await ctx.stop();
});

test('[HEADERS] /api/health sets X-Content-Type-Options nosniff', async () => {
  const res = await fetch(`${ctx.base}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('[HEADERS] /api/health does not advertise X-Powered-By', async () => {
  const res = await fetch(`${ctx.base}/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('[HEADERS] disallowed CORS Origin is rejected', async () => {
  const res = await fetch(`${ctx.base}/health`, {
    headers: { Origin: 'https://evil.example' },
  });
  // Request may still succeed, but must not reflect the evil Origin.
  assert.equal(res.status, 200);
  assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://evil.example');
});

test('[HEADERS] allowed Origin receives Access-Control-Allow-Origin', async () => {
  const res = await fetch(`${ctx.base}/users`, {
    headers: {
      Authorization: `Bearer ${user.token}`,
      Origin: 'http://localhost:5175',
    },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5175');
});

test('[ABUSE] oversized JSON body is rejected (413/400/500)', async () => {
  const huge = 'x'.repeat(120 * 1024);
  const res = await fetch(`${ctx.base}/users/me`, {
    method: 'PATCH',
    headers: authHeaders(user.token),
    body: JSON.stringify({ bio: huge }),
  });
  assert.ok([400, 413, 500].includes(res.status), `expected body limit reject, got ${res.status}`);
});

test('[ABUSE] unauthenticated protected route stays 401', async () => {
  const { status } = await fetchJson(`${ctx.base}/users`);
  assert.equal(status, 401);
});
