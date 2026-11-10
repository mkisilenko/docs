import test from 'node:test';
import assert from 'node:assert/strict';
import { createReader } from './anyx-read.mjs';

const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const collect = async iterable => { const pages = []; for await (const page of iterable) pages.push(page); return pages; };
const settings = { origin: 'https://anyx.dev', key: 'fictional-test-value' };

test('rejects non-HTTPS, embedded credentials and non-origin URLs', () => {
  for (const origin of ['https://another-host.invalid', 'http://example.invalid', 'https://user:password@example.invalid', 'https://example.invalid/path', 'https://example.invalid/?key=value']) {
    assert.throws(() => createReader({ ...settings, origin }));
  }
});

test('follows empty pages; GET, header-only credential and original group retained', async () => {
  const calls = [];
  const reader = createReader({ ...settings, fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    return response({ groups: [], next_cursor: calls.length === 1 ? 'opaque-next' : null });
  } });
  assert.equal((await collect(reader.pages('groups'))).length, 2);
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fictional-test-value');
  assert.equal(calls[1].options.redirect, 'error');
  assert.equal(new URL(calls[1].url).searchParams.get('cursor'), 'opaque-next');
  assert.ok(!calls[0].url.includes(settings.key));
  assert.ok(!('Origin' in calls[0].options.headers));
});

test('keeps group and drops since after first message page', async () => {
  const calls = [];
  const reader = createReader({ ...settings, fetchImpl: async url => {
    calls.push(url);
    return response({ messages: [], next_cursor: calls.length === 1 ? 'next' : null });
  } });
  await collect(reader.pages('messages', { groupId: 'fictional-group', since: '2026-11-10T08:00:00Z' }));
  assert.equal(calls[0].searchParams.get('since'), '2026-11-10T08:00:00Z');
  assert.equal(calls[1].searchParams.get('since'), null);
  assert.equal(calls[1].searchParams.get('group_id'), 'fictional-group');
});

test('honors Retry-After before retrying', async () => {
  let count = 0; const waits = [];
  const reader = createReader({ ...settings, sleep: async ms => waits.push(ms), fetchImpl: async () => ++count === 1
    ? response({ error: 'rate_limited' }, 429, { 'Retry-After': '3' }) : response({ groups: [], next_cursor: null }) });
  await collect(reader.pages('groups'));
  assert.equal(count, 2); assert.ok(waits[0] >= 3000);
});

test('does not shorten a long server retry delay', async () => {
  let count = 0;
  const reader = createReader({ ...settings, fetchImpl: async () => { count++; return response({ error: 'rate_limited' }, 429, { 'Retry-After': '3600' }); } });
  await assert.rejects(collect(reader.pages('groups')), /longer retry delay/);
  assert.equal(count, 1);
});

test('does not retry a revoked credential or echo private error details', async () => {
  let count = 0;
  const reader = createReader({ ...settings, fetchImpl: async () => { count++; return response({ error: 'invalid_token', private: settings.key }, 401); } });
  await assert.rejects(collect(reader.pages('groups')), error => error.message.includes('invalid_token') && !error.message.includes(settings.key));
  assert.equal(count, 1);
});

test('rejects repeated cursors and malformed pagination', async () => {
  const repeated = createReader({ ...settings, fetchImpl: async () => response({ groups: [], next_cursor: 'same' }) });
  await assert.rejects(collect(repeated.pages('groups')), /Repeated cursor/);
  const malformed = createReader({ ...settings, fetchImpl: async () => response({ groups: [] }) });
  await assert.rejects(collect(malformed.pages('groups')), /Invalid pagination/);
});

test('bounds unavailable retries', async () => {
  let count = 0;
  const reader = createReader({ ...settings, sleep: async () => {}, fetchImpl: async () => { count++; return response({ error: 'unavailable' }, 503); } });
  await assert.rejects(collect(reader.pages('groups')), /HTTP 503/);
  assert.equal(count, 5);
});
